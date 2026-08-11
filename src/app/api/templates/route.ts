import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const customerId = searchParams.get("customerId");
    const categoryId = searchParams.get("categoryId");
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {};
    if (customerId) where.customerId = parseInt(customerId);
    if (categoryId) where.categoryId = parseInt(categoryId);
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ];
    }

    const templates = await prisma.template.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      include: { category: true },
    });

    return Response.json({ success: true, data: templates });
  } catch (error) {
    console.error("Templates list error:", error);
    return Response.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const { customerId, name, content, categoryId } = body;
    if (!customerId || !name || !content) {
      return Response.json({ success: false, error: "customerId, name, content required" }, { status: 400 });
    }
    const tpl = await prisma.template.create({
      data: {
        customerId: parseInt(customerId),
        name,
        content,
        categoryId: categoryId ? parseInt(categoryId) : null,
      },
      include: { category: true },
    });
    return Response.json({ success: true, data: tpl }, { status: 201 });
  } catch (error) {
    console.error("Template create error:", error);
    return Response.json({ success: false, error: "Failed to create" }, { status: 500 });
  }
}
