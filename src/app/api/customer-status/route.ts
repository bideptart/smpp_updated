import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { promises as fs } from "fs";
import path from "path";
import { getSessionUser } from "@/lib/user-scope";

export async function GET(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const period = req.nextUrl.searchParams.get("period") || "60";
    const sinceMinutes = parseInt(period, 10);
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);

    // Try reading server status file
    let serverStatus = null;
    try {
      const statusPath =
        process.platform === "win32"
          ? path.join(process.env.TEMP || "C:/tmp", "smpp-server-status.json")
          : "/tmp/smpp-server-status.json";
      const raw = await fs.readFile(statusPath, "utf-8");
      serverStatus = JSON.parse(raw);
    } catch {
      // File may not exist
    }

    // Get all active SMPP accounts with company info
    const accounts = await prisma.customerSmppAccount.findMany({
      where: { status: { not: "disabled" } },
      include: { company: { select: { name: true } } },
      orderBy: { companyId: "asc" },
    });

    // Get recent bind logs
    const bindLogs = await prisma.smppBindLog.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { account: { select: { systemId: true, accountName: true } } },
    });

    // Get traffic summary per company for the period
    const trafficByCompany = await prisma.smsMessage.groupBy({
      by: ["customerId"],
      where: { submittedAt: { gte: since } },
      _count: { _all: true },
    });

    // Get per-status counts
    const trafficByStatus = await prisma.smsMessage.groupBy({
      by: ["customerId", "status"],
      where: { submittedAt: { gte: since } },
      _count: { _all: true },
    });

    // Build traffic map
    const trafficMap: Record<
      number,
      { total: number; delivered: number; failed: number; queued: number }
    > = {};
    trafficByCompany.forEach((t) => {
      if (t.customerId) {
        trafficMap[t.customerId] = {
          total: t._count._all,
          delivered: 0,
          failed: 0,
          queued: 0,
        };
      }
    });
    trafficByStatus.forEach((t) => {
      if (t.customerId && trafficMap[t.customerId]) {
        if (t.status === "delivered") trafficMap[t.customerId].delivered = t._count._all;
        if (t.status === "failed") trafficMap[t.customerId].failed = t._count._all;
        if (t.status === "queued") trafficMap[t.customerId].queued = t._count._all;
      }
    });

    const accountData = accounts.map((a) => ({
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
    }));

    const bindLogData = bindLogs.map((b) => ({
      id: b.id,
      systemId: b.systemId,
      accountName: b.account?.accountName || "-",
      clientIp: b.clientIp,
      action: b.action,
      reason: b.reason,
      createdAt: b.createdAt,
    }));

    return Response.json({
      success: true,
      serverStatus,
      accounts: accountData,
      trafficMap,
      bindLogs: bindLogData,
    });
  } catch (error) {
    console.error("Customer status error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch status" },
      { status: 500 }
    );
  }
}
