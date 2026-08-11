import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

export async function GET(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const customerId = req.nextUrl.searchParams.get("customerId");
    const where: Record<string, unknown> = {};
    if (customerId) where.customerId = parseInt(customerId, 10);

    const filters = await prisma.contentFilter.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ success: true, data: filters });
  } catch (error) {
    console.error("Content filters list error:", error);
    return Response.json({ success: false, error: "Failed to fetch content filters" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const { customerId, keyword, action, isActive } = body;

    if (!keyword || !String(keyword).trim()) {
      return Response.json({ success: false, error: "Keyword is required" }, { status: 400 });
    }

    const filter = await prisma.contentFilter.create({
      data: {
        customerId: customerId ? parseInt(customerId, 10) : null,
        keyword: String(keyword).trim(),
        action: action || "block",
        isActive: isActive ?? true,
      },
    });

    return Response.json({ success: true, data: filter }, { status: 201 });
  } catch (error) {
    console.error("Content filter create error:", error);
    return Response.json({ success: false, error: "Failed to create content filter" }, { status: 500 });
  }
}
