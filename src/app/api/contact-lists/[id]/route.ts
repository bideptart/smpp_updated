import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const list = await prisma.contactList.findUnique({ where: { id: parseInt(id) } });
    if (!list) return Response.json({ success: false, error: "Not found" }, { status: 404 });
    return Response.json({ success: true, data: list });
  } catch (error) {
    console.error("List fetch error:", error);
    return Response.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { name, description, isDefault, isPinned, isHidden } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description || null;
    if (isPinned !== undefined) data.isPinned = !!isPinned;
    if (isHidden !== undefined) data.isHidden = !!isHidden;

    // Handle isDefault flip (ensure only one default per customer)
    if (isDefault !== undefined) {
      const list = await prisma.contactList.findUnique({ where: { id: parseInt(id) } });
      if (list && isDefault) {
        await prisma.contactList.updateMany({
          where: { customerId: list.customerId, isDefault: true },
          data: { isDefault: false },
        });
      }
      data.isDefault = !!isDefault;
    }

    const list = await prisma.contactList.update({
      where: { id: parseInt(id) },
      data,
    });
    return Response.json({ success: true, data: list });
  } catch (error) {
    console.error("List update error:", error);
    return Response.json({ success: false, error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const { id } = await params;
    await prisma.contactList.delete({ where: { id: parseInt(id) } });
    return Response.json({ success: true });
  } catch (error) {
    console.error("List delete error:", error);
    return Response.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
}
