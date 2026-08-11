import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { isLocalRequest } from "@/lib/request-guards";

const JASMIN_MO_SECRET = process.env.JASMIN_DLR_SECRET || "";

/**
 * Jasmin's deliversm-thrower calls this URL (configured once on an httpccm
 * HTTP connector, not per-message like the DLR callback) whenever an
 * inbound MO message is routed to it. Posts form-urlencoded from/to/content.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || token !== JASMIN_MO_SECRET || !isLocalRequest(req)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = new URLSearchParams(await req.text());
    const fromAddr = body.get("from") || "";
    const toAddr = body.get("to") || "";
    const messageText = body.get("content") || null;

    if (!fromAddr || !toAddr) {
      return Response.json({ success: false, error: "Missing from/to" }, { status: 400 });
    }

    const account = await prisma.customerSmppAccount.findFirst({
      where: { sourceAddr: toAddr },
      select: { companyId: true },
    });

    await prisma.inboundMessage.create({
      data: {
        fromAddr,
        toAddr,
        messageText,
        customerId: account?.companyId || null,
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Jasmin MO webhook error:", error);
    return Response.json({ success: false, error: "Failed to process inbound message" }, { status: 500 });
  }
}
