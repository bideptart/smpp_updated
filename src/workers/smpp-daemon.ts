/**
 * SMPP Daemon Worker - Vendor Message Queue Processor
 * Polls sms_messages for queued rows and dispatches them either via
 * Jasmin's HTTP API (default) or, for vendor connections opted into
 * transport=DIRECT, a persistent pipelined SMPP client owned by this
 * process. Jasmin owns the actual SMPP bind for every JASMIN-transport
 * vendor; direct-smpp.ts owns the bind for DIRECT-transport vendors.
 * Run: npx tsx src/workers/smpp-daemon.ts
 */

import "dotenv/config";
import * as fs from "fs";
import { PrismaClient } from "../generated/prisma";
import { Agent, setGlobalDispatcher } from "undici";
import { findNextRoute } from "../lib/route-failover";
import { initDirectSmpp, syncDirectConnections, sendViaDirectSmpp, getDirectStatus } from "../lib/direct-smpp";

import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Node's default fetch() connection pool caps concurrent connections per
// origin at a small number (undici's default is 10) — with every message
// going to the same Jasmin HTTP API origin, that alone limits real
// throughput to roughly (10 connections / round-trip time), independent of
// Jasmin's own submit_throughput cap or the vendor's actual capacity.
// Measured directly: 1000 queued messages took ~14.7s (~68/sec) with CPU on
// Jasmin's process never exceeding ~40%, ruling out Jasmin itself as the
// bottleneck. Raising the pool here lets the daemon actually approach the
// connector's configured cap instead of queueing client-side.
setGlobalDispatcher(new Agent({ connections: 256 }));

// ─── Configuration ────────────────────────────────────────
const QUEUE_POLL_MS = 300;
const QUEUE_BATCH_SIZE = 1000;
const STATUS_FILE = "/tmp/smpp-daemon-status.json";
const PID_FILE = "/tmp/smpp-daemon.pid";
const HEARTBEAT_FILE = "/tmp/smpp-daemon.heartbeat";
const DIRECT_SYNC_MS = 15000;

// ─── State ────────────────────────────────────────────────
let running = true;
const startTime = Date.now();

// ─── Jasmin Routing ───────────────────────────────────────
const JASMIN_HTTP_URL = process.env.JASMIN_HTTP_URL || "http://127.0.0.1:1401";
const JASMIN_HTTP_USER = process.env.JASMIN_HTTP_USER || "";
const JASMIN_HTTP_PASSWORD = process.env.JASMIN_HTTP_PASSWORD || "";
const JASMIN_DLR_SECRET = process.env.JASMIN_DLR_SECRET || "";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://127.0.0.1:3001";

