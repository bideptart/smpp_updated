import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const { id } = await context.params;
    const invoiceId = parseInt(id, 10);
    if (isNaN(invoiceId)) {
      return Response.json({ success: false, error: "Invalid invoice ID" }, { status: 400 });
    }

    const body = await req.json();
    if (body.status !== "finalized" && body.status !== "draft") {
      return Response.json({ success: false, error: "status must be draft or finalized" }, { status: 400 });
    }

    const invoice = await prisma.trafficSummary.update({
      where: { id: invoiceId },
      data: { status: body.status },
    });

    return Response.json({ success: true, data: { id: Number(invoice.id), status: invoice.status } });
  } catch (error) {
    console.error("Invoice update error:", error);
    return Response.json({ success: false, error: "Failed to update invoice" }, { status: 500 });
  }
}
