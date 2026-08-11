import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser } from "@/lib/user-scope";

export async function GET(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const customerId = req.nextUrl.searchParams.get("customerId");
    const where: Record<string, unknown> = {};
    if (customerId) where.customerId = parseInt(customerId, 10);

    const messages = await prisma.inboundMessage.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: 200,
    });

    const customerIds = [...new Set(messages.map((m) => m.customerId).filter((id): id is number => id !== null))];
    const companies = customerIds.length
      ? await prisma.company.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(companies.map((c) => [c.id, c.name]));

    return Response.json({
      success: true,
      data: messages.map((m) => ({
        id: m.id,
        fromAddr: m.fromAddr,
        toAddr: m.toAddr,
        messageText: m.messageText,
        customerId: m.customerId,
        customerName: m.customerId ? nameById.get(m.customerId) || null : null,
        receivedAt: m.receivedAt,
      })),
    });
  } catch (error) {
    console.error("Inbound messages list error:", error);
    return Response.json({ success: false, error: "Failed to fetch inbound messages" }, { status: 500 });
  }
}