async function sendViaJasmin(
  msg: {
    id: bigint;
    messageId: string;
    senderId: string | null;
    destination: string;
    messageText: string | null;
    customerId: number | null;
    routeId: number | null;
    vendorConnectorCid?: string | null;
  },
  triedRouteIds: number[] = []
) {
  try {
    const params = new URLSearchParams({
      username: JASMIN_HTTP_USER,
      password: JASMIN_HTTP_PASSWORD,
      to: msg.destination,
      from: msg.senderId || "SMSLCL",
      content: msg.messageText || "",
      "dlr-url": `${APP_BASE_URL}/api/webhooks/jasmin/dlr?msgId=${encodeURIComponent(msg.messageId)}&token=${JASMIN_DLR_SECRET}`,
      "dlr-level": "3",
      "dlr-method": "GET",
    });
    // Route to the exact vendor the app's Route model selected (matched by a
    // TagFilter + StaticMTRoute per connector, set up via syncVendorRouting()).
    // If no vendor route matched, omit tags — falls through to DefaultRoute.
    if (msg.vendorConnectorCid) {
      params.set("tags", msg.vendorConnectorCid);
    }
    const res = await fetch(`${JASMIN_HTTP_URL}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const text = await res.text();
    const successMatch = text.match(/^Success "([^"]+)"/);
    // jasmin_message_id is VARCHAR(64) — a genuine message ID is always
    // short (a UUID). When Jasmin's AMQP broker connection is degraded, it
    // has been observed to report "Success" with an internal error
    // traceback crammed into that same field instead of a real ID — treat
    // an oversized match as a failure, not a success, rather than crashing
    // the DB write or silently recording a fake delivery.
    if (successMatch && successMatch[1].length <= 64) {
      await prisma.smsMessage.update({
        where: { id: msg.id },
        data: { status: "sent", sentAt: new Date(), jasminMessageId: successMatch[1] },
      });
    } else {
      const errorMatch = text.match(/^Error "([^"]*)"/);
      const failureReason = successMatch
        ? `Jasmin returned a malformed success response (${successMatch[1].length} chars) — likely an AMQP broker issue`
        : errorMatch?.[1] || text;

      if (triedRouteIds.length === 0 && msg.customerId != null && msg.routeId != null) {
        const nextRoute = await findNextRoute(prisma, msg.customerId, msg.destination, [msg.routeId]);
        if (nextRoute) {
          log(`${msg.messageId}: vendor error (${failureReason}), retrying via next-priority route ${nextRoute.id}`);
          await dispatchMessage(
            { ...msg, routeId: nextRoute.id, vendorConnectorCid: nextRoute.vendor.connections[0]?.name },
            nextRoute.vendor.connections[0]?.transport,
            [msg.routeId]
          );
          return;
        }
      }

      await prisma.smsMessage.update({
        where: { id: msg.id },
        data: {
          status: "failed",
          errorMessage: failureReason.slice(0, 250),
        },
      });
    }
  } catch (e) {
    await prisma.smsMessage
      .update({
        where: { id: msg.id },
        data: { status: "failed", errorMessage: `Jasmin request error: ${String(e)}`.slice(0, 250) },
      })
      .catch(() => {});
  }
}

// Branch dispatch by the resolved vendor connector's transport. Every
// existing connection defaults to JASMIN (undefined transport, e.g. no
// vendor connector matched at all, also falls here and goes through
// DefaultRoute exactly as before this change).
async function dispatchMessage(
  msg: {
    id: bigint;
    messageId: string;
    senderId: string | null;
    destination: string;
    messageText: string | null;
    encoding?: string;
    customerId: number | null;
    routeId: number | null;
    vendorConnectorCid?: string | null;
  },
  transport: string | undefined,
  triedRouteIds: number[] = []
) {
  if (transport === "DIRECT") {
    await sendViaDirectSmpp(msg, triedRouteIds);
  } else {
    await sendViaJasmin(msg, triedRouteIds);
  }
}

// ─── Logging ──────────────────────────────────────────────
function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`${ts} [daemon] ${msg}`);
}

// ─── Write Status File ────────────────────────────────────
function writeStatus() {
  const status = {
    pid: process.pid,
    running,
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: Math.floor(Date.now() / 1000),
    // getDirectStatus() reads this process's own in-memory bound-client map --
    // only the daemon process ever calls connectAndBind(), so this file is
    // the only way the separate web process can see direct-SMPP bind state.
    direct: getDirectStatus(),
  };

  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
    fs.writeFileSync(HEARTBEAT_FILE, String(Date.now()));
  } catch {
    // Ignore write errors on Windows dev
  }
}

// ─── Queue Processor ──────────────────────────────────────
async function processQueue() {
  while (running) {
    try {
      const messages = await prisma.smsMessage.findMany({
        where: {
          status: "queued",
          AND: [
            { OR: [{ routeId: { not: null } }, { connectionId: { not: null } }] },
            { OR: [{ campaignId: null }, { campaign: { status: { notIn: ["paused", "cancelled"] } } }] },
          ],
        },
        orderBy: { id: "asc" },
        take: QUEUE_BATCH_SIZE,
        include: {
          vendor: { include: { connections: { select: { name: true, transport: true }, take: 1 } } },
        },
      });

      if (messages.length === 0) {
        await new Promise((r) => setTimeout(r, QUEUE_POLL_MS));
        continue;
      }

      // Mark the whole batch as sending in ONE round-trip (not one per message)
      await prisma.smsMessage.updateMany({
        where: { id: { in: messages.map((m) => m.id) } },
        data: { status: "sending" },
      });

      for (const msg of messages) {
        if (!running) break;
        const connector = msg.vendor?.connections[0];
        // Fire-and-forget: don't block the queue loop on the send round trip.
        dispatchMessage({ ...msg, vendorConnectorCid: connector?.name }, connector?.transport);
      }
      // No inter-send delay — pipeline the next batch immediately
    } catch (error) {
      log(`Queue error: ${error}`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

// ─── Graceful Shutdown ────────────────────────────────────
function shutdown() {
  log("Shutting down...");
  running = false;
  writeStatus();

  setTimeout(() => {
    prisma.$disconnect();
    process.exit(0);
  }, 2000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ─── Main ─────────────────────────────────────────────────
async function main() {
  log("Starting SMPP Daemon...");

  // Write PID
  try {
    fs.writeFileSync(PID_FILE, String(process.pid));
  } catch {}

  initDirectSmpp(prisma, log);
  await syncDirectConnections().catch((e) => log(`Direct SMPP sync error: ${e}`));

  writeStatus();
  processQueue();

  // Refresh the status/heartbeat file periodically so consumers can tell the
  // queue processor is alive.
  setInterval(writeStatus, 10000);

  // Pick up newly-added/removed DIRECT-transport connections and maxTps
  // edits without a daemon restart.
  setInterval(() => {
    syncDirectConnections().catch((e) => log(`Direct SMPP sync error: ${e}`));
  }, DIRECT_SYNC_MS);

  // Scheduled campaigns: process every 60s
  setInterval(() => {
    processSchedules().catch((e) => log(`Schedule error: ${e}`));
  }, 60000);
  // Run once immediately on startup
  processSchedules().catch((e) => log(`Schedule error: ${e}`));

  log("SMPP Daemon running. Press Ctrl+C to stop.");
}

// ─── Process Scheduled Campaigns ──────────────────────────
async function processSchedules() {
  const now = new Date();
  // Fetch all pending schedules whose next_run_at has passed
  const due = await prisma.scheduledCampaign.findMany({
    where: {
      status: "pending",
      nextRunAt: { lte: now },
    },
    take: 20,
  });

  if (due.length === 0) return;

  for (const campaign of due) {
    try {
      log(`Processing scheduled campaign ${campaign.id} (${campaign.recipientsCount} recipients)`);

      // Mark as sending to prevent double-processing
      await prisma.scheduledCampaign.update({
        where: { id: campaign.id },
        data: { status: "sending" },
      });

      // Enqueue an SMS row for each recipient
      const recipients = Array.isArray(campaign.recipientsJson) ? campaign.recipientsJson : [];
      let queued = 0;
      for (const r of recipients as Array<Record<string, unknown>>) {
        const phone = String((r as { phone?: string }).phone || "")
          .replace(/\s+/g, "")
          .replace(/^\+/, "");
        if (!phone || phone.length < 7) continue;

        const messageId = `SCHED-${campaign.id}-${Date.now()}-${queued}`;
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO sms_messages (message_id, customer_id, vendor_id, route_id, sender_id, destination, message_text, encoding, parts, status, selling_rate, buying_rate, submitted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::"SmsEncoding", $9, $10::"SmsStatus", $11, $12, NOW())`,
            messageId,
            campaign.customerId,
            null,
            campaign.routeId,
            campaign.senderId,
            phone,
            campaign.messageText,
            campaign.encoding === "UCS2" ? "UCS-2" : "GSM-7",
            1,
            "queued",
            0,
            0,
          );
          queued++;
        } catch (e) {
          log(`Queue insert failed for ${phone}: ${e}`);
        }
      }

      // Compute next run for repeating schedules
      const nextRun = computeNextRun(campaign.nextRunAt || campaign.scheduledAt, campaign.repeatFreq);
      const newStatus = nextRun ? "pending" : "completed";

      await prisma.scheduledCampaign.update({
        where: { id: campaign.id },
        data: {
          status: newStatus,
          lastRunAt: now,
          runCount: { increment: 1 },
          nextRunAt: nextRun,
        },
      });

      log(`Scheduled ${campaign.id}: queued ${queued} SMS, next run: ${nextRun?.toISOString() || "completed"}`);
    } catch (e) {
      log(`Failed to process campaign ${campaign.id}: ${e}`);
      await prisma.scheduledCampaign
        .update({ where: { id: campaign.id }, data: { status: "failed" } })
        .catch(() => {});
    }
  }
}

function computeNextRun(current: Date | null, freq: string): Date | null {
  if (!current || freq === "none") return null;
  const d = new Date(current);
  switch (freq) {
    case "hourly":
      d.setHours(d.getHours() + 1);
      break;
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      return null;
  }
  return d;
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
