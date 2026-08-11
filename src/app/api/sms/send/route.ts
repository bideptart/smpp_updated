import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import {
  validatePhoneNumber,
  detectEncoding,
  generateMessageId,
} from "@/lib/sms-engine";
import { getSessionUser, canMutate } from "@/lib/user-scope";
import { checkContentFilters } from "@/lib/content-filter";
import { pickWeightedRoute } from "@/lib/route-failover";

export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const { companyId, senderId, destination, message, routeId } = body;

    if (!companyId || !destination || !message) {
      return Response.json(
        { success: false, error: "Company, destination, and message are required" },
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

    const validation = validatePhoneNumber(destination);
    if (!validation.valid) {
      return Response.json(
        {
          success: false,
          error: `Invalid phone number: ${validation.error}`,
          destination,
        },
        { status: 400 }
      );
    }

    const normalizedDest = validation.normalized;

    // Find route: specific routeId or auto-select by customer + destination
    // prefix + priority, with a weighted-random pick among same-priority
    // vendors (e.g. two routes both at priority 1 for the same country
    // split real traffic across vendors by their configured weight).
    let selectedRoute;
    if (routeId) {
      selectedRoute = await prisma.route.findUnique({
        where: { id: parseInt(routeId, 10) },
      });
    } else {
      const candidateRoutes = await prisma.route.findMany({
        where: {
          customerId: parseInt(companyId, 10),
          isActive: true,
        },
        orderBy: { priority: "asc" },
      });
      const matches = candidateRoutes.filter(
        (r) => r.numberPrefix === "" || normalizedDest.startsWith(r.numberPrefix)
      );
      selectedRoute = pickWeightedRoute(matches);
    }

    if (!selectedRoute) {
      return Response.json(
        {
          success: false,
          error: "No route configured for this destination — add one on the Routes page",
          destination,
        },
        { status: 400 }
      );
    }

    // Credit check: atomically deduct the customer's prepaid balance, same as
    // the raw-SMPP-bind path in smpp-server.ts. A free/promotional route
    // (cost 0) skips this entirely, matching that path's behavior too.
    const cost = Number(selectedRoute.sellingRate) || 0;
    if (cost > 0) {
      const deducted = await prisma.$executeRawUnsafe(
        `UPDATE companies SET balance = balance - $1 WHERE id = $2 AND balance >= $1`,
        cost,
        parseInt(companyId, 10)
      );
      if (deducted === 0) {
        return Response.json(
          { success: false, error: "Insufficient balance" },
          { status: 402 }
        );
      }
    }

    const { encoding, parts } = detectEncoding(message);
    const messageId = generateMessageId();

    const smsData: Record<string, unknown> = {
      messageId,
      customerId: parseInt(companyId, 10),
      senderId: senderId || "SMSLCL",
      destination: normalizedDest,
      messageText: message,
      encoding: encoding === "UCS2" ? "UCS2" : "GSM7",
      parts,
      status: "queued",
      routeId: selectedRoute.id,
      vendorId: selectedRoute.vendorId,
      sellingRate: selectedRoute.sellingRate,
      buyingRate: selectedRoute.buyingRate,
    };

    // Use raw SQL to ensure submitted_at uses server NOW() (correct timezone)
    await prisma.$executeRawUnsafe(`
      INSERT INTO sms_messages (message_id, customer_id, vendor_id, route_id, sender_id, destination, message_text, encoding, parts, status, selling_rate, buying_rate, submitted_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::\"SmsEncoding\", $9, $10::\"SmsStatus\", $11, $12, NOW())
    `,
      smsData.messageId,
      smsData.customerId,
      smsData.vendorId ?? null,
      smsData.routeId ?? null,
      smsData.senderId,
      smsData.destination,
      smsData.messageText,
      smsData.encoding === "UCS2" ? "UCS-2" : "GSM-7",
      smsData.parts,
      smsData.status,
      Number(smsData.sellingRate ?? 0),
      Number(smsData.buyingRate ?? 0),
    );

    return Response.json({
      success: true,
      messageId,
      status: "queued",
      destination: normalizedDest,
      parts,
      encoding,
    });
  } catch (error) {
    console.error("SMS send error:", error);
    return Response.json(
      { success: false, error: "Failed to send SMS" },
      { status: 500 }
    );
  }
}
