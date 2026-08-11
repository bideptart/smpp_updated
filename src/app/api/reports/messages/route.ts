import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { getSessionUser } from "@/lib/user-scope";

export async function GET(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const sp = req.nextUrl.searchParams;
    const accountId = sp.get("accountId");
    const customerId = sp.get("customerId");
    const vendorId = sp.get("vendorId");
    const routeId = sp.get("routeId");
    const status = sp.get("status");
    const dateFrom = sp.get("dateFrom");
    const dateTo = sp.get("dateTo");
    const sender = sp.get("sender");
    const destination = sp.get("destination");
    const errorCode = sp.get("errorCode");
    const search = sp.get("search");
    const sortField = sp.get("sort") || "submittedAt";
    const sortOrder = sp.get("order") === "asc" ? "asc" : "desc";
    const page = parseInt(sp.get("page") || "1", 10);
    const limit = Math.min(parseInt(sp.get("limit") || "25", 10), 500);
    const skip = (page - 1) * limit;

    const where: Prisma.SmsMessageWhereInput = {};
    if (accountId) where.customerAccountId = parseInt(accountId, 10);
    if (customerId) where.customerId = parseInt(customerId, 10);
    if (vendorId) where.vendorId = parseInt(vendorId, 10);
    if (routeId) where.routeId = parseInt(routeId, 10);
    if (status) where.status = status as Prisma.EnumSmsStatusFilter["equals"];
    if (errorCode) where.errorCode = errorCode;
    if (dateFrom || dateTo) {
      where.submittedAt = {};
      if (dateFrom) (where.submittedAt as Prisma.DateTimeFilter).gte = new Date(dateFrom);
      if (dateTo) (where.submittedAt as Prisma.DateTimeFilter).lte = dateTo.length <= 10 ? new Date(dateTo + "T23:59:59.999Z") : new Date(dateTo);
    }
    if (sender) where.senderId = { contains: sender, mode: "insensitive" };
    if (destination) where.destination = { contains: destination };
    if (search) {
      where.OR = [
        { destination: { contains: search } },
        { messageId: { contains: search } },
        { senderId: { contains: search } },
      ];
    }

    const allowedSort: Record<string, string> = { submittedAt: "submittedAt", deliveredAt: "deliveredAt", sentAt: "sentAt", status: "status", destination: "destination", senderId: "senderId", parts: "parts", sellingRate: "sellingRate" };
    const orderBy = { [allowedSort[sortField] || "submittedAt"]: sortOrder };

    const [messages, total, statuses] = await Promise.all([
      prisma.smsMessage.findMany({
        where, take: limit, skip, orderBy,
        include: {
          customer: { select: { name: true } },
          vendor: { select: { name: true } },
          customerAccount: { select: { systemId: true, accountName: true } },
          route: { select: { name: true } },
        },
      }),
      prisma.smsMessage.count({ where }),
      prisma.smsMessage.groupBy({ by: ["status"], where, _count: { _all: true } }),
    ]);

    const statusBreakdown = Object.fromEntries(statuses.map(s => [s.status, s._count._all]));
    const totalDelivered = statusBreakdown["delivered"] || 0;
    const totalFailed = statusBreakdown["failed"] || 0;
    const dlrPercent = total > 0 ? Math.round((totalDelivered / total) * 10000) / 100 : 0;

    const revenueResult = await prisma.smsMessage.aggregate({ where, _sum: { sellingRate: true, buyingRate: true }, _avg: { sellingRate: true, buyingRate: true } });
    const totalRevenue = Number(revenueResult._sum.sellingRate || 0);
    const totalCost = Number(revenueResult._sum.buyingRate || 0);

    return Response.json({
      success: true,
      data: messages.map(m => ({
        id: m.id,
        messageId: m.messageId,
        customerName: m.customer?.name,
        vendorName: (m as unknown as Record<string, Record<string, string>>).vendor?.name,
        accountName: m.customerAccount?.accountName || m.customerAccount?.systemId,
        routeName: m.route?.name,
        senderId: m.senderId,
        destination: m.destination,
        status: m.status,
        parts: m.parts,
        encoding: m.encoding,
        errorCode: m.errorCode,
        errorMessage: m.errorMessage,
        sellingRate: m.sellingRate,
        buyingRate: m.buyingRate,
        submittedAt: m.submittedAt,
        sentAt: m.sentAt,
        deliveredAt: m.deliveredAt,
        dlrReceivedAt: m.dlrReceivedAt,
        sourceIp: m.sourceIp,
        campaignId: m.campaignId,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: { total, delivered: totalDelivered, failed: totalFailed, dlrPercent, revenue: totalRevenue, cost: totalCost, profit: totalRevenue - totalCost, breakdown: statusBreakdown },
    });
  } catch (e) {
    console.error(e);
    return Response.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
