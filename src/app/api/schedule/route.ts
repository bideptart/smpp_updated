import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const customerId = searchParams.get("customerId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (customerId) where.customerId = parseInt(customerId);
    if (status) where.status = status;
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      where.scheduledAt = dateFilter;
    }

    const campaigns = await prisma.scheduledCampaign.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
    });

    return Response.json({ success: true, data: campaigns });
  } catch (error) {
    console.error("Schedule list error:", error);
    return Response.json({ success: false, error: "Failed to list" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const {
      customerId,
      senderId,
      routeId,
      messageText,
      encoding,
      recipients, // array of {phone, firstName?, lastName?}
      scheduledAt,
      timezone,
      repeatFreq,
    } = body;

    if (!customerId || !messageText || !Array.isArray(recipients) || recipients.length === 0 || !scheduledAt) {
      return Response.json(
        { success: false, error: "customerId, messageText, recipients, scheduledAt required" },
        { status: 400 }
      );
    }

    const scheduled = new Date(scheduledAt);
    if (isNaN(scheduled.getTime())) {
      return Response.json({ success: false, error: "Invalid scheduledAt date" }, { status: 400 });
    }

    const campaign = await prisma.scheduledCampaign.create({
      data: {
        customerId: parseInt(customerId),
        senderId: senderId || "SMSLCL",
        routeId: routeId ? parseInt(routeId) : null,
        messageText,
        encoding: encoding === "UCS2" ? "UCS2" : "GSM7",
        recipientsJson: recipients,
        recipientsCount: recipients.length,
        scheduledAt: scheduled,
        timezone: timezone || "Asia/Kolkata",
        repeatFreq: repeatFreq || "none",
        nextRunAt: scheduled,
        status: "pending",
      },
    });

    return Response.json({ success: true, data: campaign }, { status: 201 });
  } catch (error) {
    console.error("Schedule create error:", error);
    return Response.json({ success: false, error: "Failed to schedule" }, { status: 500 });
  }
}
