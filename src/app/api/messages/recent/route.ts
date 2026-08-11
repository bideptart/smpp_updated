import prisma from "@/lib/db";
import { getSessionUser } from "@/lib/user-scope";

export async function GET() {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const messages = await prisma.smsMessage.findMany({
      take: 50,
      orderBy: { submittedAt: "desc" },
      include: {
        customer: { select: { name: true } },
        route: { select: { name: true } },
      },
    });

    const data = messages.map((m) => ({
      id: m.id.toString(),
      messageId: m.messageId,
      customerName: m.customer?.name || "-",
      routeName: m.route?.name || "-",
      senderId: m.senderId,
      destination: m.destination,
      encoding: m.encoding,
      parts: m.parts,
      status: m.status,
      submittedAt: m.submittedAt,
      deliveredAt: m.deliveredAt,
    }));

    return Response.json({ success: true, data });
  } catch (error) {
    console.error("Recent messages error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
