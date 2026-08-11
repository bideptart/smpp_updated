import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const contact = await prisma.contact.findUnique({
      where: { id: parseInt(id) },
      include: {
        listEntries: { include: { list: true } },
        tags: { include: { tag: true } },
      },
    });
    if (!contact) {
      return Response.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return Response.json({ success: true, data: contact });
  } catch (error) {
    console.error("Contact get error:", error);
    return Response.json({ success: false, error: "Failed to fetch contact" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { phoneNumber, firstName, lastName, email, company, country, whatsappNumber, notes, isActive, isUnsubscribed, isBlocked } = body;

    const data: Record<string, unknown> = {};
    if (phoneNumber !== undefined) data.phoneNumber = String(phoneNumber).replace(/\s+/g, "").replace(/^\+/, "");
    if (firstName !== undefined) data.firstName = firstName || null;
    if (lastName !== undefined) data.lastName = lastName || null;
    if (email !== undefined) data.email = email || null;
    if (company !== undefined) data.company = company || null;
    if (country !== undefined) data.country = country || null;
    if (whatsappNumber !== undefined) data.whatsappNumber = whatsappNumber || null;
    if (notes !== undefined) data.notes = notes || null;
    if (isActive !== undefined) data.isActive = !!isActive;
    if (isUnsubscribed !== undefined) data.isUnsubscribed = !!isUnsubscribed;
    if (isBlocked !== undefined) data.isBlocked = !!isBlocked;

    const contact = await prisma.contact.update({
      where: { id: parseInt(id) },
      data,
    });
    return Response.json({ success: true, data: contact });
  } catch (error) {
    console.error("Contact update error:", error);
    return Response.json({ success: false, error: "Failed to update contact" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const { id } = await params;
    await prisma.contact.delete({ where: { id: parseInt(id) } });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Contact delete error:", error);
    return Response.json({ success: false, error: "Failed to delete contact" }, { status: 500 });
  }
}
