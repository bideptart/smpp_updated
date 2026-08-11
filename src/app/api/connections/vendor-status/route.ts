import * as fs from "fs";
import * as path from "path";
import prisma from "@/lib/db";
import { listConnectors, connectorStats } from "@/lib/jasmin-cli";
import type { DirectStatus } from "@/lib/direct-smpp";
import { getSessionUser } from "@/lib/user-scope";

const STATUS_FILE = process.platform === "win32"
  ? path.join(process.env.TEMP || "C:\\Temp", "smpp-daemon-status.json")
  : "/tmp/smpp-daemon-status.json";

export async function GET() {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Daemon liveness (queue processor) and its direct-SMPP bind state --
    // both come from the same heartbeat file, since the web app and the
    // daemon are separate processes and can't share in-memory state.
    let daemonStatus: { running?: boolean; uptimeSeconds?: number; pid?: number; direct?: DirectStatus[] } | null = null;
    try {
      daemonStatus = JSON.parse(fs.readFileSync(STATUS_FILE, "utf-8"));
    } catch {
      // Daemon may not be running
    }

    const dbConnections = await prisma.connection.findMany({
      where: {
        company: { type: "vendor" },
        type: "SMPP",
      },
      include: {
        company: { select: { name: true, type: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Two independent bind states to reconcile: Jasmin's own connectors
    // (for connections still on JASMIN transport) and the daemon's own
    // direct SMPP clients (for DIRECT transport) -- a connection only ever
    // reads from the one that actually carries its traffic.
    const jasminConnectors = await listConnectors().catch(() => []);
    const byCid = new Map(jasminConnectors.map((c) => [c.cid.toLowerCase(), c]));
    const directByCid = new Map((daemonStatus?.direct || []).map((s) => [s.cid, s]));

    const connections = await Promise.all(
      dbConnections.map(async (c) => {
        if (c.transport === "DIRECT") {
          const ds = directByCid.get(c.name);
          return {
            id: c.id,
            name: c.name,
            companyName: c.company.name,
            host: c.host,
            port: c.port,
            systemId: c.username,
            status: c.status,
            maxTps: c.maxTps,
            transport: c.transport,
            bound: ds?.bound ?? false,
            msgsSent: ds?.submitted ?? 0,
            msgsDelivered: ds?.delivered ?? 0,
            msgsFailed: ds?.failed ?? 0,
          };
        }

        const jc = byCid.get(c.name.toLowerCase());
        const bound = !!jc && jc.session.includes("BOUND");
        const stats = jc ? await connectorStats(jc.cid).catch(() => ({} as Record<string, string>)) : {};
        return {
          id: c.id,
          name: c.name,
          companyName: c.company.name,
          host: c.host,
          port: c.port,
          systemId: c.username,
          status: c.status,
          maxTps: c.maxTps,
          transport: c.transport,
          bound,
          msgsSent: Number(stats.submit_sm_count || 0),
          msgsDelivered: Number(stats.deliver_sm_count || 0),
          msgsFailed: Number(stats.other_submit_error_count || 0) + Number(stats.throttling_error_count || 0),
        };
      })
    );

    return Response.json({
      success: true,
      daemon: {
        running: daemonStatus?.running ?? false,
        uptime: daemonStatus?.uptimeSeconds ?? 0,
        pid: daemonStatus?.pid ?? null,
      },
      connections,
    });
  } catch (error) {
    console.error("Vendor status error:", error);
    return Response.json({ success: false, error: "Failed to fetch vendor status" }, { status: 500 });
  }
}
