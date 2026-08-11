import * as fs from "fs";
import * as path from "path";
import prisma from "@/lib/db";
import { getSessionUser } from "@/lib/user-scope";

const STATUS_FILE = process.platform === "win32"
  ? path.join(process.env.TEMP || "C:\\Temp", "smpp-server-status.json")
  : "/tmp/smpp-server-status.json";

export async function GET() {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Read real-time stats from server status file
    let serverStatus: Record<string, unknown> | null = null;
    try {
      const raw = fs.readFileSync(STATUS_FILE, "utf-8");
      serverStatus = JSON.parse(raw);
    } catch {
      // Server may not be running
    }

    const boundClients: Array<Record<string, unknown>> =
      (serverStatus as { bound_clients?: Array<Record<string, unknown>> })?.bound_clients || [];

    // Get customer SMPP accounts from DB
    const accounts = await prisma.customerSmppAccount.findMany({
      where: { status: { not: "disabled" } },
      include: {
        company: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Merge DB accounts with live bound status
    const connections = accounts.map((a) => {
      const live = boundClients.find((b) => b.system_id === a.systemId);
      return {
        id: a.id,
        systemId: a.systemId,
        accountName: a.accountName,
        companyName: a.company.name,
        companyId: a.companyId,
        status: a.status,
        maxTps: a.maxTps,
        maxConnections: a.maxConnections,
        lastBindAt: a.lastBindAt,
        lastBindIp: a.lastBindIp,
        // Real-time data from server
        bound: !!live,
        clientIp: live?.client_ip ?? a.lastBindIp ?? null,
        connectedAt: live?.connected_at ?? null,
        lastActivity: live?.last_activity ?? null,
        msgCount: live?.msgs ?? 0,
        bindType: live?.bind_type ?? "Transceiver",
        txRequests: live?.tx_requests ?? 0,
        txResponses: live?.tx_responses ?? 0,
        rxRequests: live?.rx_requests ?? 0,
        rxResponses: live?.rx_responses ?? 0,
        txRate: live?.tx_rate ?? 0,
        rxRate: live?.rx_rate ?? 0,
        queueSize: live?.queue_size ?? 0,
      };
    });

    return Response.json({
      success: true,
      server: {
        running: (serverStatus as { running?: boolean })?.running ?? false,
        uptime: (serverStatus as { uptime_seconds?: number })?.uptime_seconds ?? 0,
        pid: (serverStatus as { pid?: number })?.pid ?? null,
        listenPort: (serverStatus as { listen_port?: number })?.listen_port ?? 2775,
        activeClients: (serverStatus as { active_clients?: number })?.active_clients ?? 0,
        totalBinds: (serverStatus as { total_binds?: number })?.total_binds ?? 0,
        totalMsgs: (serverStatus as { total_msgs?: number })?.total_msgs ?? 0,
        totalRejections: (serverStatus as { total_rejections?: number })?.total_rejections ?? 0,
      },
      connections,
    });
  } catch (error) {
    console.error("Customer live status error:", error);
    return Response.json({ success: false, error: "Failed to fetch customer status" }, { status: 500 });
  }
}
