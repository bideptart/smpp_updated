import net from "net";

const JCLI_HOST = process.env.JASMIN_JCLI_HOST || "127.0.0.1";
const JCLI_PORT = parseInt(process.env.JASMIN_JCLI_PORT || "8990", 10);
const JCLI_USER = process.env.JASMIN_JCLI_USER || "jcliadmin";
const JCLI_PASSWORD = process.env.JASMIN_JCLI_PASSWORD || "jclipwd";
const JASMIN_HTTP_URL = process.env.JASMIN_HTTP_URL || "http://127.0.0.1:1401";

function connectJcli(): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: JCLI_HOST, port: JCLI_PORT });
    const onError = (err: Error) => reject(err);
    socket.once("error", onError);
    socket.once("connect", () => {
      socket.off("error", onError);
      resolve(socket);
    });
    socket.setTimeout(8000, () => {
      socket.destroy();
      reject(new Error("jCli connection timeout"));
    });
  });
}

function sendAndWait(socket: net.Socket, data: string, waitMs = 400): Promise<string> {
  return new Promise((resolve) => {
    let buf = "";
    const onData = (chunk: Buffer) => {
      buf += chunk.toString("utf8");
    };
    socket.on("data", onData);
    if (data) socket.write(data);
    setTimeout(() => {
      socket.off("data", onData);
      resolve(buf);
    }, waitMs);
  });
}

/**
 * Runs a sequence of jCli command lines in one authenticated session and
 * returns the raw response text captured after each line. Used both for
 * single commands (e.g. "smppccm -l") and multi-step interactive flows
 * (e.g. "smppccm -a" followed by field lines and "ok"/"ko").
 */
export async function jcliRun(commands: string[]): Promise<string[]> {
  const socket = await connectJcli();
  try {
    await sendAndWait(socket, "", 300); // "Authentication required. Username:"
    await sendAndWait(socket, `${JCLI_USER}\n`, 300); // "Password:"
    await sendAndWait(socket, `${JCLI_PASSWORD}\n`, 400); // now at "jcli :"
    const results: string[] = [];
    for (const cmd of commands) {
      const out = await sendAndWait(socket, `${cmd}\n`, 400);
      results.push(out);
    }
    return results;
  } finally {
    socket.destroy();
  }
}

// ─── Connectors ───────────────────────────────────────────

export interface JasminConnector {
  cid: string;
  service: string; // started | stopped
  session: string; // BOUND_TRX | NONE | ...
  starts: number;
  stops: number;
}

export function parseConnectorList(raw: string): JasminConnector[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("#") && !l.startsWith("#Connector"))
    .map((l) => {
      const parts = l.replace(/^#/, "").trim().split(/\s+/);
      return {
        cid: parts[0] || "",
        service: parts[1] || "",
        session: parts[2] || "",
        starts: parseInt(parts[3] || "0", 10),
        stops: parseInt(parts[4] || "0", 10),
      };
    })
    .filter((c) => c.cid);
}

export async function listConnectors(): Promise<JasminConnector[]> {
  const [raw] = await jcliRun(["smppccm -l"]);
  return parseConnectorList(raw);
}

/**
 * Lowercased CIDs of connectors that are currently bound. Used to answer
 * "is this vendor online" by matching against a Connection's name — a soft,
 * name-based link between the app's own connections table and Jasmin's
 * independent connector store, not a hard foreign key.
 */
export async function getBoundConnectorCids(): Promise<Set<string>> {
  const connectors = await listConnectors();
  return new Set(
    connectors.filter((c) => c.session.includes("BOUND")).map((c) => c.cid.toLowerCase())
  );
}

export interface ConnectorInput {
  cid: string;
  host: string;
  port: string | number;
  username: string;
  password: string;
  bind?: "transceiver" | "receiver" | "transmitter";
}

// Jasmin's HTTP API `tags` param reuses the connector cid to route sends — it only accepts this
// charset (see jasmin/protocols/http/endpoints/send.py), so a cid outside it breaks every send
// tagged with it, cryptically, at the Jasmin layer rather than here.
const CID_PATTERN = /^[a-zA-Z0-9-]+$/;

