/**
 * SMPP Server Worker - Customer Connection Handler
 * Listens on port 2775 for wholesale customer SMPP connections
 * Run: npx tsx src/workers/smpp-server.ts
 */

import "dotenv/config";
import * as net from "net";
import * as fs from "fs";
import * as crypto from "crypto";
import { lookup as dnsLookup } from "dns/promises";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma";
import {
  CMD,
  STATUS,
  SmppStreamBuffer,
  buildBindTransceiverResp,
  buildSubmitSmResp,
  buildEnquireLink,
  buildEnquireLinkResp,
  buildUnbindResp,
  parseSubmitSm,
  parseBind,
  commandName,
  type Pdu,
} from "./smpp-protocol";

import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── Configuration ────────────────────────────────────────
const LISTEN_PORT = parseInt(process.env.SMPP_PORT || "2775");
const MAX_CLIENTS = 50;
const IDLE_TIMEOUT_MS = 120000;
const ENQUIRE_INTERVAL_MS = 30000;
const ASSIGNED_IP_CHECK_INTERVAL_MS = 15000;
const STATUS_FILE = "/tmp/smpp-server-status.json";

// ─── State ────────────────────────────────────────────────
interface ClientSession {
  socket: net.Socket;
  streamBuffer: SmppStreamBuffer;
  accountId: number | null;
  systemId: string | null;
  companyId: number | null;
  bound: boolean;
  clientIp: string;
  localIp: string;
  connectedAt: Date;
  lastActivity: Date;
  msgCount: number;
  enquireTimer: NodeJS.Timeout | null;
  // Enhanced TX/RX counters
  txRequests: number;
  txResponses: number;
  rxRequests: number;
  rxResponses: number;
  bindType: string;
  maxTps?: number;
  tpsWindowStart?: number;
  tpsCount?: number;
}

const clients: Map<string, ClientSession> = new Map();
let running = true;
const startTime = Date.now();
let totalBinds = 0;
let totalMsgs = 0;
let totalRejections = 0;

// ─── Logging ──────────────────────────────────────────────
function log(msg: string, clientIp?: string) {
  const ts = new Date().toISOString();
  const prefix = clientIp ? `[${clientIp}]` : "[server]";
  console.log(`${ts} ${prefix} ${msg}`);
}

// ─── Write Status File ────────────────────────────────────
function writeStatus() {
  const boundClients: Array<Record<string, unknown>> = [];

  clients.forEach((c) => {
    if (c.bound) {
      const uptimeSec = (Date.now() - c.connectedAt.getTime()) / 1000;
      boundClients.push({
        system_id: c.systemId || "unknown",
        client_ip: c.clientIp,
        connected_at: c.connectedAt.toISOString(),
        last_activity: c.lastActivity.toISOString(),
        msgs: c.msgCount,
        bind_type: c.bindType || "Transceiver",
        tx_requests: c.txRequests,
        tx_responses: c.txResponses,
        rx_requests: c.rxRequests,
        rx_responses: c.rxResponses,
        tx_rate: uptimeSec > 0 ? +(c.txRequests / uptimeSec).toFixed(2) : 0,
        rx_rate: uptimeSec > 0 ? +(c.rxRequests / uptimeSec).toFixed(2) : 0,
        queue_size: 0,
      });
    }
  });

  const status = {
    pid: process.pid,
    running,
    listen_port: LISTEN_PORT,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    active_clients: clients.size,
    bound_clients: boundClients,
    total_binds: totalBinds,
    total_msgs: totalMsgs,
    total_rejections: totalRejections,
    timestamp: Math.floor(Date.now() / 1000),
  };

  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
  } catch {
    // Ignore on Windows dev
  }
}

// ─── Generate Message ID ──────────────────────────────────
function generateMessageId(): string {
  const hex = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `BSS${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 12)}${hex.slice(0, 4)}`;
}

