import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { getSessionUser } from "@/lib/user-scope";

export async function GET(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const sp = req.nextUrl.searchParams;
    const customerId = sp.get("customerId");
    const vendorId = sp.get("vendorId");
    const sender = sp.get("sender");
    const status = sp.get("status");
    const dateFrom = sp.get("dateFrom");
    const dateTo = sp.get("dateTo");
    const search = sp.get("search");

    const conds: Prisma.Sql[] = [];
    if (customerId) conds.push(Prisma.sql`m.customer_id = ${parseInt(customerId, 10)}`);
    if (vendorId) conds.push(Prisma.sql`m.vendor_id = ${parseInt(vendorId, 10)}`);
    if (sender) conds.push(Prisma.sql`m.sender_id ILIKE ${"%" + sender + "%"}`);
    if (status) conds.push(Prisma.sql`m.status::text = ${status}`);
    if (search) conds.push(Prisma.sql`(m.destination ILIKE ${"%" + search + "%"} OR m.message_id ILIKE ${"%" + search + "%"})`);
    if (dateFrom) conds.push(Prisma.sql`m.submitted_at >= ${new Date(dateFrom)}`);
    if (dateTo) conds.push(Prisma.sql`m.submitted_at <= ${dateTo.length <= 10 ? new Date(dateTo + "T23:59:59.999Z") : new Date(dateTo)}`);
    const where = conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, " AND ")}` : Prisma.empty;

    const statusBreakdown = await prisma.$queryRaw<Array<{ status: string; count: number }>>(
      Prisma.sql`SELECT m.status::text AS status, count(*)::int AS count FROM sms_messages m ${where} GROUP BY m.status ORDER BY count DESC`
    );

    const byCustomer = await prisma.$queryRaw<Array<{ id: number; name: string; total: number; sent: number; delivered: number; failed: number; queued: number; avgRate: number }>>(
      Prisma.sql`
        SELECT co.id, co.name,
               count(*)::int AS total,
               count(*) FILTER (WHERE m.status IN ('sent','submitted'))::int AS sent,
               count(*) FILTER (WHERE m.status = 'delivered')::int AS delivered,
               count(*) FILTER (WHERE m.status = 'failed')::int AS failed,
               count(*) FILTER (WHERE m.status IN ('queued','sending'))::int AS queued,
               COALESCE(AVG(m.selling_rate), 0)::float AS "avgRate"
        FROM sms_messages m JOIN companies co ON co.id = m.customer_id
        ${where}
        GROUP BY co.id, co.name ORDER BY total DESC LIMIT 500`
    );

    const byVendor = await prisma.$queryRaw<Array<{ id: number; name: string; total: number; sent: number; delivered: number; failed: number; queued: number; avgRate: number }>>(
      Prisma.sql`
        SELECT co.id, co.name,
               count(*)::int AS total,
               count(*) FILTER (WHERE m.status IN ('sent','submitted'))::int AS sent,
               count(*) FILTER (WHERE m.status = 'delivered')::int AS delivered,
               count(*) FILTER (WHERE m.status = 'failed')::int AS failed,
               count(*) FILTER (WHERE m.status IN ('queued','sending'))::int AS queued,
               COALESCE(AVG(m.buying_rate), 0)::float AS "avgRate"
        FROM sms_messages m JOIN companies co ON co.id = m.vendor_id
        ${where}
        GROUP BY co.id, co.name ORDER BY total DESC LIMIT 500`
    );

    // daily trend (respect filters, else last 14 days)
    const dconds = [...conds];
    if (!dateFrom && !dateTo) dconds.push(Prisma.sql`m.submitted_at >= now() - interval '14 days'`);
    const dwhere = dconds.length ? Prisma.sql`WHERE ${Prisma.join(dconds, " AND ")}` : Prisma.empty;
    const daily = await prisma.$queryRaw<Array<{ day: string; total: number; delivered: number; failed: number; sent: number }>>(
      Prisma.sql`
        SELECT to_char(date_trunc('day', m.submitted_at AT TIME ZONE 'Asia/Kolkata'), 'DD Mon') AS day,
               count(*)::int AS total,
               count(*) FILTER (WHERE m.status = 'delivered')::int AS delivered,
               count(*) FILTER (WHERE m.status = 'failed')::int AS failed,
               count(*) FILTER (WHERE m.status IN ('sent','submitted'))::int AS sent
        FROM sms_messages m ${dwhere}
        GROUP BY date_trunc('day', m.submitted_at AT TIME ZONE 'Asia/Kolkata')
        ORDER BY date_trunc('day', m.submitted_at AT TIME ZONE 'Asia/Kolkata')`
    );

    const t: Record<string, number> = { total: 0, queued: 0, sending: 0, sent: 0, submitted: 0, delivered: 0, failed: 0 };
    statusBreakdown.forEach((s) => { t[s.status] = s.count; t.total += s.count; });
    const totals = {
      total: t.total,
      queued: t.queued + t.sending,
      sent: t.sent + t.submitted,
      delivered: t.delivered,
      failed: t.failed,
      dlrPercent: t.total ? Math.round((t.delivered / t.total) * 10000) / 100 : 0,
    };

    return Response.json({ success: true, totals, statusBreakdown, daily, byCustomer, byVendor });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    return Response.json({ success: false, error: "Failed to fetch dashboard" }, { status: 500 });
  }
}
