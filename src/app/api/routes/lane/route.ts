import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

/**
 * Saves one full "lane" (customer + country + prefix + operator) at once:
 * every vendor allocation serving that lane, each with its own rate and a
 * weight% that together must sum to exactly 100. This is the wholesale-
 * platform-shaped replacement for creating/editing one Route row at a time
 * -- a lane with one vendor is just a single 100%-weighted allocation, and
 * a lane split across N vendors is N allocations whose weights add up to
 * the real traffic split (e.g. 80 + 20).
 *
 * Any vendor previously on this lane but missing from the submitted
 * allocations is removed from it -- deleted if it has no message history,
 * deactivated otherwise (same rule already used by DELETE /api/routes/[id]).
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const { customerId, countryCode, numberPrefix, operatorName, priority, isActive, allocations } = body;

    if (!customerId || !countryCode || !Array.isArray(allocations) || allocations.length === 0) {
      return Response.json(
        { success: false, error: "Customer, country, and at least one vendor allocation are required" },
        { status: 400 }
      );
    }

    for (const a of allocations) {
      if (!a?.vendorId) {
        return Response.json({ success: false, error: "Every allocation needs a vendor selected" }, { status: 400 });
      }
    }

    const totalWeight = allocations.reduce((sum: number, a: { weight?: number }) => sum + (Number(a.weight) || 0), 0);
    if (Math.round(totalWeight) !== 100) {
      return Response.json(
        { success: false, error: `Vendor allocation must total 100% — currently ${totalWeight}%` },
        { status: 400 }
      );
    }

    const cid = parseInt(customerId, 10);
    const prefix = (numberPrefix ?? countryCode) || "";
    const opName = operatorName || null;
    const pr = priority ? parseInt(String(priority), 10) : 1;
    const active = isActive ?? true;

    const customer = await prisma.company.findUnique({ where: { id: cid }, select: { id: true, name: true } });
    if (!customer) return Response.json({ success: false, error: "Customer not found" }, { status: 404 });

    const vendorIds = [...new Set(allocations.map((a: { vendorId: number | string }) => parseInt(String(a.vendorId), 10)))];
    const vendors = await prisma.company.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } });
    const vendorById = new Map(vendors.map((v) => [v.id, v]));
    for (const vid of vendorIds) {
      if (!vendorById.has(vid)) {
        return Response.json({ success: false, error: `Vendor ${vid} not found` }, { status: 404 });
      }
    }

    const existing = await prisma.route.findMany({
      where: { customerId: cid, countryCode, numberPrefix: prefix, operatorName: opName },
      include: { _count: { select: { messages: true } } },
    });

    const batchId = existing.find((r) => r.batchId)?.batchId || crypto.randomUUID();
    const keepIds = new Set<number>();
    const saved: { id: number }[] = [];

    for (const a of allocations) {
      const vendorId = parseInt(String(a.vendorId), 10);
      const vendor = vendorById.get(vendorId)!;
      const sellingRate = Number(a.sellingRate) || 0;
      const buyingRate = Number(a.buyingRate) || 0;
      const weight = Math.round(Number(a.weight)) || 0;
      const name = `${countryCode}${opName ? ` ${opName}` : ""} ${customer.name} → ${vendor.name}`;

      let route = a.routeId ? existing.find((r) => r.id === Number(a.routeId)) : undefined;
      if (!route) route = existing.find((r) => r.vendorId === vendorId && !keepIds.has(r.id));

      if (route) {
        const updated = await prisma.route.update({
          where: { id: route.id },
          data: { name, vendorId, sellingRate, buyingRate, priority: pr, weight, isActive: active },
        });
        saved.push(updated);
        keepIds.add(route.id);
      } else {
        const created = await prisma.route.create({
          data: {
            name,
            customerId: cid,
            vendorId,
            countryCode,
            numberPrefix: prefix,
            operatorName: opName,
            sellingRate,
            buyingRate,
            priority: pr,
            weight,
            isActive: active,
            batchId,
          },
        });
        saved.push(created);
        keepIds.add(created.id);
      }
    }

    for (const r of existing) {
      if (keepIds.has(r.id)) continue;
      if (r._count.messages > 0) {
        await prisma.route.update({ where: { id: r.id }, data: { isActive: false } });
      } else {
        await prisma.route.delete({ where: { id: r.id } });
      }
    }

    return Response.json({ success: true, data: { routeIds: saved.map((r) => r.id) } });
  } catch (error) {
    console.error("Route lane save error:", error);
    return Response.json({ success: false, error: "Failed to save route" }, { status: 500 });
  }
}
