import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { CompanyType } from "@/generated/prisma";
import { getSessionUser, canMutate } from "@/lib/user-scope";
import { auditLog } from "@/lib/audit";

export async function GET() {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const companies = await prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { connections: true },
        },
        customerMessages: {
          where: { submittedAt: { gte: since24h } },
          select: { id: true },
        },
        vendorMessages: {
          where: { submittedAt: { gte: since24h } },
          select: { id: true },
        },
      },
    });

    const data = companies.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      type: c.type,
      contactName: c.contactName,
      contactEmail: c.contactEmail,
      contactPhone: c.contactPhone,
      isActive: c.isActive,
      balance: Number(c.balance),
      currency: c.currency,
      createdAt: c.createdAt,
      connectionCount: c._count.connections,
      traffic24h: c.customerMessages.length + c.vendorMessages.length,
    }));

    return Response.json({ success: true, data });
  } catch (error) {
    console.error("Companies list error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch companies" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const { name, code, type, contactName, contactEmail, contactPhone, balance, currency } = body;

    if (!name || !code || !type) {
      return Response.json(
        { success: false, error: "Name, code, and type are required" },
        { status: 400 }
      );
    }

    if (!["customer", "vendor"].includes(type)) {
      return Response.json(
        { success: false, error: "Type must be customer or vendor" },
        { status: 400 }
      );
    }

    const existing = await prisma.company.findUnique({ where: { code: code.toUpperCase() } });
    if (existing) {
      return Response.json(
        { success: false, error: "A company with this code already exists" },
        { status: 409 }
      );
    }

    const company = await prisma.company.create({
      data: {
        name,
        code: code.toUpperCase(),
        type: type as CompanyType,
        contactName: contactName || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        balance: balance != null ? Number(balance) : 0,
        currency: currency || "INR",
      },
    });

    await auditLog({
      userId: caller.id,
      action: "company_created",
      resource: "company",
      resourceId: company.id,
      details: { name: company.name, code: company.code, type: company.type },
    });

    return Response.json({ success: true, data: company }, { status: 201 });
  } catch (error) {
    console.error("Company create error:", error);
    return Response.json(
      { success: false, error: "Failed to create company" },
      { status: 500 }
    );
  }
}