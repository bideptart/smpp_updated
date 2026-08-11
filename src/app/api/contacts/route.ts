import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const customerId = searchParams.get("customerId");
    const search = searchParams.get("search") || "";
    const listId = searchParams.get("listId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 500);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (customerId) where.customerId = parseInt(customerId);
    if (search) {
      where.OR = [
        { phoneNumber: { contains: search } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
      ];
    }
    if (listId) {
      where.listEntries = { some: { listId: parseInt(listId) } };
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);

    return Response.json({
      success: true,
      data: contacts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Contacts list error:", error);
    return Response.json({ success: false, error: "Failed to fetch contacts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const {
      customerId,
      phoneNumber,
      firstName,
      lastName,
      email,
      company,
      country,
      whatsappNumber,
      notes,
      listIds,
    } = body;

    if (!customerId || !phoneNumber) {
      return Response.json(
        { success: false, error: "customerId and phoneNumber are required" },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalized = String(phoneNumber).replace(/\s+/g, "").replace(/^\+/, "");

    // Check for duplicate
    const existing = await prisma.contact.findFirst({
      where: { customerId: parseInt(customerId), phoneNumber: normalized },
    });
    if (existing) {
      return Response.json(
        { success: false, error: "Contact with this phone number already exists" },
        { status: 409 }
      );
    }

    const contact = await prisma.contact.create({
      data: {
        customerId: parseInt(customerId),
        phoneNumber: normalized,
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        company: company || null,
        country: country || null,
        whatsappNumber: whatsappNumber || null,
        notes: notes || null,
      },
    });

    // Collect all list IDs to add contact to
    const finalListIds = new Set<number>(Array.isArray(listIds) ? listIds.map((lid: number) => Number(lid)) : []);

    // Auto-add to default list if one exists for this customer
    const defaultList = await prisma.contactList.findFirst({
      where: { customerId: parseInt(customerId), isDefault: true },
    });
    if (defaultList) finalListIds.add(defaultList.id);

    if (finalListIds.size > 0) {
      const ids = Array.from(finalListIds);
      await prisma.contactListEntry.createMany({
        data: ids.map((lid) => ({ listId: lid, contactId: contact.id })),
        skipDuplicates: true,
      });
      // Update contactCount for each list
      for (const lid of ids) {
        const count = await prisma.contactListEntry.count({ where: { listId: lid } });
        await prisma.contactList.update({
          where: { id: lid },
          data: { contactCount: count },
        });
      }
    }

    return Response.json({ success: true, data: contact }, { status: 201 });
  } catch (error) {
    console.error("Contact create error:", error);
    return Response.json({ success: false, error: "Failed to create contact" }, { status: 500 });
  }
}
