import prisma from "@/lib/db";
import { getSessionUser } from "@/lib/user-scope";

interface CampaignRow {
  id: number;
  name: string | null;
  status: string;
  createdAt: Date;
  customer: string;
  senderId: string | null;
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
}

export async function GET() {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await prisma.$queryRawUnsafe<CampaignRow[]>(`
      SELECT c.id,
             c.name,
             c.status::text AS status,
             c.created_at AS "createdAt",
             COALESCE(co.name, '-') AS customer,
             c.sender_id AS "senderId",
             count(m.id)::int AS total,
             count(*) FILTER (WHERE m.status = 'queued')::int AS queued,
             count(*) FILTER (WHERE m.status IN ('sent','submitted'))::int AS sent,
             count(*) FILTER (WHERE m.status = 'delivered')::int AS delivered,
             count(*) FILTER (WHERE m.status = 'failed')::int AS failed
      FROM campaigns c
      LEFT JOIN sms_messages m ON m.campaign_id = c.id
      LEFT JOIN companies co ON co.id = c.company_id
      GROUP BY c.id, c.name, c.status, c.created_at, co.name, c.sender_id
      ORDER BY c.created_at DESC
      LIMIT 200
    `);
    return Response.json({ success: true, data: rows });
  } catch (error) {
    console.error("Campaigns list error:", error);
    return Response.json({ success: false, error: "Failed to fetch campaigns" }, { status: 500 });
  }
}
