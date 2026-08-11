import os from "os";
import { getSessionUser } from "@/lib/user-scope";

export async function GET() {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const interfaces = os.networkInterfaces();
    const ips: string[] = [];
    for (const entries of Object.values(interfaces)) {
      for (const entry of entries || []) {
        if (entry.family === "IPv4" && !entry.internal) ips.push(entry.address);
      }
    }

    return Response.json({ success: true, data: ips });
  } catch (error) {
    console.error("Server IPs list error:", error);
    return Response.json(
      { success: false, error: "Failed to list server IPs" },
      { status: 500 }
    );
  }
}
