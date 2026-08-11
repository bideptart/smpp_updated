import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const { id } = await context.params;
    const routeId = parseInt(id, 10);
    if (isNaN(routeId)) {
      return Response.json(
        { success: false, error: "Invalid route ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.customerId !== undefined)
      updateData.customerId = parseInt(body.customerId, 10);
    if (body.vendorId !== undefined)
      updateData.vendorId = parseInt(body.vendorId, 10);
    if (body.countryCode !== undefined) updateData.countryCode = body.countryCode;
    if (body.numberPrefix !== undefined)
      updateData.numberPrefix = body.numberPrefix;
    if (body.operatorName !== undefined)
      updateData.operatorName = body.operatorName || null;
    if (body.sellingRate !== undefined) updateData.sellingRate = body.sellingRate;
    if (body.buyingRate !== undefined) updateData.buyingRate = body.buyingRate;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.weight !== undefined) updateData.weight = body.weight;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const route = await prisma.route.update({
      where: { id: routeId },
      data: updateData,
    });

    return Response.json({ success: true, data: route });
  } catch (error) {
    console.error("Route update error:", error);
    return Response.json(
      { success: false, error: "Failed to update route" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const { id } = await context.params;
    const routeId = parseInt(id, 10);
    if (isNaN(routeId)) {
      return Response.json(
        { success: false, error: "Invalid route ID" },
        { status: 400 }
      );
    }

    const route = await prisma.route.findUnique({
      where: { id: routeId },
      include: { _count: { select: { messages: true } } },
    });

    if (!route) {
      return Response.json(
        { success: false, error: "Route not found" },
        { status: 404 }
      );
    }

    if (route._count.messages > 0) {
      return Response.json(
        {
          success: false,
          error:
            "Cannot delete route with existing messages. Consider deactivating it instead.",
        },
        { status: 409 }
      );
    }

    await prisma.route.delete({ where: { id: routeId } });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Route delete error:", error);
    return Response.json(
      { success: false, error: "Failed to delete route" },
      { status: 500 }
    );
  }
}
