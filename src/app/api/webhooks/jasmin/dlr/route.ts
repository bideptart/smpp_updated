import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { isLocalRequest } from "@/lib/request-guards";

const JASMIN_DLR_SECRET = process.env.JASMIN_DLR_SECRET || "";

// Jasmin's terminal DLR status values that count as a successful delivery.
const DELIVERED_STATUSES = new Set(["DELIVRD"]);

/**
 * Jasmin's dlr-thrower calls this URL (configured per-message via the
 * dlr-url param on /send) when a delivery receipt arrives. Only Jasmin
 * itself — running on the same host — should ever call this.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const msgId = searchParams.get("msgId");
  const token = searchParams.get("token");

  if (!token || token !== JASMIN_DLR_SECRET || !isLocalRequest(req)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!msgId) {
    return Response.json({ success: false, error: "Missing msgId" }, { status: 400 });
  }

  const status =
    searchParams.get("message_status") ||
    searchParams.get("status") ||
    searchParams.get("stat") ||
    "";
  const isDelivered = DELIVERED_STATUSES.has(status.toUpperCase());

  try {
    await prisma.smsMessage.update({
      where: { messageId: msgId },
      data: {
        status: isDelivered ? "delivered" : "failed",
        deliveredAt: isDelivered ? new Date() : undefined,
        dlrReceivedAt: new Date(),
        errorMessage: isDelivered ? null : status.slice(0, 250) || "DLR: not delivered",
      },
    });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Jasmin DLR webhook error:", error);
    // Message may not exist (e.g. stale/duplicate callback) — still 200 so
    // Jasmin doesn't retry indefinitely.
    return Response.json({ success: false, error: "Message not found" }, { status: 200 });
  }
}
