import { Prisma } from "@/generated/prisma";
import prisma from "@/lib/db";
import { getSessionUser } from "@/lib/user-scope";

export async function GET() {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const [tps1min, tps5min, queued, boundCount, last24h] = await Promise.all([
      prisma.$queryRaw<[{count: number}]>(
        Prisma.sql`SELECT count(*)::int FROM sms_messages WHERE submitted_at >= now() - interval '1 minute'`
      ),
      prisma.$queryRaw<[{count: number}]>(
        Prisma.sql`SELECT count(*)::int FROM sms_messages WHERE submitted_at >= now() - interval '5 minutes'`
      ),
      prisma.$queryRaw<[{count: number}]>(
        Prisma.sql`SELECT count(*)::int FROM sms_messages WHERE status IN ('queued','sending')`
      ),
      prisma.$queryRaw<[{count: number}]>(
        Prisma.sql`SELECT count(*)::int FROM smpp_bind_log WHERE action='bind' AND created_at >= now() - interval '1 hour'`
      ),
      prisma.$queryRaw<Array<{status: string; count: number}>>(
        Prisma.sql`SELECT status::text, count(*)::int FROM sms_messages WHERE submitted_at >= now() - interval '24 hours' GROUP BY status`
      ),
    ]);

    const tpsNow = Math.round((tps1min[0]?.count || 0) / 60);
    const tps5 = Math.round((tps5min[0]?.count || 0) / 300);
    const statusMap: Record<string, number> = {};
    last24h.forEach(r => { statusMap[r.status] = r.count; });
    const total24h = last24h.reduce((a, r) => a + r.count, 0);

    return Response.json({
      success: true,
      tpsNow, tps5min: tps5,
      queued: queued[0]?.count || 0,
      recentBinds: boundCount[0]?.count || 0,
      last24h: { total: total24h, ...statusMap },
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error(e);
    return Response.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
