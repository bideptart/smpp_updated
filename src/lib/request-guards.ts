import { NextRequest } from "next/server";

/**
 * True only for requests originating from the same host -- used to gate
 * webhooks that Jasmin calls internally (DLR/MO throwers) and should never
 * be reachable from outside this server, token or not.
 */
export function isLocalRequest(req: NextRequest): boolean {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : "";
  // Node reports loopback connections on dual-stack sockets as the
  // IPv4-mapped IPv6 form (::ffff:127.0.0.1), not plain 127.0.0.1.
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "";
}
