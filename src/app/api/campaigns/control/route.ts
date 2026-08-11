import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const { id, action } = await req.json();
    const cid = parseInt(String(id), 10);
    if (!cid || !["pause", "resume", "stop"].includes(action)) {
      return Response.json({ success: false, error: "Invalid request" }, { status: 400 });
    }

    if (action === "pause") {
      await prisma.$executeRawUnsafe(`UPDATE campaigns SET status = 'paused' WHERE id = $1`, cid);
    } else if (action === "resume") {
      await prisma.$executeRawUnsafe(`UPDATE campaigns SET status = 'running' WHERE id = $1`, cid);
    } else if (action === "stop") {
      // Cancel remaining queued messages, then mark the campaign cancelled
      await prisma.$executeRawUnsafe(
        `UPDATE sms_messages SET status = 'failed', error_message = 'Cancelled by campaign stop' WHERE campaign_id = $1 AND status = 'queued'`,
        cid
      );
      await prisma.$executeRawUnsafe(
        `UPDATE campaigns SET status = 'cancelled', completed_at = NOW() WHERE id = $1`,
        cid
      );
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error("Campaign control error:", error);
    return Response.json({ success: false, error: "Failed to update campaign" }, { status: 500 });
  }
}
