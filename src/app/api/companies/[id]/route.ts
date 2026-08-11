import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { CompanyType } from "@/generated/prisma";
import { getSessionUser, canMutate } from "@/lib/user-scope";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const { id } = await context.params;
    const companyId = parseInt(id, 10);
    if (isNaN(companyId)) {
      return Response.json(
        { success: false, error: "Invalid company ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { name, code, type, contactName, contactEmail, contactPhone, isActive, currency } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code.toUpperCase();
    if (type !== undefined) updateData.type = type as CompanyType;
    if (contactName !== undefined) updateData.contactName = contactName || null;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail || null;
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (currency !== undefined) updateData.currency = currency;
    if (body.balance !== undefined) updateData.balance = Number(body.balance);

    if (code !== undefined) {
      const existing = await prisma.company.findFirst({
        where: { code: code.toUpperCase(), id: { not: companyId } },
      });
      if (existing) {
        return Response.json(
          { success: false, error: "A company with this code already exists" },
          { status: 409 }
        );
      }
    }

    const company = await prisma.company.update({
      where: { id: companyId },
      data: updateData,
    });

    return Response.json({ success: true, data: company });
  } catch (error) {
    console.error("Company update error:", error);
    return Response.json(
      { success: false, error: "Failed to update company" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const { id } = await context.params;
    const companyId = parseInt(id, 10);
    if (isNaN(companyId)) {
      return Response.json(
        { success: false, error: "Invalid company ID" },
        { status: 400 }
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: {
          select: {
            connections: true,
            customerMessages: true,
            vendorMessages: true,
          },
        },
      },
    });

    if (!company) {
      return Response.json(
        { success: false, error: "Company not found" },
        { status: 404 }
      );
    }

    const hasConnections = company._count.connections > 0;
    const hasMessages =
      company._count.customerMessages > 0 || company._count.vendorMessages > 0;

    if (hasConnections || hasMessages) {
      return Response.json(
        {
          success: false,
          error:
            "Cannot delete company with existing connections or messages. Consider deactivating it instead.",
        },
        { status: 409 }
      );
    }

    await prisma.company.delete({ where: { id: companyId } });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Company delete error:", error);
    return Response.json(
      { success: false, error: "Failed to delete company" },
      { status: 500 }
    );
  }
}
