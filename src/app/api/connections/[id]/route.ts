import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { ConnectionType, ConnectionDirection, ConnectionStatus, ConnectionTransport } from "@/generated/prisma";
import { getSessionUser, canMutate } from "@/lib/user-scope";
import { setConnectorThroughput } from "@/lib/jasmin-cli";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const { id } = await context.params;
    const connectionId = parseInt(id, 10);
    if (isNaN(connectionId)) {
      return Response.json(
        { success: false, error: "Invalid connection ID" },
        { status: 400 }
      );
    }

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

    const updateData: Record<string, unknown> = {};
    if (companyId !== undefined) updateData.companyId = Number(companyId);
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type as ConnectionType;
    if (direction !== undefined) updateData.direction = direction as ConnectionDirection;
    if (host !== undefined) updateData.host = host || null;
    if (port !== undefined) updateData.port = port ? Number(port) : null;
    if (username !== undefined) updateData.username = username || null;
    if (password !== undefined) updateData.password = password || null;
    if (apiUrl !== undefined) updateData.apiUrl = apiUrl || null;
    if (apiKey !== undefined) updateData.apiKey = apiKey || null;
    if (maxTps !== undefined) updateData.maxTps = Number(maxTps);
    if (transport !== undefined) updateData.transport = transport as ConnectionTransport;
    if (status !== undefined) updateData.status = status as ConnectionStatus;

    const connection = await prisma.connection.update({
      where: { id: connectionId },
      data: updateData,
    });

    // maxTps stored here is just a number until it's pushed into Jasmin's
    // connector as submit_throughput -- that's the only place vendor-side
    // outbound rate is actually enforced for a JASMIN-transport connection.
    // A DIRECT-transport connection instead reads maxTps itself (the direct
    // client's token bucket), so pushing to Jasmin would be meaningless —
    // and harmless to skip, since Jasmin has no connector for it anyway.
    // Best-effort: a JASMIN connection whose name doesn't match a live
    // Jasmin connector (e.g. a customer-side connection) just gets a note,
    // not a failure.
    let note: string | undefined;
    if (maxTps !== undefined && connection.type === "SMPP" && connection.transport === "JASMIN") {
      const result = await setConnectorThroughput(connection.name, Number(maxTps)).catch((e) => ({
        success: false,
        message: String(e),
      }));
      if (!result.success) {
        note = `Saved, but couldn't update the live Jasmin connector's speed limit: ${result.message}`;
      }
    }

    return Response.json({ success: true, data: connection, note });
  } catch (error) {
    console.error("Connection update error:", error);
    return Response.json(
      { success: false, error: "Failed to update connection" },
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
    const connectionId = parseInt(id, 10);
    if (isNaN(connectionId)) {
      return Response.json(
        { success: false, error: "Invalid connection ID" },
        { status: 400 }
      );
    }

    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
      include: {
        _count: { select: { messages: true } },
      },
    });

    if (!connection) {
      return Response.json(
        { success: false, error: "Connection not found" },
        { status: 404 }
      );
    }

    if (connection._count.messages > 0) {
      return Response.json(
        {
          success: false,
          error:
            "Cannot delete connection with existing messages. Consider setting it to inactive instead.",
        },
        { status: 409 }
      );
    }

    await prisma.connection.delete({ where: { id: connectionId } });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Connection delete error:", error);
    return Response.json(
      { success: false, error: "Failed to delete connection" },
      { status: 500 }
    );
  }
}