export async function addConnector(input: ConnectorInput): Promise<{ success: boolean; message: string }> {
  if (!CID_PATTERN.test(input.cid)) {
    return {
      success: false,
      message: "Connector ID may only contain letters, numbers, and hyphens (Jasmin rejects other characters when routing sends by this ID).",
    };
  }
  const steps = [
    "smppccm -a",
    `cid ${input.cid}`,
    `host ${input.host}`,
    `port ${input.port}`,
    `username ${input.username}`,
    `password ${input.password}`,
    `bind ${input.bind || "transceiver"}`,
    "ok",
  ];
  const results = await jcliRun(steps);
  const last = results[results.length - 1];
  const success = /Successfully added/.test(last);
  if (success) await jcliRun(["persist"]);
  return { success, message: last.replace(/\r/g, "").trim() };
}

export async function updateConnector(
  cid: string,
  fields: Partial<Omit<ConnectorInput, "cid">>
): Promise<{ success: boolean; message: string }> {
  const steps = [`smppccm -u ${cid}`];
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== "") steps.push(`${key} ${value}`);
  }
  steps.push("ok");
  const results = await jcliRun(steps);
  const last = results[results.length - 1];
  const success = /Successfully updated/.test(last);
  if (success) await jcliRun(["persist"]);
  return { success, message: last.replace(/\r/g, "").trim() };
}

/**
 * Sets a connector's outbound rate cap (Jasmin's `submit_throughput`, PDUs/sec
 * to the vendor). This is the only place vendor-side TPS is actually
 * enforced today — the app's own Connection.maxTps field is just a stored
 * number until this is called to push it into Jasmin.
 */
export async function setConnectorThroughput(
  cid: string,
  tps: number
): Promise<{ success: boolean; message: string }> {
  const steps = [`smppccm -u ${cid}`, `submit_throughput ${tps}`, "ok"];
  const results = await jcliRun(steps);
  const last = results[results.length - 1];
  const success = /Successfully updated/.test(last);
  if (success) await jcliRun(["persist"]);
  return { success, message: last.replace(/\r/g, "").trim() };
}

export async function removeConnector(cid: string): Promise<{ success: boolean; message: string }> {
  const [raw] = await jcliRun([`smppccm -r ${cid}`]);
  const success = /Successfully removed/.test(raw);
  if (success) await jcliRun(["persist"]);
  return { success, message: raw.replace(/\r/g, "").trim() };
}

export async function startConnector(cid: string): Promise<{ success: boolean; message: string }> {
  const [raw] = await jcliRun([`smppccm -1 ${cid}`]);
  return { success: !/error/i.test(raw) && !/Unknown connector/i.test(raw), message: raw.replace(/\r/g, "").trim() };
}

export async function stopConnector(cid: string): Promise<{ success: boolean; message: string }> {
  const [raw] = await jcliRun([`smppccm -0 ${cid}`]);
  return { success: !/error/i.test(raw) && !/Unknown connector/i.test(raw), message: raw.replace(/\r/g, "").trim() };
}

export function parseStatsTable(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("#") || trimmed.startsWith("#Item")) continue;
    const match = trimmed.replace(/^#/, "").match(/^(\S+)\s+(.*)$/);
    if (match) out[match[1]] = match[2].trim();
  }
  return out;
}

export async function connectorStats(cid: string): Promise<Record<string, string>> {
  const [raw] = await jcliRun([`stats --smppc=${cid}`]);
  return parseStatsTable(raw);
}

// ─── MT Routes ────────────────────────────────────────────

export interface JasminRoute {
  order: number;
  type: string;
  rate: string;
  connectorIds: string;
  filters: string;
}

export function parseRouteList(raw: string): JasminRoute[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("#") && !l.startsWith("#Order"))
    .map((l) => {
      // Columns are fixed-width, padded with 2+ spaces (Order/Type/Rate/Connector ID(s)/Filter(s))
      const cols = l.replace(/^#/, "").trim().split(/\s{2,}/);
      if (cols.length < 4) return null;
      return {
        order: parseInt(cols[0], 10),
        type: cols[1],
        rate: cols[2].trim(),
        connectorIds: cols[3].trim(),
        filters: (cols[4] || "").trim(),
      };
    })
    .filter((r): r is JasminRoute => r !== null);
}

export async function listRoutes(): Promise<JasminRoute[]> {
  const [raw] = await jcliRun(["mtrouter -l"]);
  return parseRouteList(raw);
}

