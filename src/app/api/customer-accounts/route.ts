import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { randomHex, generatePassword } from "@/lib/sms-engine";
import { getSessionUser, canMutate } from "@/lib/user-scope";

export async function GET() {
  try {
    const accounts = await prisma.customerSmppAccount.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    const data = accounts.map((a) => ({
      id: a.id,
      companyId: a.companyId,
      companyName: a.company.name,
      accountName: a.accountName,
      systemId: a.systemId,
      allowedIps: a.allowedIps,
      assignedIp: a.assignedIp,
      maxConnections: a.maxConnections,
      maxTps: a.maxTps,
      speedLimit: a.speedLimit,
      status: a.status,
      bindMode: a.bindMode,
      chargingModel: a.chargingModel,
      enableDelivery: a.enableDelivery,
      totalSent: a.totalSent,
      totalDelivered: a.totalDelivered,
      totalFailed: a.totalFailed,
      lastBindAt: a.lastBindAt,
      lastBindIp: a.lastBindIp,
      createdAt: a.createdAt,
    }));

    return Response.json({ success: true, data });
  } catch (error) {
    console.error("Customer accounts list error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch customer accounts" },
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
    const {
      companyId,
      accountName,
      systemId,
      password,
      allowedIps,
      assignedIp,
      maxConnections,
      maxTps,
      speedLimit,
      bindMode,
      chargingModel,
      enableDelivery,
    } = body;

    if (!companyId) {
      return Response.json(
        { success: false, error: "Company is required" },
        { status: 400 }
      );
    }

    const finalSystemId = systemId || `BSS${randomHex(6).toUpperCase()}`;
    const finalPassword = password || generatePassword(8);

    // Check unique systemId
    const existing = await prisma.customerSmppAccount.findUnique({
      where: { systemId: finalSystemId },
    });
    if (existing) {
      return Response.json(
        { success: false, error: "System ID already exists" },
        { status: 409 }
      );
    }

    const account = await prisma.customerSmppAccount.create({
      data: {
        companyId: parseInt(companyId, 10),
        accountName: accountName || null,
        systemId: finalSystemId,
        password: await bcrypt.hash(finalPassword, 10),
        allowedIps: allowedIps || "*",
        assignedIp: assignedIp || null,
        maxConnections: maxConnections ?? 2,
        maxTps: maxTps ?? 10,
        speedLimit: speedLimit ?? 10,
        bindMode: bindMode || "TRX",
        chargingModel: chargingModel || "submission",
        enableDelivery: enableDelivery ?? "yes",
      },
    });

    return Response.json(
      {
        success: true,
        data: account,
        credentials: {
          systemId: finalSystemId,
          password: finalPassword,
          smppHost: "smpp.smslocal.in",
          smppPort: 2775,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Customer account create error:", error);
    return Response.json(
      { success: false, error: "Failed to create customer account" },
      { status: 500 }
    );
  }
}
