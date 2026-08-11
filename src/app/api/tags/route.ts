import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

export async function GET(req: NextRequest) {
  try {
    const customerId = req.nextUrl.searchParams.get("customerId");
    const where: Record<string, unknown> = {};
    if (customerId) where.customerId = parseInt(customerId);
    const tags = await prisma.tag.findMany({ where, orderBy: { name: "asc" } });
    return Response.json({ success: true, data: tags });
  } catch (error) {
    console.error("Tags fetch error:", error);
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
    const tag = await prisma.tag.create({
      data: {
        customerId: parseInt(customerId),
        name,
        color: color || "gray",
      },
    });
    return Response.json({ success: true, data: tag }, { status: 201 });
  } catch (error) {
    console.error("Tag create error:", error);
    return Response.json({ success: false, error: "Failed to create tag" }, { status: 500 });
  }
}
