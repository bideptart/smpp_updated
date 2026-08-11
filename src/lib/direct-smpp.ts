/**
 * Direct SMPP outbound client -- bypasses Jasmin for vendor connections
 * opted into transport=DIRECT. Jasmin's SMPP client processes exactly one
 * submit_sm at a time per connector (prefetch_count=1, by Jasmin's own
 * design), capping real throughput at ~1/round-trip-time regardless of the
 * configured submit_throughput. This client instead pipelines many
 * submit_sm requests in flight (matched to responses by sequence number via
 * the `smpp` library) and enforces the actual rate limit itself with a
 * token bucket keyed to each Connection's maxTps -- the one dial the user
 * controls, with nothing else capping it.
 */

import smpp from "smpp";
import type { PrismaClient } from "../generated/prisma";
import { decrypt } from "./encrypt";
import { findNextRoute } from "./route-failover";

export interface DirectConnRow {
  id: number;
  name: string;
  host: string | null;
  port: number | null;
  username: string | null;
  password: string | null;
  maxTps: number;
}

interface DirectClient {
  connectionId: number;
  cid: string;
  row: DirectConnRow;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any;
  bound: boolean;
  tokens: number;
  lastRefill: number;
  reconnectDelay: number;
  reconnectTimer?: NodeJS.Timeout;
  destroyed: boolean;
  // Vendor message_id -> our messageId, for correlating deliver_sm DLRs back
  // to the SmsMessage row that was submitted.
  pendingDlr: Map<string, string>;
  // Lifetime counters for reporting -- reset on daemon restart, not
  // persisted (Jasmin's connectorStats has the same "since last restart"
  // semantics, so this is a like-for-like replacement, not a regression).
  submitted: number;
  delivered: number;
  failed: number;
  lastActivity: number | null;
}

const RECONNECT_MIN_MS = 2000;
const RECONNECT_MAX_MS = 60000;
const TOKEN_POLL_MS = 10;

const clientsById = new Map<number, DirectClient>();
const clientsByName = new Map<string, DirectClient>();

let prisma: PrismaClient;
let log: (msg: string) => void = (m) => console.log(m);

export function initDirectSmpp(p: PrismaClient, logger?: (msg: string) => void) {
  prisma = p;
  if (logger) log = logger;
}

// ─── Token bucket ─────────────────────────────────────────
function refill(client: DirectClient) {
  const now = Date.now();
  const elapsedSec = (now - client.lastRefill) / 1000;
  client.tokens = Math.min(client.row.maxTps, client.tokens + elapsedSec * client.row.maxTps);
  client.lastRefill = now;
}

async function acquireToken(client: DirectClient): Promise<void> {
  for (;;) {
    refill(client);
    if (client.tokens >= 1) {
      client.tokens -= 1;
      return;
    }
    await new Promise((r) => setTimeout(r, TOKEN_POLL_MS));
  }
}

// ─── Multi-part UDH splitting ─────────────────────────────
// Standard concatenated-SMS UDH: [total-udh-len, IEI=0x00, IEDL=3, ref, total, seq].
// Note: for GSM7 parts, the SMPP spec technically requires septet-alignment
// padding after the UDH so the packed message starts on a clean septet
// boundary -- the `smpp` library does not add this automatically for the
// generic concatenation IEI. This works correctly for UCS2 (byte-aligned,
// no packing). GSM7 multi-part rendering must be confirmed with a real
// live test (task: verify direct SMPP client) before being trusted; fix
// here with real evidence if a live multi-part GSM7 test shows corruption.
function splitForUdh(
  text: string,
  encoding: "GSM7" | "UCS2"
): Array<{ udh: Buffer | null; message: string }> {
  const isUcs2 = encoding === "UCS2";
  const singlePartLimit = isUcs2 ? 70 : 160;
  if (text.length <= singlePartLimit) {
    return [{ udh: null, message: text }];
  }
  const perPart = isUcs2 ? 67 : 153;
  const total = Math.ceil(text.length / perPart);
  const ref = Math.floor(Math.random() * 256);
  const parts: Array<{ udh: Buffer; message: string }> = [];
  for (let i = 0; i < total; i++) {
    const chunk = text.slice(i * perPart, (i + 1) * perPart);
    const udh = Buffer.from([0x05, 0x00, 0x03, ref, total, i + 1]);
    parts.push({ udh, message: chunk });
  }
  return parts;
}

