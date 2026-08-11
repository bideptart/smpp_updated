import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

export async function GET(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const customerId = req.nextUrl.searchParams.get("customerId");
    const where: Record<string, unknown> = { companyType: "customer" };
    if (customerId) where.companyId = parseInt(customerId, 10);

    const invoices = await prisma.trafficSummary.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { company: { select: { name: true } } },
    });

    return Response.json({
      success: true,
      data: invoices.map((i) => ({
        id: Number(i.id),
        customerId: i.companyId,
        customerName: i.company.name,
        periodStart: i.periodStart,
        periodEnd: i.periodEnd,
        submitted: i.submitted,
        delivered: i.delivered,
        failed: i.failed,
        revenue: Number(i.revenue),
        cost: Number(i.cost),
        margin: Number(i.revenue) - Number(i.cost),
        status: i.status,
        createdAt: i.createdAt,
      })),
    });
  } catch (error) {
    console.error("Invoices list error:", error);
    return Response.json({ success: false, error: "Failed to fetch invoices" }, { status: 500 });
  }
}

/**
 * Generates a usage statement for a prepaid customer over a period — a
 * reconciliation of what was consumed against their balance (already
 * deducted at send time), not a new charge. Reuses the same revenue/cost
 * aggregation already used by the live reports dashboard.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const { customerId, periodStart, periodEnd } = body;

    if (!customerId || !periodStart || !periodEnd) {
      return Response.json(
        { success: false, error: "customerId, periodStart, and periodEnd are required" },
        { status: 400 }
      );
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    if (end <= start) {
      return Response.json({ success: false, error: "periodEnd must be after periodStart" }, { status: 400 });
    }

    const where = {
      customerId: parseInt(customerId, 10),
      submittedAt: { gte: start, lte: end },
    };

    const [statuses, agg] = await Promise.all([
      prisma.smsMessage.groupBy({ by: ["status"], where, _count: { _all: true } }),
      prisma.smsMessage.aggregate({ where, _sum: { sellingRate: true, buyingRate: true }, _count: { _all: true } }),
    ]);

    const breakdown = Object.fromEntries(statuses.map((s) => [s.status, s._count._all]));
    const submitted = agg._count._all;
    const delivered = breakdown["delivered"] || 0;
    const failed = breakdown["failed"] || 0;
    const sent = breakdown["sent"] || 0;
    const revenue = Number(agg._sum.sellingRate || 0);
    const cost = Number(agg._sum.buyingRate || 0);

    const invoice = await prisma.trafficSummary.create({
      data: {
        companyId: parseInt(customerId, 10),
        companyType: "customer",
        periodStart: start,
        periodEnd: end,
        submitted,
        sent,
        delivered,
        failed,
        rejected: 0,
        revenue,
        cost,
        status: "draft",
      },
    });

    return Response.json({ success: true, data: { id: Number(invoice.id) } }, { status: 201 });
  } catch (error) {
    console.error("Invoice generate error:", error);
    return Response.json({ success: false, error: "Failed to generate invoice" }, { status: 500 });
  }
}
