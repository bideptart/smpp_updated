import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";
import { getBoundConnectorCids, listRoutes } from "@/lib/jasmin-cli";
import { isDirectBoundFromFile } from "@/lib/direct-status-file";

// cids that already have a dedicated TagFilter + MT route in Jasmin (set up
// via syncVendorRouting()), parsed from each route's Filter(s) description
// (e.g. "<TG (tag=acepeak)>") rather than its fid, which isn't shown there.
async function getTaggedVendorCids(): Promise<Set<string>> {
  const jasminRoutes = await listRoutes().catch(() => []);
  const cids = new Set<string>();
  for (const r of jasminRoutes) {
    if (r.order === 0) continue;
    const match = r.filters.match(/tag=([^)]+)\)/i);
    if (match) cids.add(match[1].toLowerCase());
  }
  return cids;
}

export async function GET(req: NextRequest) {
  try {
    const customerId = req.nextUrl.searchParams.get("customerId");

    const where: Record<string, unknown> = {};
    if (customerId) where.customerId = parseInt(customerId, 10);

    const routes = await prisma.route.findMany({
      where,
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      include: {
        customer: { select: { id: true, name: true, currency: true } },
        vendor: {
          select: {
            id: true,
            name: true,
            currency: true,
            connections: { select: { id: true, name: true, status: true, transport: true } },
          },
        },
      },
    });

    const [boundCids, taggedCids] = await Promise.all([
      getBoundConnectorCids().catch(() => new Set<string>()),
      getTaggedVendorCids(),
    ]);

    const data = routes.map((r) => {
      // A vendor is "online" if any of its connections is reachable -- a
      // DIRECT connection checks this app's own bound SMPP client, a
      // JASMIN connection checks Jasmin's connector bind state by name.
      const vendorOnline = r.vendor.connections.some((c) =>
        c.transport === "DIRECT" ? isDirectBoundFromFile(c.name) : boundCids.has(c.name.toLowerCase())
      );
      // "Synced" means this vendor's JASMIN-transport connector has a
      // dedicated Jasmin route -- without it, messages fall through to
      // Jasmin's DefaultRoute regardless of this row. Meaningless for a
      // DIRECT-only vendor (it never touches Jasmin's routing table at
      // all), so those report synced=true rather than a false warning.
      const jasminConns = r.vendor.connections.filter((c) => c.transport !== "DIRECT");
      const jasminSynced =
        jasminConns.length === 0 || jasminConns.some((c) => taggedCids.has(c.name.toLowerCase()));
      return {
        id: r.id,
        name: r.name,
        customerId: r.customerId,
        customerName: r.customer.name,
        customerCurrency: r.customer.currency,
        vendorId: r.vendorId,
        vendorName: r.vendor.name,
        vendorCurrency: r.vendor.currency,
        vendorOnline,
        jasminSynced,
        countryCode: r.countryCode,
        numberPrefix: r.numberPrefix,
        operatorName: r.operatorName,
        batchId: r.batchId,
        sellingRate: Number(r.sellingRate),
        buyingRate: Number(r.buyingRate),
        margin: Number(r.sellingRate) - Number(r.buyingRate),
        priority: r.priority,
        weight: r.weight,
        isActive: r.isActive,
        createdAt: r.createdAt,
      };
    });

    return Response.json({ success: true, data });
  } catch (error) {
    console.error("Routes list error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch routes" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const {
      name,
      customerId,
      vendorId,
      countryCode,
      numberPrefix,
      operatorName,
      sellingRate,
      buyingRate,
      priority,
      weight,
      isActive,
    } = body;

    if (!name || !customerId || !vendorId || !countryCode) {
      return Response.json(
        {
          success: false,
          error: "Name, customer, vendor, and country code are required",
        },
        { status: 400 }
      );
    }

    const route = await prisma.route.create({
      data: {
        name,
        customerId: parseInt(customerId, 10),
        vendorId: parseInt(vendorId, 10),
        countryCode,
        numberPrefix: numberPrefix || "",
        operatorName: operatorName || null,
        sellingRate: sellingRate ?? 0,
        buyingRate: buyingRate ?? 0,
        priority: priority ?? 1,
        weight: weight ?? 100,
        isActive: isActive ?? true,
      },
    });

    return Response.json({ success: true, data: route }, { status: 201 });
  } catch (error) {
    console.error("Route create error:", error);
    return Response.json(
      { success: false, error: "Failed to create route" },
      { status: 500 }
    );
  }
}