// ─── Handle Client Connection ─────────────────────────────
function handleClient(socket: net.Socket) {
  const clientIp = socket.remoteAddress?.replace("::ffff:", "") || "unknown";
  const localIp = socket.localAddress?.replace("::ffff:", "") || "unknown";
  const clientKey = `${clientIp}:${socket.remotePort}`;

  if (clients.size >= MAX_CLIENTS) {
    log(`Max clients reached, rejecting`, clientIp);
    socket.destroy();
    return;
  }

  const session: ClientSession = {
    socket,
    streamBuffer: new SmppStreamBuffer(),
    accountId: null,
    systemId: null,
    companyId: null,
    bound: false,
    clientIp,
    localIp,
    connectedAt: new Date(),
    lastActivity: new Date(),
    msgCount: 0,
    enquireTimer: null,
    txRequests: 0,
    txResponses: 0,
    rxRequests: 0,
    rxResponses: 0,
    bindType: "Transceiver",
  };

  clients.set(clientKey, session);
  log(`New connection`, clientIp);

  // Idle timeout
  socket.setTimeout(IDLE_TIMEOUT_MS);
  socket.on("timeout", () => {
    log(`Idle timeout`, clientIp);
    socket.destroy();
  });

  socket.on("data", (data: Buffer) => {
    session.lastActivity = new Date();
    session.streamBuffer.append(data);

    let pdu: Pdu | null;
    while ((pdu = session.streamBuffer.extractPdu()) !== null) {
      handleClientPdu(session, pdu);
    }
  });

  socket.on("error", (err: Error) => {
    log(`Error: ${err.message}`, clientIp);
  });

  socket.on("close", () => {
    log(`Disconnected (system_id=${session.systemId || "none"})`, clientIp);
    if (session.enquireTimer) clearInterval(session.enquireTimer);
    clients.delete(clientKey);
    writeStatus();
  });
}

// ─── Handle PDU from Customer ─────────────────────────────
async function handleClientPdu(session: ClientSession, pdu: Pdu) {
  const cmdName = commandName(pdu.header.commandId);
  // Track RX from client (all incoming are requests from client's perspective)
  session.rxRequests++;

  switch (pdu.header.commandId) {
    case CMD.BIND_TRANSCEIVER:
    case CMD.BIND_TRANSMITTER:
    case CMD.BIND_RECEIVER: {
      await handleBind(session, pdu);
      break;
    }

    case CMD.SUBMIT_SM: {
      if (!session.bound) {
        session.socket.write(
          buildSubmitSmResp(pdu.header.sequenceNumber, STATUS.ESME_RINVBNDSTS)
        );
        return;
      }
      await handleSubmitSm(session, pdu);
      break;
    }

    case CMD.ENQUIRE_LINK: {
      session.socket.write(buildEnquireLinkResp(pdu.header.sequenceNumber));
      session.txResponses++;
      break;
    }

    case CMD.ENQUIRE_LINK_RESP: {
      // OK
      break;
    }

    case CMD.UNBIND: {
      session.socket.write(buildUnbindResp(pdu.header.sequenceNumber));
      session.txResponses++;
      session.bound = false;
      // Log unbind
      if (session.accountId) {
        prisma.smppBindLog.create({
          data: {
            accountId: session.accountId,
            systemId: session.systemId,
            clientIp: session.clientIp,
            action: "unbind",
            reason: "Client unbind",
          },
        }).catch(() => {});
      }
      session.socket.destroy();
      break;
    }

    default:
      log(`Unhandled: ${cmdName}`, session.clientIp);
  }
}

