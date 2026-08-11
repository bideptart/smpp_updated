import prisma from "@/lib/db";
import { getSessionUser } from "@/lib/user-scope";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const invoiceId = parseInt(id, 10);
    if (isNaN(invoiceId)) {
      return Response.json({ success: false, error: "Invalid invoice ID" }, { status: 400 });
    }

    const invoice = await prisma.trafficSummary.findUnique({
      where: { id: invoiceId },
      include: { company: { select: { name: true } } },
    });
    if (!invoice) {
      return Response.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    // Daily line items for the period, computed fresh from sms_messages —
    // the invoice row stores the totals, this recomputes the breakdown.
    const rows = await prisma.$queryRawUnsafe<
      { day: Date; submitted: bigint; delivered: bigint; failed: bigint; revenue: string; cost: string }[]
    >(
      `SELECT date_trunc('day', submitted_at) AS day,
              count(*) AS submitted,
              count(*) FILTER (WHERE status = 'delivered') AS delivered,
              count(*) FILTER (WHERE status = 'failed') AS failed,
              COALESCE(SUM(selling_rate), 0) AS revenue,
              COALESCE(SUM(buying_rate), 0) AS cost
       FROM sms_messages
       WHERE customer_id = $1 AND submitted_at >= $2 AND submitted_at <= $3
       GROUP BY day
       ORDER BY day`,
      invoice.companyId,
      invoice.periodStart,
      invoice.periodEnd
    );

    const lines = [
      "Date,Submitted,Delivered,Failed,Revenue,Cost,Margin",
      ...rows.map((r) => {
        const revenue = Number(r.revenue);
        const cost = Number(r.cost);
        return [
          r.day.toISOString().slice(0, 10),
          r.submitted.toString(),
          r.delivered.toString(),
          r.failed.toString(),
          revenue.toFixed(4),
          cost.toFixed(4),
          (revenue - cost).toFixed(4),
        ].join(",");
      }),
      "",
      `Total,${invoice.submitted},${invoice.delivered},${invoice.failed},${Number(invoice.revenue).toFixed(4)},${Number(invoice.cost).toFixed(4)},${(Number(invoice.revenue) - Number(invoice.cost)).toFixed(4)}`,
    ];

    const csv = lines.join("\n");
    const filename = `statement-${csvEscape(invoice.company.name).replace(/[^a-z0-9-]/gi, "_")}-${invoice.periodStart.toISOString().slice(0, 10)}.csv`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Invoice export error:", error);
    return Response.json({ success: false, error: "Failed to export invoice" }, { status: 500 });
  }
}
