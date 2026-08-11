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
    const filterId = parseInt(id, 10);
    if (isNaN(filterId)) {
      return Response.json({ success: false, error: "Invalid filter ID" }, { status: 400 });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};
    if (body.customerId !== undefined) updateData.customerId = body.customerId ? parseInt(body.customerId, 10) : null;
    if (body.keyword !== undefined) updateData.keyword = String(body.keyword).trim();
    if (body.action !== undefined) updateData.action = body.action;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const filter = await prisma.contentFilter.update({
      where: { id: filterId },
      data: updateData,
    });

    return Response.json({ success: true, data: filter });
  } catch (error) {
    console.error("Content filter update error:", error);
    return Response.json({ success: false, error: "Failed to update content filter" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const { id } = await context.params;
    const filterId = parseInt(id, 10);
    if (isNaN(filterId)) {
      return Response.json({ success: false, error: "Invalid filter ID" }, { status: 400 });
    }

    await prisma.contentFilter.delete({ where: { id: filterId } });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Content filter delete error:", error);
    return Response.json({ success: false, error: "Failed to delete content filter" }, { status: 500 });
  }
}
