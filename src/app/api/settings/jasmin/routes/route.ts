import { NextRequest } from "next/server";
import { getSessionUser, isGatewayAdmin } from "@/lib/user-scope";
import { listRoutes, addDefaultRoute } from "@/lib/jasmin-cli";

export async function GET() {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const data = await listRoutes();
    return Response.json({ success: true, data });
  } catch (error) {
    console.error("Jasmin routes list error:", error);
    return Response.json({ success: false, error: "Failed to reach Jasmin" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!isGatewayAdmin(caller.role)) {
      return Response.json({ error: "Forbidden: gateway admin role required" }, { status: 403 });
    }

    const body = await req.json();
    const { cid, rate } = body;
    if (!cid) {
      return Response.json({ success: false, error: "cid is required" }, { status: 400 });
    }

    const result = await addDefaultRoute(cid, rate ?? "0.0");
    if (!result.success) {
      return Response.json({ success: false, error: result.message }, { status: 400 });
    }
    return Response.json({ success: true, message: result.message });
  } catch (error) {
    console.error("Jasmin route create error:", error);
    return Response.json({ success: false, error: "Failed to create route" }, { status: 500 });
  }
}
