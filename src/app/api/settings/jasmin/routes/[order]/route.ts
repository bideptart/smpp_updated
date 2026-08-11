import { NextRequest } from "next/server";
import { getSessionUser, isGatewayAdmin } from "@/lib/user-scope";
import { removeRoute } from "@/lib/jasmin-cli";

export async function DELETE(_req: NextRequest, context: { params: Promise<{ order: string }> }) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!isGatewayAdmin(caller.role)) {
      return Response.json({ error: "Forbidden: gateway admin role required" }, { status: 403 });
    }

    const { order } = await context.params;
    const orderNum = parseInt(order, 10);
    if (isNaN(orderNum)) {
      return Response.json({ success: false, error: "Invalid route order" }, { status: 400 });
    }

    const result = await removeRoute(orderNum);
    if (!result.success) {
      return Response.json({ success: false, error: result.message }, { status: 400 });
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error("Jasmin route delete error:", error);
    return Response.json({ success: false, error: "Failed to remove route" }, { status: 500 });
  }
}