// ─── Handle Bind ──────────────────────────────────────────
async function handleBind(session: ClientSession, pdu: Pdu) {
  const fields = parseBind(pdu.body);
  log(`BIND request: system_id=${fields.systemId}`, session.clientIp);

  try {
    // Lookup account
    const account = await prisma.customerSmppAccount.findUnique({
      where: { systemId: fields.systemId },
    });

    if (!account) {
      log(`Invalid system_id: ${fields.systemId}`, session.clientIp);
      session.socket.write(
        buildBindTransceiverResp(pdu.header.sequenceNumber, STATUS.ESME_RINVSYSID)
      );
      await logBind(null, fields.systemId, session.clientIp, "rejected", `Invalid system_id`);
      totalRejections++;
      writeStatus();
      return;
    }

    // Check password (bcrypt; plaintext fallback for any un-migrated row)
    const pwOk = account.password.startsWith("$2")
      ? await bcrypt.compare(fields.password || "", account.password)
      : account.password === fields.password;
    if (!pwOk) {
      log(`Invalid password for ${fields.systemId}`, session.clientIp);
      session.socket.write(
        buildBindTransceiverResp(pdu.header.sequenceNumber, STATUS.ESME_RINVPASWD)
      );
      await logBind(account.id, fields.systemId, session.clientIp, "rejected", "Invalid password");
      totalRejections++;
      writeStatus();
      return;
    }

    // Check account status
    if (account.status !== "active") {
      log(`Account suspended: ${fields.systemId}`, session.clientIp);
      session.socket.write(
        buildBindTransceiverResp(pdu.header.sequenceNumber, STATUS.ESME_RINVBNDSTS)
      );
      await logBind(account.id, fields.systemId, session.clientIp, "rejected", `Account ${account.status}`);
      totalRejections++;
      writeStatus();
      return;
    }

    // Check IP / hostname whitelist ("*" = allow any; entries may be IPs or SMSC hostnames)
    if (account.disableIpBlocking !== "yes") {
      const entries = account.allowedIps
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (entries.length > 0 && !entries.includes("*")) {
        const allowed = new Set<string>();
        for (const e of entries) {
          if (/^[0-9.]+$/.test(e) || e.includes(":")) {
            allowed.add(e); // literal IP (v4/v6)
          } else {
            try {
              const recs = await dnsLookup(e, { all: true });
              for (const r of recs) allowed.add(r.address.replace("::ffff:", ""));
            } catch {
              log(`Could not resolve allowed host "${e}"`, session.clientIp);
            }
          }
        }
        if (!allowed.has(session.clientIp)) {
          log(`IP ${session.clientIp} not whitelisted for ${fields.systemId}`, session.clientIp);
          session.socket.write(
            buildBindTransceiverResp(pdu.header.sequenceNumber, STATUS.ESME_RINVBNDSTS)
          );
          await logBind(account.id, fields.systemId, session.clientIp, "rejected", `IP ${session.clientIp} not whitelisted`);
          totalRejections++;
          writeStatus();
          return;
        }
      }
    }

    // Check assigned server IP (which of this server's own IPs the customer must dial;
    // null means unrestricted -- any of the server's IPs works)
    if (account.assignedIp && account.assignedIp !== session.localIp) {
      log(
        `Wrong server IP for ${fields.systemId}: assigned ${account.assignedIp}, connected via ${session.localIp}`,
        session.clientIp
      );
      session.socket.write(
        buildBindTransceiverResp(pdu.header.sequenceNumber, STATUS.ESME_RINVBNDSTS)
      );
      await logBind(
        account.id,
        fields.systemId,
        session.clientIp,
        "rejected",
        `Wrong server IP: expected ${account.assignedIp}, got ${session.localIp}`
      );
      totalRejections++;
      writeStatus();
      return;
    }

    // Enforce max concurrent connections per account
    if (account.maxConnections && account.maxConnections > 0) {
      let activeForAccount = 0;
      for (const [, s2] of clients) if (s2.bound && s2.accountId === account.id) activeForAccount++;
      if (activeForAccount >= account.maxConnections) {
        log(`Max connections (${account.maxConnections}) reached for ${fields.systemId}`, session.clientIp);
        session.socket.write(buildBindTransceiverResp(pdu.header.sequenceNumber, STATUS.ESME_RINVBNDSTS));
        await logBind(account.id, fields.systemId, session.clientIp, "rejected", "Max connections reached");
        totalRejections++; writeStatus(); return;
      }
    }

    // Success!
    session.bound = true;
    session.maxTps = account.maxTps || 0;
    session.accountId = account.id;
    session.systemId = fields.systemId;
    session.companyId = account.companyId;
    session.bindType = pdu.header.commandId === CMD.BIND_TRANSMITTER ? "Transmitter"
      : pdu.header.commandId === CMD.BIND_RECEIVER ? "Receiver" : "Transceiver";
    totalBinds++;

    session.socket.write(
      buildBindTransceiverResp(pdu.header.sequenceNumber, STATUS.ESME_ROK, "SMSLocal")
    );
    session.txResponses++;

    // Update last bind info
    await prisma.customerSmppAccount.update({
      where: { id: account.id },
      data: { lastBindAt: new Date(), lastBindIp: session.clientIp },
    });

    await logBind(account.id, fields.systemId, session.clientIp, "bind", "Authenticated OK");

    // Start enquire_link
    session.enquireTimer = setInterval(() => {
      if (session.bound) {
        session.socket.write(buildEnquireLink());
      }
    }, ENQUIRE_INTERVAL_MS);

    log(`Bind OK: system_id=${fields.systemId} company_id=${account.companyId}`, session.clientIp);
    writeStatus();
  } catch (error) {
    log(`Bind error: ${error}`, session.clientIp);
    session.socket.write(
      buildBindTransceiverResp(pdu.header.sequenceNumber, STATUS.ESME_RSYSERR)
    );
  }
}

