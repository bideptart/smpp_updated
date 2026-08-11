import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getBoundConnectorCids } from "@/lib/jasmin-cli";
import { isDirectBoundFromFile } from "@/lib/direct-status-file";
import { pickWeightedRoute } from "@/lib/route-failover";
import { getSessionUser } from "@/lib/user-scope";

export async function GET(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const customerIdParam = req.nextUrl.searchParams.get("customerId");
    const destination = req.nextUrl.searchParams.get("destination") || "";

    if (!customerIdParam) {
      return Response.json({ success: false, error: "customerId required" }, { status: 400 });
    }

    const customerId = parseInt(customerIdParam, 10);

    // Normalize destination (strip leading +)
    const normalizedDest = destination.replace(/^\+/, "").replace(/\D/g, "");

    // Get all active routes for customer, ordered by priority
    const routes = await prisma.route.findMany({
      where: {
        customerId,
        isActive: true,
      },
      orderBy: { priority: "asc" },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            connections: { select: { id: true, name: true, transport: true } },
          },
        },
      },
    });

    // Find best match: prefer empty-prefix or matching prefix, weighted
    // among same-priority vendor candidates (matches the real selection
    // logic in sms/send and sms/bulk -- this preview is probabilistic once
    // weights are in play, same as a real send would be).
    const matches = routes.filter(
      (r) => r.numberPrefix === "" || normalizedDest.startsWith(r.numberPrefix)
    );
    let selected = pickWeightedRoute(matches);

    // If no match and destination given, fall back to the first route
    if (!selected && routes.length > 0) selected = routes[0];

    if (!selected) {
      return Response.json({
        success: true,
        route: null,
        reason: "No active route configured for this customer",
      });
    }

    const boundCids = await getBoundConnectorCids().catch(() => new Set<string>());
    const vendorOnline = selected.vendor.connections.some((c) =>
      c.transport === "DIRECT" ? isDirectBoundFromFile(c.name) : boundCids.has(c.name.toLowerCase())
    );

    return Response.json({
      success: true,
      route: {
        id: selected.id,
        name: selected.name,
        vendorId: selected.vendorId,
        vendorName: selected.vendor.name,
        vendorOnline,
        sellingRate: Number(selected.sellingRate),
        priority: selected.priority,
        countryCode: selected.countryCode,
        numberPrefix: selected.numberPrefix,
      },
    });
  } catch (error) {
    console.error("Route preview error:", error);
    return Response.json({ success: false, error: "Preview failed" }, { status: 500 });
  }
}
