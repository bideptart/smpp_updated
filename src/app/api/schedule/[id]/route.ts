import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const campaign = await prisma.scheduledCampaign.findUnique({
      where: { id: parseInt(id) },
    });
    if (!campaign) return Response.json({ success: false, error: "Not found" }, { status: 404 });
    return Response.json({ success: true, data: campaign });
  } catch (error) {
    console.error("Schedule get error:", error);
    return Response.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { action, messageText, scheduledAt, timezone, repeatFreq, senderId } = body;

    const data: Record<string, unknown> = {};

    // Action-based updates
    if (action === "pause") {
      data.status = "paused";
    } else if (action === "resume") {
      data.status = "pending";
    } else if (action === "cancel") {
      data.status = "cancelled";
    } else {
      // Edit mode
      if (messageText !== undefined) data.messageText = messageText;
      if (senderId !== undefined) data.senderId = senderId;
      if (timezone !== undefined) data.timezone = timezone;
      if (repeatFreq !== undefined) data.repeatFreq = repeatFreq;
      if (scheduledAt !== undefined) {
        const d = new Date(scheduledAt);
        if (!isNaN(d.getTime())) {
          data.scheduledAt = d;
          data.nextRunAt = d;
        }
      }
    }

    const updated = await prisma.scheduledCampaign.update({
      where: { id: parseInt(id) },
      data,
    });
    return Response.json({ success: true, data: updated });
  } catch (error) {
    console.error("Schedule update error:", error);
    return Response.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const { id } = await params;
    await prisma.scheduledCampaign.update({
      where: { id: parseInt(id) },
      data: { status: "cancelled" },
    });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Schedule cancel error:", error);
    return Response.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