export async function addDefaultRoute(cid: string, rate = "0.0"): Promise<{ success: boolean; message: string }> {
  const steps = ["mtrouter -a", "type DefaultRoute", `connector smppc(${cid})`, `rate ${rate}`, "ok"];
  const results = await jcliRun(steps);
  const last = results[results.length - 1];
  const success = /Successfully added/.test(last);
  if (success) await jcliRun(["persist"]);
  return { success, message: last.replace(/\r/g, "").trim() };
}

export async function removeRoute(order: number): Promise<{ success: boolean; message: string }> {
  const [raw] = await jcliRun([`mtrouter -r ${order}`]);
  const success = /Successfully removed/.test(raw);
  if (success) await jcliRun(["persist"]);
  return { success, message: raw.replace(/\r/g, "").trim() };
}

// ─── Filters ──────────────────────────────────────────────

export async function addFilter(
  fid: string,
  type: string,
  args: Record<string, string>
): Promise<{ success: boolean; message: string }> {
  const steps = ["filter -a", `fid ${fid}`, `type ${type}`];
  for (const [key, value] of Object.entries(args)) {
    steps.push(`${key} ${value}`);
  }
  steps.push("ok");
  const results = await jcliRun(steps);
  const last = results[results.length - 1];
  const success = /Successfully added/.test(last);
  if (success) await jcliRun(["persist"]);
  return { success, message: last.replace(/\r/g, "").trim() };
}

// ─── Vendor-tag routing ───────────────────────────────────
// Bridges the app's own Route model (customer/vendor/country/rates, stored
// in Postgres) to actual delivery: one stable TagFilter + StaticMTRoute per
// vendor connector (tag = connector CID) so the daemon can select a vendor
// per message via Jasmin's HTTP `tags` param, instead of every message
// silently falling through to the single DefaultRoute.

function nextFreeOrder(routes: JasminRoute[]): number {
  const used = routes.filter((r) => r.order > 0).map((r) => r.order);
  return used.length ? Math.max(...used) + 10 : 10;
}

export async function ensureVendorRoute(
  cid: string,
  rate = "0"
): Promise<{ success: boolean; message: string; skipped?: boolean }> {
  const routes = await listRoutes();
  const fid = `vendor_${cid}`;
  // mtrouter -l's Filter(s) column shows each filter's description (e.g.
  // "<TG (tag=acepeak)>"), not its fid — match on the tag value, with a
  // trailing ")" boundary so a cid that's a prefix of another can't collide.
  const alreadyRouted = routes.some(
    (r) => r.order > 0 && r.filters.toLowerCase().includes(`tag=${cid.toLowerCase()})`)
  );
  if (alreadyRouted) {
    return { success: true, skipped: true, message: `Route for ${cid} already exists` };
  }

  const filterResult = await addFilter(fid, "TagFilter", { tag: cid });
  if (!filterResult.success && !/already exists/i.test(filterResult.message)) {
    return { success: false, message: `Filter creation failed: ${filterResult.message}` };
  }

  const order = nextFreeOrder(routes);
  const steps = [
    "mtrouter -a",
    `order ${order}`,
    "type StaticMTRoute",
    `filters ${fid}`,
    `connector smppc(${cid})`,
    `rate ${rate}`,
    "ok",
  ];
  const results = await jcliRun(steps);
  const last = results[results.length - 1];
  const success = /Successfully added/.test(last);
  if (success) await jcliRun(["persist"]);
  return { success, message: last.replace(/\r/g, "").trim() };
}

export async function syncVendorRouting(): Promise<{
  added: string[];
  alreadySynced: string[];
  failed: string[];
}> {
  const connectors = await listConnectors();
  const added: string[] = [];
  const alreadySynced: string[] = [];
  const failed: string[] = [];

  for (const c of connectors) {
    const result = await ensureVendorRoute(c.cid);
    if (result.skipped) alreadySynced.push(c.cid);
    else if (result.success) added.push(c.cid);
    else failed.push(c.cid);
  }

  return { added, alreadySynced, failed };
}

// ─── Metrics ──────────────────────────────────────────────
// Jasmin's HTTP API exposes its own Prometheus-format counters — surfaced
// read-only on the Gateway page, not something this app writes to.

export async function getMetrics(): Promise<Record<string, number>> {
  const res = await fetch(`${JASMIN_HTTP_URL}/metrics`);
  const text = await res.text();
  const metrics: Record<string, number> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(\w+)\s+([\d.eE+-]+)$/);
    if (match) metrics[match[1]] = parseFloat(match[2]);
  }
  return metrics;
}
