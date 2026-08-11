import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const { id } = await context.params;
    const accountId = parseInt(id, 10);
    if (isNaN(accountId)) {
      return Response.json(
        { success: false, error: "Invalid account ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (body.accountName !== undefined) updateData.accountName = body.accountName;
    if (body.companyId !== undefined)
      updateData.companyId = parseInt(body.companyId, 10);
    if (body.allowedIps !== undefined) updateData.allowedIps = body.allowedIps;
    if (body.assignedIp !== undefined) updateData.assignedIp = body.assignedIp || null;
    if (body.maxConnections !== undefined)
      updateData.maxConnections = body.maxConnections;
    if (body.maxTps !== undefined) updateData.maxTps = body.maxTps;
    if (body.speedLimit !== undefined) updateData.speedLimit = body.speedLimit;
    if (body.bindMode !== undefined) updateData.bindMode = body.bindMode;
    if (body.chargingModel !== undefined)
      updateData.chargingModel = body.chargingModel;
    if (body.enableDelivery !== undefined)
      updateData.enableDelivery = body.enableDelivery;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.password !== undefined && body.password) updateData.password = await bcrypt.hash(body.password, 10);

    const account = await prisma.customerSmppAccount.update({
      where: { id: accountId },
      data: updateData,
    });

    return Response.json({ success: true, data: account });
  } catch (error) {
    console.error("Customer account update error:", error);
    return Response.json(
      { success: false, error: "Failed to update customer account" },
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
    const accountId = parseInt(id, 10);
    if (isNaN(accountId)) {
      return Response.json(
        { success: false, error: "Invalid account ID" },
        { status: 400 }
      );
    }

    const account = await prisma.customerSmppAccount.findUnique({
      where: { id: accountId },
      include: { _count: { select: { messages: true } } },
    });

    if (!account) {
      return Response.json(
        { success: false, error: "Account not found" },
        { status: 404 }
      );
    }

    if (account._count.messages > 0) {
      return Response.json(
        {
          success: false,
          error:
            "Cannot delete account with existing messages. Consider disabling it instead.",
        },
        { status: 409 }
      );
    }

    await prisma.customerSmppAccount.delete({ where: { id: accountId } });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Customer account delete error:", error);
    return Response.json(
      { success: false, error: "Failed to delete customer account" },
      { status: 500 }
    );
  }
}
