import * as fs from "fs";
import * as path from "path";
import type { DirectStatus } from "./direct-smpp";

// direct-smpp.ts's isDirectBound()/getDirectStatus() read an in-memory map
// that only the smpp-daemon process ever writes to (only it calls
// connectAndBind()). The Next.js web app runs as a completely separate
// Node process/PM2 app, so calling those functions from an API route would
// always see an empty map -- silently reporting every DIRECT connection as
// offline regardless of its real state. The daemon writes its direct-SMPP
// status into its existing status heartbeat file every 10s; this module
// reads that file instead, the same cross-process pattern already used for
// daemon liveness (running/uptime/pid) in connections/vendor-status/route.ts.
const STATUS_FILE = process.platform === "win32"
  ? path.join(process.env.TEMP || "C:\\Temp", "smpp-daemon-status.json")
  : "/tmp/smpp-daemon-status.json";

export function readDirectStatus(): DirectStatus[] {
  try {
    const raw = JSON.parse(fs.readFileSync(STATUS_FILE, "utf-8"));
    return Array.isArray(raw?.direct) ? raw.direct : [];
  } catch {
    return [];
  }
}

export function isDirectBoundFromFile(cid: string): boolean {
  return readDirectStatus().some((s) => s.cid === cid && s.bound);
}
