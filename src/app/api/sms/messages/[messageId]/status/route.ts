import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser } from "@/lib/user-scope";

type RouteContext = { params: Promise<{ messageId: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { messageId } = await context.params;
    const msg = await prisma.smsMessage.findUnique({
      where: { messageId },
      select: { status: true, errorMessage: true },
    });
    if (!msg) {
      return Response.json({ success: false, error: "Message not found" }, { status: 404 });
    }

    return Response.json({ success: true, data: msg });
  } catch (error) {
    console.error("Message status error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch message status" },
      { status: 500 }
    );
  }
}
