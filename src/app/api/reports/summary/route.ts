import { NextRequest } from "next/server";
import * as fs from "fs";
import prisma from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { getSessionUser } from "@/lib/user-scope";

export async function GET(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const sp = req.nextUrl.searchParams;
    const accountId = sp.get("accountId");
    const dateFrom = sp.get("dateFrom");
    const dateTo = sp.get("dateTo");

    const base: Prisma.Sql[] = [];
    if (accountId) base.push(Prisma.sql`m.customer_account_id = ${parseInt(accountId, 10)}`);
    if (dateFrom) base.push(Prisma.sql`m.submitted_at >= ${new Date(dateFrom)}`);
    if (dateTo) base.push(Prisma.sql`m.submitted_at <= ${new Date(dateTo + "T23:59:59.999Z")}`);
    const whereSql = base.length
      ? Prisma.sql`WHERE ${Prisma.join(base, " AND ")}`
      : Prisma.empty;

    const statusBreakdown = await prisma.$queryRaw<Array<{ status: string; count: number }>>(
      Prisma.sql`SELECT m.status::text AS status, count(*)::int AS count
                 FROM sms_messages m ${whereSql}
                 GROUP BY m.status ORDER BY count DESC`
    );

    const perAccountRaw = await prisma.$queryRaw<
      Array<{ systemId: string; accountName: string | null; companyName: string | null; bindMode: string | null; total: number; sent: number; delivered: number; failed: number }>
    >(
      Prisma.sql`
        SELECT co.name AS "systemId",
               co.name AS "companyName",
               NULL::text AS "accountName",
               NULL::text AS "bindMode",
               count(*)::int AS total,
               count(*) FILTER (WHERE m.status IN ('sent','submitted'))::int AS sent,
               count(*) FILTER (WHERE m.status = 'delivered')::int AS delivered,
               count(*) FILTER (WHERE m.status = 'failed')::int AS failed
        FROM sms_messages m
        JOIN companies co ON co.id = m.customer_id
        ${whereSql}
        GROUP BY co.id, co.name
        ORDER BY total DESC
        LIMIT 50`
    );

    const bound = new Set<string>();
    try {
      const raw = fs.readFileSync("/tmp/smpp-server-status.json", "utf-8");
      const js = JSON.parse(raw) as { bound_clients?: Array<{ system_id?: string }> };
      for (const b of js.bound_clients || []) if (b.system_id) bound.add(String(b.system_id));
    } catch {}
    const perAccount = perAccountRaw.map((r) => ({ ...r, live: bound.has(r.systemId) }));

    const dc: Prisma.Sql[] = [];
    if (accountId) dc.push(Prisma.sql`m.customer_account_id = ${parseInt(accountId, 10)}`);
    if (dateFrom) dc.push(Prisma.sql`m.submitted_at >= ${new Date(dateFrom)}`);
    if (dateTo) dc.push(Prisma.sql`m.submitted_at <= ${new Date(dateTo + "T23:59:59.999Z")}`);
    if (!dateFrom && !dateTo) dc.push(Prisma.sql`m.submitted_at >= now() - interval '14 days'`);
    const dailyWhere = dc.length ? Prisma.sql`WHERE ${Prisma.join(dc, " AND ")}` : Prisma.empty;

    const daily = await prisma.$queryRaw<
      Array<{ day: string; total: number; delivered: number; failed: number; sent: number }>
    >(
      Prisma.sql`
        SELECT to_char(date_trunc('day', m.submitted_at AT TIME ZONE 'Asia/Kolkata'), 'DD Mon') AS day,
               count(*)::int AS total,
               count(*) FILTER (WHERE m.status = 'delivered')::int AS delivered,
               count(*) FILTER (WHERE m.status = 'failed')::int AS failed,
               count(*) FILTER (WHERE m.status IN ('sent','submitted'))::int AS sent
        FROM sms_messages m
        ${dailyWhere}
        GROUP BY date_trunc('day', m.submitted_at AT TIME ZONE 'Asia/Kolkata')
        ORDER BY date_trunc('day', m.submitted_at AT TIME ZONE 'Asia/Kolkata')`
    );

    const total = statusBreakdown.reduce((a, s) => a + s.count, 0);
    const delivered = statusBreakdown.find((s) => s.status === "delivered")?.count || 0;
    const failed = statusBreakdown.find((s) => s.status === "failed")?.count || 0;

    return Response.json({
      success: true,
      total,
      dlrPercent: total > 0 ? Math.round((delivered / total) * 10000) / 100 : 0,
      failPercent: total > 0 ? Math.round((failed / total) * 10000) / 100 : 0,
      statusBreakdown,
      perAccount,
      daily,
    });
  } catch (error) {
    console.error("Report summary error:", error);
    return Response.json({ success: false, error: "Failed to fetch summary" }, { status: 500 });
  }
}