// ─── Handle Submit SM from Customer ───────────────────────
async function handleSubmitSm(session: ClientSession, pdu: Pdu) {
  try {
    const fields = parseSubmitSm(pdu.body);

    // Per-customer TPS limit (token bucket, 1s window) — protects the vendor from floods
    const tpsLimit = session.maxTps ?? 0;
    if (tpsLimit > 0) {
      const nowMs = Date.now();
      if (!session.tpsWindowStart || nowMs - session.tpsWindowStart >= 1000) {
        session.tpsWindowStart = nowMs;
        session.tpsCount = 0;
      }
      if ((session.tpsCount ?? 0) >= tpsLimit) {
        session.socket.write(buildSubmitSmResp(pdu.header.sequenceNumber, 0x58)); // ESME_RTHROTTLED
        return;
      }
      session.tpsCount = (session.tpsCount ?? 0) + 1;
    }

    const msgId = generateMessageId();

    const encodingDb = fields.dataCoding === 0x08 ? "UCS2" : "GSM7";

    // ─── Resolve route (customer → vendor) ───
    const destNorm = (fields.destAddr || "").replace(/^\+/, "");
    let routeId: number | null = null;
    let vendorId: number | null = null;
    let cost = 0;
    let buyingRate = 0;
    if (session.companyId) {
      const routes = await prisma.route.findMany({
        where: { customerId: session.companyId, isActive: true },
        orderBy: { priority: "asc" },
      });
      const matched =
        routes.find((r) => {
          const cc = (r.countryCode || "").replace(/^\+/, "");
          const px = r.numberPrefix || "";
          return destNorm.startsWith(cc + px);
        }) || routes[0] || null;
      if (matched) {
        routeId = matched.id;
        vendorId = matched.vendorId;
        cost = Number(matched.sellingRate) || 0;
        buyingRate = Number(matched.buyingRate) || 0;
      }
    }
    if (!routeId) {
      log(`No active route for company_id=${session.companyId} dest=${fields.destAddr} — message stays queued`, session.clientIp);
    }

    // Credit check: atomically deduct the customer's balance; reject if insufficient
    if (cost > 0 && session.companyId) {
      const ok = await prisma.$executeRawUnsafe(
        `UPDATE companies SET balance = balance - $1 WHERE id = $2 AND balance >= $1`,
        cost,
        session.companyId
      );
      if (ok === 0) {
        log(`Insufficient balance for company_id=${session.companyId} (need ${cost})`, session.clientIp);
        session.socket.write(buildSubmitSmResp(pdu.header.sequenceNumber, 0x14)); // ESME_RMSGQFUL
        return;
      }
    }

    // Insert message as queued (routed to vendor)
    await prisma.smsMessage.create({
      data: {
        messageId: msgId,
        customerAccountId: session.accountId,
        customerId: session.companyId ?? null,
        routeId,
        vendorId,
        senderId: fields.sourceAddr || "SMSLCL",
        destination: fields.destAddr,
        messageText: fields.shortMessage,
        encoding: encodingDb as "GSM7" | "UCS2",
        parts: 1,
        status: "queued",
        sourceIp: session.clientIp,
        submittedAt: new Date(),
        sellingRate: cost,
        buyingRate,
      },
    });

    // Update account counters
    await prisma.customerSmppAccount.update({
      where: { id: session.accountId! },
      data: { totalSent: { increment: 1 } },
    });

    session.msgCount++;
    totalMsgs++;

    // Respond with success
    session.socket.write(
      buildSubmitSmResp(pdu.header.sequenceNumber, STATUS.ESME_ROK, msgId)
    );

    log(`SUBMIT_SM: from=${fields.sourceAddr} to=${fields.destAddr} msg_id=${msgId}`, session.clientIp);
    writeStatus();
  } catch (error) {
    log(`Submit error: ${error}`, session.clientIp);
    session.socket.write(
      buildSubmitSmResp(pdu.header.sequenceNumber, STATUS.ESME_RSYSERR)
    );
  }
}

