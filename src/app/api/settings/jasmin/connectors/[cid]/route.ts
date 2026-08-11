import { NextRequest } from "next/server";
import { getSessionUser, isGatewayAdmin } from "@/lib/user-scope";
import { updateConnector, removeConnector } from "@/lib/jasmin-cli";

type RouteContext = { params: Promise<{ cid: string }> };

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!isGatewayAdmin(caller.role)) {
      return Response.json({ error: "Forbidden: gateway admin role required" }, { status: 403 });
    }

    const { cid } = await context.params;
    const body = await req.json();
    const { host, port, username, password, bind } = body;

    const result = await updateConnector(cid, { host, port, username, password, bind });
    if (!result.success) {
      return Response.json({ success: false, error: result.message }, { status: 400 });
    }
    return Response.json({ success: true, message: result.message });
  } catch (error) {
    console.error("Jasmin connector update error:", error);
    return Response.json({ success: false, error: "Failed to update connector" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!isGatewayAdmin(caller.role)) {
      return Response.json({ error: "Forbidden: gateway admin role required" }, { status: 403 });
    }

    const { cid } = await context.params;
    const result = await removeConnector(cid);
    if (!result.success) {
      return Response.json({ success: false, error: result.message }, { status: 400 });
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error("Jasmin connector delete error:", error);
    return Response.json({ success: false, error: "Failed to remove connector" }, { status: 500 });
  }
}