// ─── Delivery receipt parsing ─────────────────────────────
// Standard SMPP DLR text format in deliver_sm's short_message:
// "id:IIIIIIIIII sub:001 dlvrd:001 submit date:YYMMDDhhmm done date:YYMMDDhhmm stat:DELIVRD err:000 text:..."
const DELIVERED_STATUSES = new Set(["DELIVRD"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleDeliverSm(client: DirectClient, pdu: any) {
  const text: string = pdu.short_message?.message?.toString?.() ?? String(pdu.short_message || "");
  const idMatch = text.match(/id:(\S+)/);
  const statMatch = text.match(/stat:(\S+)/);
  if (!idMatch) return; // not a DLR (e.g. a real inbound MO on this bind) -- ignore, direct-mode is MT-only today
  const vendorMessageId = idMatch[1];
  const status = statMatch?.[1] || "";
  const messageId = client.pendingDlr.get(vendorMessageId);
  if (!messageId) return;
  client.pendingDlr.delete(vendorMessageId);

  const isDelivered = DELIVERED_STATUSES.has(status.toUpperCase());
  if (isDelivered) client.delivered++;
  client.lastActivity = Date.now();
  prisma.smsMessage
    .update({
      where: { messageId },
      data: {
        status: isDelivered ? "delivered" : "failed",
        deliveredAt: isDelivered ? new Date() : undefined,
        dlrReceivedAt: new Date(),
        errorMessage: isDelivered ? null : `DLR: ${status || "not delivered"}`.slice(0, 250),
      },
    })
    .catch((e) => log(`[direct-smpp] ${client.cid}: DLR update failed for ${messageId}: ${e}`));
}

// ─── Connect / bind / reconnect ───────────────────────────
function scheduleReconnect(client: DirectClient) {
  if (client.reconnectTimer || client.destroyed) return;
  client.reconnectTimer = setTimeout(() => {
    client.reconnectTimer = undefined;
    connectAndBind(client.row);
  }, client.reconnectDelay);
  client.reconnectDelay = Math.min(client.reconnectDelay * 2, RECONNECT_MAX_MS);
}

export function connectAndBind(row: DirectConnRow) {
  if (!row.host || !row.port || !row.username) {
    log(`[direct-smpp] ${row.name}: missing host/port/username, cannot bind`);
    return;
  }

  const existing = clientsById.get(row.id);
  const client: DirectClient = existing || {
    connectionId: row.id,
    cid: row.name,
    row,
    session: null,
    bound: false,
    tokens: row.maxTps || 10,
    lastRefill: Date.now(),
    reconnectDelay: RECONNECT_MIN_MS,
    destroyed: false,
    pendingDlr: new Map(),
    submitted: 0,
    delivered: 0,
    failed: 0,
    lastActivity: null,
  };
  client.row = row;

  const session = smpp.connect(
    { url: `smpp://${row.host}:${row.port}`, auto_enquire_link_period: 30000 },
    () => {
      const password = row.password ? decrypt(row.password) : "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      session.bind_transceiver({ system_id: row.username!, password }, (pdu: any) => {
        if (pdu.command_status === 0) {
          client.bound = true;
          client.reconnectDelay = RECONNECT_MIN_MS;
          log(`[direct-smpp] ${row.name}: bound (transceiver)`);
        } else {
          client.bound = false;
          log(`[direct-smpp] ${row.name}: bind failed, command_status=${pdu.command_status}`);
          session.close();
        }
      });
    }
  );

  session.on("error", (err: Error) => {
    log(`[direct-smpp] ${row.name}: session error: ${err.message}`);
  });
  session.on("close", () => {
    client.bound = false;
    if (client.destroyed) return;
    log(`[direct-smpp] ${row.name}: connection closed, reconnecting in ${client.reconnectDelay}ms`);
    scheduleReconnect(client);
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session.on("deliver_sm", (pdu: any) => {
    session.send(pdu.response());
    handleDeliverSm(client, pdu);
  });

  client.session = session;
  clientsById.set(row.id, client);
  clientsByName.set(row.name, client);
}

export function disconnectAndForget(connectionId: number) {
  const client = clientsById.get(connectionId);
  if (!client) return;
  client.destroyed = true;
  if (client.reconnectTimer) clearTimeout(client.reconnectTimer);
  try {
    client.session?.close();
  } catch {
    // already closed
  }
  clientsById.delete(connectionId);
  clientsByName.delete(client.cid);
}

/**
 * Keeps live direct-mode binds in sync with the DB: connects any active
 * SMPP+DIRECT connection not yet bound, and tears down any that were
 * deactivated or flipped back to JASMIN. Call this on a periodic interval
 * from the daemon, same shape as the old reloadConnections() before Phase 5
 * removed it (but now scoped to only DIRECT-transport connections).
 */
export async function syncDirectConnections() {
  const rows = await prisma.connection.findMany({
    where: { type: "SMPP", transport: "DIRECT", status: "active" },
    select: { id: true, name: true, host: true, port: true, username: true, password: true, maxTps: true },
  });
  const activeIds = new Set(rows.map((r) => r.id));

  for (const row of rows) {
    if (!clientsById.has(row.id)) {
      connectAndBind(row);
    } else {
      // Pick up maxTps/credential edits without a full reconnect.
      const client = clientsById.get(row.id)!;
      client.row = row;
    }
  }
  for (const id of clientsById.keys()) {
    if (!activeIds.has(id)) disconnectAndForget(id);
  }
}

export function isDirectBound(connectorCid: string): boolean {
  return clientsByName.get(connectorCid)?.bound ?? false;
}

export interface DirectStatus {
  cid: string;
  bound: boolean;
  maxTps: number;
  submitted: number;
  delivered: number;
  failed: number;
  lastActivity: number | null;
}

// Like-for-like replacement for reading Jasmin's connectorStats() when a
// connection is on DIRECT transport -- same "since last daemon restart"
// semantics, just sourced from this process's own counters instead of
// Jasmin's, since there is no Jasmin connector to ask for a DIRECT vendor.
export function getDirectStatus(): DirectStatus[] {
  return Array.from(clientsByName.values()).map((c) => ({
    cid: c.cid,
    bound: c.bound,
    maxTps: c.row.maxTps,
    submitted: c.submitted,
    delivered: c.delivered,
    failed: c.failed,
    lastActivity: c.lastActivity,
  }));
}

// ─── Sending ──────────────────────────────────────────────
interface DirectSendMsg {
  id: bigint;
  messageId: string;
  senderId: string | null;
  destination: string;
  messageText: string | null;
  encoding?: string;
  customerId: number | null;
  routeId: number | null;
  vendorConnectorCid?: string | null;
}

async function markFailed(msg: DirectSendMsg, reason: string) {
  await prisma.smsMessage
    .update({ where: { id: msg.id }, data: { status: "failed", errorMessage: reason.slice(0, 250) } })
    .catch(() => {});
}

export async function sendViaDirectSmpp(msg: DirectSendMsg, triedRouteIds: number[] = []): Promise<void> {
  const client = msg.vendorConnectorCid ? clientsByName.get(msg.vendorConnectorCid) : undefined;

  if (!client || !client.bound) {
    const reason = `Direct connector "${msg.vendorConnectorCid || "(none)"}" not bound`;
    if (triedRouteIds.length === 0 && msg.customerId != null && msg.routeId != null) {
      const next = await findNextRoute(prisma, msg.customerId, msg.destination, [msg.routeId]);
      const nextCid = next?.vendor.connections[0]?.name;
      if (next && nextCid && isDirectBound(nextCid)) {
        log(`${msg.messageId}: ${reason}, retrying via next-priority direct route ${next.id}`);
        await sendViaDirectSmpp({ ...msg, routeId: next.id, vendorConnectorCid: nextCid }, [msg.routeId]);
        return;
      }
    }
    await markFailed(msg, reason);
    return;
  }

  await acquireToken(client);

  const encoding = msg.encoding === "UCS2" ? "UCS2" : "GSM7";
  const segments = splitForUdh(msg.messageText || "", encoding);

  try {
    const results = await Promise.all(
      segments.map(
        (seg) =>
          new Promise<{ status: number; message_id?: string }>((resolve) => {
            client.session.submit_sm(
              {
                source_addr: msg.senderId || "SMSLCL",
                destination_addr: msg.destination,
                short_message: seg.udh ? { udh: seg.udh, message: seg.message } : seg.message,
                registered_delivery: 1,
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (pdu: any) => resolve({ status: pdu.command_status, message_id: pdu.message_id })
            );
          })
      )
    );

    client.lastActivity = Date.now();

    const failedPart = results.find((r) => r.status !== 0);
    if (failedPart) {
      client.failed++;
      const reason = `Vendor rejected submit_sm (command_status ${failedPart.status})`;
      if (triedRouteIds.length === 0 && msg.customerId != null && msg.routeId != null) {
        const next = await findNextRoute(prisma, msg.customerId, msg.destination, [msg.routeId]);
        const nextCid = next?.vendor.connections[0]?.name;
        if (next && nextCid && isDirectBound(nextCid)) {
          log(`${msg.messageId}: ${reason}, retrying via next-priority direct route ${next.id}`);
          await sendViaDirectSmpp({ ...msg, routeId: next.id, vendorConnectorCid: nextCid }, [msg.routeId]);
          return;
        }
      }
      await markFailed(msg, reason);
      return;
    }

    client.submitted++;
    for (const r of results) {
      if (r.message_id) client.pendingDlr.set(r.message_id, msg.messageId);
    }

    await prisma.smsMessage.update({
      where: { id: msg.id },
      data: { status: "sent", sentAt: new Date(), jasminMessageId: results[0]?.message_id || null },
    });
  } catch (e) {
    client.failed++;
    await markFailed(msg, `Direct SMPP error: ${String(e)}`);
  }
}
