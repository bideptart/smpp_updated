import { NextRequest } from "next/server";
import { getSessionUser, isGatewayAdmin } from "@/lib/user-scope";
import { listConnectors, addConnector } from "@/lib/jasmin-cli";

export async function GET() {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const data = await listConnectors();
    return Response.json({ success: true, data });
  } catch (error) {
    console.error("Jasmin connectors list error:", error);
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
    const { cid, host, port, username, password, bind } = body;
    if (!cid || !host || !port || !username || !password) {
      return Response.json(
        { success: false, error: "cid, host, port, username, and password are required" },
        { status: 400 }
      );
    }

    const result = await addConnector({ cid, host, port, username, password, bind });
    if (!result.success) {
      return Response.json({ success: false, error: result.message }, { status: 400 });
    }
    return Response.json({ success: true, message: result.message });
  } catch (error) {
    console.error("Jasmin connector create error:", error);
    return Response.json({ success: false, error: "Failed to create connector" }, { status: 500 });
  }
}
