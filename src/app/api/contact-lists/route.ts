import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

export async function GET(req: NextRequest) {
  try {
    const customerId = req.nextUrl.searchParams.get("customerId");
    const where: Record<string, unknown> = {};
    if (customerId) where.customerId = parseInt(customerId);

    const lists = await prisma.contactList.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ success: true, data: lists });
  } catch (error) {
    console.error("Lists fetch error:", error);
    return Response.json({ success: false, error: "Failed to fetch lists" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const { customerId, name, description } = body;

    if (!customerId || !name) {
      return Response.json({ success: false, error: "customerId and name required" }, { status: 400 });
    }

    const list = await prisma.contactList.create({
      data: {
        customerId: parseInt(customerId),
        name,
        description: description || null,
      },
    });

    return Response.json({ success: true, data: list }, { status: 201 });
  } catch (error) {
    console.error("List create error:", error);
    return Response.json({ success: false, error: "Failed to create list" }, { status: 500 });
  }
}
