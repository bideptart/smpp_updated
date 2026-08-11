import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tpl = await prisma.template.findUnique({
      where: { id: parseInt(id) },
      include: { category: true },
    });
    if (!tpl) return Response.json({ success: false, error: "Not found" }, { status: 404 });
    return Response.json({ success: true, data: tpl });
  } catch (error) {
    console.error("Template get error:", error);
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
    const { name, content, categoryId, markUsed } = body;

    const data: Record<string, unknown> = {};
    if (markUsed) {
      data.lastUsedAt = new Date();
      data.useCount = { increment: 1 };
      const updated = await prisma.template.update({
        where: { id: parseInt(id) },
        data,
      });
      return Response.json({ success: true, data: updated });
    }

    if (name !== undefined) data.name = name;
    if (content !== undefined) data.content = content;
    if (categoryId !== undefined) data.categoryId = categoryId ? parseInt(categoryId) : null;

    const tpl = await prisma.template.update({
      where: { id: parseInt(id) },
      data,
      include: { category: true },
    });
    return Response.json({ success: true, data: tpl });
  } catch (error) {
    console.error("Template update error:", error);
    return Response.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const { id } = await params;
    await prisma.template.delete({ where: { id: parseInt(id) } });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Template delete error:", error);
    return Response.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
