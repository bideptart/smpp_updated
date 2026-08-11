import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

export async function GET(req: NextRequest) {
  try {
    const customerId = req.nextUrl.searchParams.get("customerId");
    const where: Record<string, unknown> = {};
    if (customerId) where.customerId = parseInt(customerId);

    const categories = await prisma.templateCategory.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { templates: true } } },
    });

    return Response.json({
      success: true,
      data: categories.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        templateCount: c._count.templates,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error("Template categories list error:", error);
    return Response.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const { customerId, name, color } = body;
    if (!customerId || !name) {
      return Response.json({ success: false, error: "customerId and name required" }, { status: 400 });
    }
    const category = await prisma.templateCategory.create({
      data: { customerId: parseInt(customerId), name, color: color || "slate" },
    });
    return Response.json({ success: true, data: category }, { status: 201 });
  } catch (error) {
    console.error("Template category create error:", error);
    return Response.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