// ─── Log Bind Attempt ─────────────────────────────────────
async function logBind(
  accountId: number | null,
  systemId: string,
  clientIp: string,
  action: "bind" | "unbind" | "rejected" | "error",
  reason: string
) {
  try {
    await prisma.smppBindLog.create({
      data: { accountId, systemId, clientIp, action, reason },
    });
  } catch (error) {
    log(`Failed to log bind: ${error}`);
  }
}

// ─── Re-validate bound sessions against their account's assigned IP ──────
// The assigned-IP check normally only runs at bind time, so a session bound
// before an admin changed this setting would otherwise stay connected
// indefinitely. This sweep catches that by periodically re-checking every
// currently-bound session against the account's current setting and kicking
// any that no longer match, so a config change takes effect within seconds
// instead of waiting for the customer's client to reconnect on its own.
async function enforceAssignedIps() {
  const boundAccountIds = new Set<number>();
  for (const [, s] of clients) {
    if (s.bound && s.accountId !== null) boundAccountIds.add(s.accountId);
  }
  if (boundAccountIds.size === 0) return;

  const accounts = await prisma.customerSmppAccount.findMany({
    where: { id: { in: Array.from(boundAccountIds) } },
    select: { id: true, systemId: true, assignedIp: true },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));

  for (const [, session] of clients) {
    if (!session.bound || session.accountId === null) continue;
    const account = byId.get(session.accountId);
    if (!account || !account.assignedIp) continue;
    if (account.assignedIp !== session.localIp) {
      log(
        `Kicking ${account.systemId}: assigned IP is now ${account.assignedIp}, this session is on ${session.localIp}`,
        session.clientIp
      );
      logBind(
        account.id,
        account.systemId,
        session.clientIp,
        "rejected",
        `Assigned IP changed to ${account.assignedIp}; disconnected stale session on ${session.localIp}`
      ).catch(() => {});
      session.socket.destroy();
    }
  }
}

// ─── Graceful Shutdown ────────────────────────────────────
function shutdown() {
  log("Shutting down SMPP Server...");
  running = false;

  clients.forEach((session) => {
    if (session.enquireTimer) clearInterval(session.enquireTimer);
    session.socket.destroy();
  });

  writeStatus();

  setTimeout(() => {
    prisma.$disconnect();
    process.exit(0);
  }, 2000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ─── Start Server ─────────────────────────────────────────
const server = net.createServer(handleClient);

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  log(`SMPP Server listening on port ${LISTEN_PORT}`);
  log(`Max clients: ${MAX_CLIENTS}, Idle timeout: ${IDLE_TIMEOUT_MS / 1000}s`);
  writeStatus();
  setInterval(() => {
    enforceAssignedIps().catch((e) => log(`Assigned-IP sweep error: ${e}`));
  }, ASSIGNED_IP_CHECK_INTERVAL_MS);
});

server.on("error", (err: Error) => {
  log(`Server error: ${err.message}`);
  process.exit(1);
});
