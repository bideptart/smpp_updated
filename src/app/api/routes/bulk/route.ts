import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

/**
 * Applies one customer+vendor rate plan to many countries in a single
 * request — either the same rate for every country ("select all A-Z"), or a
 * distinct rate per country when an entry carries its own sellingRate/
 * buyingRate (falls back to the top-level rate when it doesn't). Same
 * upsert semantics as /api/routes/import (dedupe on customerId+vendorId+
 * countryCode+numberPrefix+operatorName, update in place instead of
 * duplicating).
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const { customerId, vendorId, operatorName, sellingRate, buyingRate, priority, weight, isActive, entries } = body;

    if (!customerId || !vendorId || !Array.isArray(entries) || entries.length === 0) {
      return Response.json(
        { success: false, error: "Customer, vendor, and at least one country are required" },
        { status: 400 }
      );
    }

    const [customer, vendor] = await Promise.all([
      prisma.company.findUnique({ where: { id: parseInt(customerId, 10) }, select: { id: true, name: true } }),
      prisma.company.findUnique({ where: { id: parseInt(vendorId, 10) }, select: { id: true, name: true } }),
    ]);
    if (!customer) return Response.json({ success: false, error: "Customer not found" }, { status: 404 });
    if (!vendor) return Response.json({ success: false, error: "Vendor not found" }, { status: 404 });

    const opName = operatorName || null;
    const defaultSell = Number(sellingRate) || 0;
    const defaultBuy = Number(buyingRate) || 0;
    const pr = priority ? parseInt(String(priority), 10) : 1;
    const wt = weight ? parseInt(String(weight), 10) : 100;
    const active = isActive ?? true;
    // One shared batchId per request — lets the Routes page group these as a
    // single "rate card" row instead of N flat rows, without merging the
    // underlying per-country billing records (each still needs its own rate).
    const batchId = crypto.randomUUID();

    let created = 0;
    let updated = 0;

    for (const entry of entries) {
      const countryCode = String(entry?.countryCode || "").trim();
      if (!countryCode) continue;
      const numberPrefix = String(entry?.numberPrefix ?? countryCode).trim();
      const sell = entry?.sellingRate !== undefined && entry?.sellingRate !== null
        ? Number(entry.sellingRate) || 0
        : defaultSell;
      const buy = entry?.buyingRate !== undefined && entry?.buyingRate !== null
        ? Number(entry.buyingRate) || 0
        : defaultBuy;

      const existing = await prisma.route.findFirst({
        where: {
          customerId: customer.id,
          vendorId: vendor.id,
          countryCode,
          numberPrefix,
          operatorName: opName,
        },
      });

      if (existing) {
        await prisma.route.update({
          where: { id: existing.id },
          data: { sellingRate: sell, buyingRate: buy, priority: pr, weight: wt, isActive: active },
        });
        updated++;
      } else {
        await prisma.route.create({
          data: {
            name: `${countryCode}${opName ? ` ${opName}` : ""} ${customer.name} → ${vendor.name}`,
            customerId: customer.id,
            vendorId: vendor.id,
            countryCode,
            numberPrefix,
            operatorName: opName,
            sellingRate: sell,
            buyingRate: buy,
            priority: pr,
            weight: wt,
            isActive: active,
            batchId,
          },
        });
        created++;
      }
    }

    return Response.json({ success: true, data: { created, updated, total: entries.length } });
  } catch (error) {
    console.error("Bulk route create error:", error);
    return Response.json({ success: false, error: "Failed to create bulk routes" }, { status: 500 });
  }
}
