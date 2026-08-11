import { getSessionUser } from "@/lib/user-scope";
import { getMetrics } from "@/lib/jasmin-cli";

export async function GET() {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const data = await getMetrics();
    return Response.json({ success: true, data });
  } catch (error) {
    console.error("Jasmin metrics error:", error);
    return Response.json({ success: false, error: "Failed to reach Jasmin metrics" }, { status: 500 });
  }
}
