import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ConnectionType, ConnectionDirection, ConnectionStatus, ConnectionTransport } from "@/generated/prisma";
import { getSessionUser, canMutate } from "@/lib/user-scope";
import { encrypt } from "@/lib/encrypt";
import { auditLog } from "@/lib/audit";

export async function GET() {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const connections = await prisma.connection.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { name: true, type: true } },
      },
    });

    const data = connections.map((c) => ({
      id: c.id,
      name: c.name,
      companyId: c.companyId,
      companyName: c.company.name,
      companyType: c.company.type,
      type: c.type,
      direction: c.direction,
      host: c.host,
      port: c.port,
      username: c.username,
      apiUrl: c.apiUrl,
      maxTps: c.maxTps,
      transport: c.transport,
      status: c.status,
      lastActivity: c.lastActivity,
    }));

    return Response.json({ success: true, data });
  } catch (error) {
    console.error("Connections list error:", error);
    return Response.json(
      { success: false, error: "Failed to fetch connections" },
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
      name,
      type,
      direction,
      host,
      port,
      username,
      password,
      apiUrl,
      apiKey,
      maxTps,
      transport,
      status,
    } = body;

    if (!companyId || !name || !type) {
      return Response.json(
        { success: false, error: "Company, name, and type are required" },
        { status: 400 }
      );
    }

    if (!["SMPP", "HTTP"].includes(type)) {
      return Response.json(
        { success: false, error: "Type must be SMPP or HTTP" },
        { status: 400 }
      );
    }

    const company = await prisma.company.findUnique({ where: { id: Number(companyId) } });
    if (!company) {
      return Response.json(
        { success: false, error: "Company not found" },
        { status: 404 }
      );
    }

    const connection = await prisma.connection.create({
      data: {
        companyId: Number(companyId),
        name,
        type: type as ConnectionType,
        direction: (direction || "MT") as ConnectionDirection,
        host: host || null,
        port: port ? Number(port) : null,
        username: username || null,
        password: password ? encrypt(password) : null,
        apiUrl: apiUrl || null,
        apiKey: apiKey ? encrypt(apiKey) : null,
        maxTps: maxTps ? Number(maxTps) : 10,
        transport: (transport || "JASMIN") as ConnectionTransport,
        status: (status || "active") as ConnectionStatus,
      },
    });

    await auditLog({
      userId: caller.id,
      action: "connection_created",
      resource: "connection",
      resourceId: connection.id,
      details: { name: connection.name, type: connection.type, companyId: connection.companyId },
    });

    return Response.json({ success: true, data: connection }, { status: 201 });
  } catch (error) {
    console.error("Connection create error:", error);
    return Response.json(
      { success: false, error: "Failed to create connection" },
      { status: 500 }
    );
  }
}