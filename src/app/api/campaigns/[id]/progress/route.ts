import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser } from "@/lib/user-scope";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const campaignId = parseInt(id, 10);
    if (isNaN(campaignId)) {
      return Response.json({ success: false, error: "Invalid campaign ID" }, { status: 400 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { totalNumbers: true },
    });
    if (!campaign) {
      return Response.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    const grouped = await prisma.smsMessage.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: { _all: true },
    });

    const counts: Record<string, number> = {};
    for (const g of grouped) counts[g.status] = g._count._all;

    // Non-overlapping partition of the batch -- these four always sum to
    // `total`, which is what makes the progress bar and stat tiles add up.
    const pending = (counts.queued || 0) + (counts.sending || 0);
    const sent = (counts.submitted || 0) + (counts.sent || 0); // left our system, DLR not back yet
    const delivered = counts.delivered || 0;
    const failed = counts.failed || 0;

    return Response.json({
      success: true,
      data: {
        total: campaign.totalNumbers,
        pending,
        sent,
        delivered,
        failed,
        done: pending === 0,
      },
    });
  } catch (error) {
    console.error("Campaign progress error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch campaign progress" },
      { status: 500 }
    );
  }
}
