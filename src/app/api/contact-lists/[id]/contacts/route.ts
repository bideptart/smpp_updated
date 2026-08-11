import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser } from "@/lib/user-scope";

// GET — list contacts in a list
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { searchParams } = req.nextUrl;
    const limit = Math.min(parseInt(searchParams.get("limit") || "1000"), 10000);

    const entries = await prisma.contactListEntry.findMany({
      where: { listId: parseInt(id) },
      include: { contact: true },
      take: limit,
    });

    return Response.json({
      success: true,
      data: entries.map((e) => e.contact),
    });
  } catch (error) {
    console.error("List contacts fetch error:", error);
    return Response.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
