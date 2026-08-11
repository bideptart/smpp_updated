import { getSessionUser, isGatewayAdmin } from "@/lib/user-scope";
import { syncVendorRouting } from "@/lib/jasmin-cli";

export async function POST() {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!isGatewayAdmin(caller.role)) {
      return Response.json({ error: "Forbidden: gateway admin role required" }, { status: 403 });
    }

    const result = await syncVendorRouting();
    return Response.json({ success: true, data: result });
  } catch (error) {
    console.error("Jasmin routing sync error:", error);
    return Response.json({ success: false, error: "Failed to sync vendor routing" }, { status: 500 });
  }
}
