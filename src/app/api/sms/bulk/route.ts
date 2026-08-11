import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { Prisma, type Route } from "@/generated/prisma";
import {
  validatePhoneNumber,
  detectEncoding,
  generateMessageId,
} from "@/lib/sms-engine";
import { getSessionUser, canMutate } from "@/lib/user-scope";
import { checkContentFilters } from "@/lib/content-filter";
import { pickWeightedRoute } from "@/lib/route-failover";

const MAX_NUMBERS = 100000;
const CHUNK = 2000;

export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const { companyId, senderId, destinations, message, routeId, campaignName } = body;

    if (!companyId || !destinations || !message) {
      return Response.json(
        { success: false, error: "Company, destinations, and message are required" },
        { status: 400 }
      );
    }

    const contentCheck = await checkContentFilters(parseInt(companyId, 10), message);
    if (contentCheck.blocked) {
      return Response.json(
        { success: false, error: `Message blocked by content filter: "${contentCheck.keyword}"` },
        { status: 400 }
      );
    }

    const numbers: string[] = Array.isArray(destinations)
      ? destinations.map((n) => String(n).trim()).filter(Boolean)
      : String(destinations).split(/[,\n\r]+/).map((n: string) => n.trim()).filter(Boolean);

    if (numbers.length === 0) {
      return Response.json({ success: false, error: "No phone numbers provided" }, { status: 400 });
    }
    if (numbers.length > MAX_NUMBERS) {
      return Response.json(
        { success: false, error: `Maximum ${MAX_NUMBERS.toLocaleString()} numbers per request` },
        { status: 400 }
      );
    }

    const cid = parseInt(companyId, 10);

    // Route selection is per-destination, not one route for the whole
    // batch -- a campaign can span multiple countries, and within a single
    // country a weighted-random pick across same-priority vendor routes is
    // what actually produces a real 80/20-style volume split for a large
    // batch (an explicit routeId still bypasses all of this, same as
    // sms/send/route.ts's manual-override behavior).
    let explicitRoute: Route | null = null;
    let candidateRoutes: Route[] = [];
    if (routeId) {
      explicitRoute = await prisma.route.findUnique({ where: { id: parseInt(routeId, 10) } });
      if (!explicitRoute) {
        return Response.json({ success: false, error: "Route not found" }, { status: 404 });
      }
    } else {
      candidateRoutes = await prisma.route.findMany({
        where: { customerId: cid, isActive: true },
        orderBy: { priority: "asc" },
      });
      if (candidateRoutes.length === 0) {
        return Response.json(
          { success: false, error: "No route configured for this customer — add one on the Routes page" },
          { status: 400 }
        );
      }
    }

    // Validate numbers and resolve each one's route in the same pass so the
    // balance check reflects exactly what will actually be queued.
    let failed = 0;
    const routed: Array<{ normalized: string; route: Route }> = [];
    for (const num of numbers) {
      const v = validatePhoneNumber(num);
      if (!v.valid) {
        failed++;
        continue;
      }
      if (explicitRoute) {
        routed.push({ normalized: v.normalized, route: explicitRoute });
        continue;
      }
      const matches = candidateRoutes.filter(
        (r) => r.numberPrefix === "" || v.normalized.startsWith(r.numberPrefix)
      );
      const route = pickWeightedRoute(matches);
      if (!route) {
        failed++;
        continue;
      }
      routed.push({ normalized: v.normalized, route });
    }

    if (routed.length === 0) {
      return Response.json(
        { success: false, error: "No valid, routable numbers in this batch" },
        { status: 400 }
      );
    }

    // Credit check: pre-authorize the whole batch's cost in one atomic
    // deduction, summed per-message since different numbers can now land
    // on different vendors (and rates) within the same batch.
    const totalCost = routed.reduce((sum, r) => sum + (Number(r.route.sellingRate) || 0), 0);
    if (totalCost > 0) {
      const deducted = await prisma.$executeRawUnsafe(
        `UPDATE companies SET balance = balance - $1 WHERE id = $2 AND balance >= $1`,
        totalCost,
        cid
      );
      if (deducted === 0) {
        return Response.json(
          { success: false, error: "Insufficient balance" },
          { status: 402 }
        );
      }
    }

    const { encoding, parts } = detectEncoding(message);
    const enc = (encoding === "UCS2" ? "UCS2" : "GSM7") as "UCS2" | "GSM7";
    const sid = senderId || "SMSLCL";
    const now = new Date();

    // Create a campaign so this send can be paused / stopped individually
    const campaign = await prisma.campaign.create({
      data: {
        name:
          (campaignName && String(campaignName).trim()) ||
          `Campaign ${now.toISOString().slice(0, 16).replace("T", " ")}`,
        companyId: cid,
        senderId: sid,
        messageText: message,
        totalNumbers: numbers.length,
        status: "running",
        startedAt: now,
      },
    });

    const data: Prisma.SmsMessageCreateManyInput[] = routed.map(({ normalized, route }) => ({
      messageId: generateMessageId(),
      customerId: cid,
      senderId: sid,
      destination: normalized,
      messageText: message,
      encoding: enc,
      parts,
      status: "queued",
      submittedAt: now,
      campaignId: campaign.id,
      routeId: route.id,
      vendorId: route.vendorId,
      sellingRate: route.sellingRate,
      buyingRate: route.buyingRate,
    }));

    let queued = 0;
    for (let i = 0; i < data.length; i += CHUNK) {
      const res = await prisma.smsMessage.createMany({ data: data.slice(i, i + CHUNK) });
      queued += res.count;
    }
    await prisma.campaign.update({ where: { id: campaign.id }, data: { submitted: queued } });

    return Response.json({
      success: true,
      campaignId: campaign.id,
      total: numbers.length,
      queued,
      failed,
      results: [],
    });
  } catch (error) {
    console.error("Bulk SMS error:", error);
    return Response.json({ success: false, error: "Failed to send bulk SMS" }, { status: 500 });
  }
}
