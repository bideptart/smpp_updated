import { NextRequest } from "next/server";
import { getSessionUser, isGatewayAdmin } from "@/lib/user-scope";
import { stopConnector } from "@/lib/jasmin-cli";

export async function POST(_req: NextRequest, context: { params: Promise<{ cid: string }> }) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!isGatewayAdmin(caller.role)) {
      return Response.json({ error: "Forbidden: gateway admin role required" }, { status: 403 });
    }

    const { cid } = await context.params;
    const result = await stopConnector(cid);
    if (!result.success) {
      return Response.json({ success: false, error: result.message }, { status: 400 });
    }
    return Response.json({ success: true, message: result.message });
  } catch (error) {
    console.error("Jasmin connector stop error:", error);
    return Response.json({ success: false, error: "Failed to stop connector" }, { status: 500 });
  }
}
