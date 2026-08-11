import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser } from "@/lib/user-scope";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

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
    });

    if (!connection) {
      return Response.json(
        { success: false, error: "Connection not found" },
        { status: 404 }
      );
    }

    let reachable = false;
    let latency = 0;
    let detail = "";

    if (connection.type === "HTTP" && connection.apiUrl) {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(connection.apiUrl, {
          method: "HEAD",
          signal: controller.signal,
        });
        clearTimeout(timeout);
        latency = Date.now() - start;
        reachable = res.ok || res.status < 500;
        detail = `HTTP ${res.status} ${res.statusText}`;
      } catch (err) {
        latency = Date.now() - start;
        reachable = false;
        detail = err instanceof Error ? err.message : "Request failed";
      }
    } else if (connection.type === "SMPP" && connection.host && connection.port) {
      // TCP socket check via Node.js net module
      try {
        const net = await import("node:net");
        const start = Date.now();
        reachable = await new Promise<boolean>((resolve) => {
          const socket = net.createConnection(
            { host: connection.host!, port: connection.port!, timeout: 5000 },
            () => {
              socket.destroy();
              resolve(true);
            }
          );
          socket.on("error", () => {
            socket.destroy();
            resolve(false);
          });
          socket.on("timeout", () => {
            socket.destroy();
            resolve(false);
          });
        });
        latency = Date.now() - start;
        detail = reachable
          ? `TCP connection to ${connection.host}:${connection.port} succeeded`
          : `TCP connection to ${connection.host}:${connection.port} refused or timed out`;
      } catch {
        reachable = false;
        latency = 0;
        detail = "TCP check unavailable in this runtime";
      }
    } else {
      detail = "No host/port or API URL configured for this connection";
    }

    // Update last activity on successful check
    if (reachable) {
      await prisma.connection.update({
        where: { id: connectionId },
        data: { lastActivity: new Date() },
      });
    }

    return Response.json({
      success: true,
      data: { reachable, latency, detail, checkedAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error("Connection check error:", error);
    return Response.json(
      { success: false, error: "Failed to check connection" },
      { status: 500 }
    );
  }
}
