import { getSessionUser } from "@/lib/user-scope";
import { listConnectors, connectorStats } from "@/lib/jasmin-cli";

export async function GET() {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const connectors = await listConnectors();
    const data = await Promise.all(
      connectors.map(async (c) => {
        const stats = await connectorStats(c.cid).catch(() => ({} as Record<string, string>));
        return {
          ...c,
          submitted: Number(stats.submit_sm_count || 0),
          delivered: Number(stats.deliver_sm_count || 0),
          boundAt: stats.bound_at || null,
          lastActivityAt: stats.last_sent_pdu_at || stats.last_received_pdu_at || null,
        };
      })
    );

    return Response.json({ success: true, data });
  } catch (error) {
    console.error("Jasmin status error:", error);
    return Response.json({ success: false, error: "Failed to reach Jasmin" }, { status: 500 });
  }
}
