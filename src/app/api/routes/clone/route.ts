import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

/**
 * Copies every active Route from one customer to another — e.g. to give a
 * new customer the same country/operator rate card an existing one has,
 * instead of re-entering it by hand or re-importing the same CSV. Skips any
 * row the target already has (same dedupe key used by the CSV import).
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const { sourceCustomerId, targetCustomerId } = body;

    if (!sourceCustomerId || !targetCustomerId) {
      return Response.json(
        { success: false, error: "sourceCustomerId and targetCustomerId are required" },
        { status: 400 }
      );
    }
    if (Number(sourceCustomerId) === Number(targetCustomerId)) {
      return Response.json(
        { success: false, error: "Source and target customer must be different" },
        { status: 400 }
      );
    }

    const sourceRoutes = await prisma.route.findMany({
      where: { customerId: Number(sourceCustomerId), isActive: true },
    });

    if (sourceRoutes.length === 0) {
      return Response.json(
        { success: false, error: "Source customer has no active routes to clone" },
        { status: 400 }
      );
    }

    const targetRoutes = await prisma.route.findMany({
      where: { customerId: Number(targetCustomerId) },
    });
    const existingKeys = new Set(
      targetRoutes.map((r) => `${r.vendorId}|${r.countryCode}|${r.numberPrefix}|${r.operatorName || ""}`)
    );

    // One shared batchId per clone request — lets the Routes page group these
    // as a single "rate card" row instead of N flat rows, without merging the
    // underlying per-country billing records (each still needs its own rate).
    const batchId = crypto.randomUUID();
    let cloned = 0;
    let skipped = 0;

    for (const r of sourceRoutes) {
      const key = `${r.vendorId}|${r.countryCode}|${r.numberPrefix}|${r.operatorName || ""}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }
      await prisma.route.create({
        data: {
          name: r.name,
          customerId: Number(targetCustomerId),
          vendorId: r.vendorId,
          countryCode: r.countryCode,
          numberPrefix: r.numberPrefix,
          operatorName: r.operatorName,
          sellingRate: r.sellingRate,
          buyingRate: r.buyingRate,
          priority: r.priority,
          weight: r.weight,
          isActive: true,
          batchId,
        },
      });
      existingKeys.add(key);
      cloned++;
    }

    return Response.json({ success: true, data: { cloned, skipped } });
  } catch (error) {
    console.error("Route clone error:", error);
    return Response.json({ success: false, error: "Failed to clone routes" }, { status: 500 });
  }
}
