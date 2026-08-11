/**
 * SMPP v3.4 Protocol - Raw PDU Implementation
 * High-performance: zero dependencies, pure TypeScript
 * Used by smpp-server.ts to act as an SMSC for inbound customer binds
 * (parses bind/submit_sm requests, builds their responses).
 */

// ─── SMPP Command IDs ─────────────────────────────────────
export const CMD = {
  GENERIC_NACK: 0x80000000,
  BIND_RECEIVER: 0x00000001,
  BIND_RECEIVER_RESP: 0x80000001,
  BIND_TRANSMITTER: 0x00000002,
  BIND_TRANSMITTER_RESP: 0x80000002,
  SUBMIT_SM: 0x00000004,
  SUBMIT_SM_RESP: 0x80000004,
  DELIVER_SM: 0x00000005,
  DELIVER_SM_RESP: 0x80000005,
  UNBIND: 0x00000006,
  UNBIND_RESP: 0x80000006,
  BIND_TRANSCEIVER: 0x00000009,
  BIND_TRANSCEIVER_RESP: 0x80000009,
  ENQUIRE_LINK: 0x00000015,
  ENQUIRE_LINK_RESP: 0x80000015,
} as const;

// ─── SMPP Status Codes ────────────────────────────────────
export const STATUS = {
  ESME_ROK: 0x00000000,
  ESME_RINVMSGLEN: 0x00000001,
  ESME_RINVCMDLEN: 0x00000002,
  ESME_RINVCMDID: 0x00000003,
  ESME_RINVBNDSTS: 0x00000004,
  ESME_RSYSERR: 0x00000008,
  ESME_RINVSRCADR: 0x0000000a,
  ESME_RINVDSTADR: 0x0000000b,
  ESME_RINVSYSID: 0x0000000d,
  ESME_RINVPASWD: 0x0000000e,
  ESME_RTHROTTLED: 0x00000058,
} as const;

// ─── Data Coding ──────────────────────────────────────────
export const DATA_CODING = {
  DEFAULT: 0x00, // GSM-7
  IA5: 0x01,
  LATIN1: 0x03,
  UCS2: 0x08,
} as const;

// ─── PDU Header ───────────────────────────────────────────
export interface PduHeader {
  commandLength: number;
  commandId: number;
  commandStatus: number;
  sequenceNumber: number;
}

export interface Pdu {
  header: PduHeader;
  body: Buffer;
}

let sequenceCounter = 0;
export function nextSequence(): number {
  sequenceCounter = (sequenceCounter + 1) & 0x7fffffff;
  return sequenceCounter;
}

// ─── PDU Builder ──────────────────────────────────────────

export function buildPdu(
  commandId: number,
  commandStatus: number,
  sequenceNumber: number,
  body: Buffer
): Buffer {
  const header = Buffer.alloc(16);
  const totalLen = 16 + body.length;
  header.writeUInt32BE(totalLen, 0);
  header.writeUInt32BE(commandId, 4);
  header.writeUInt32BE(commandStatus, 8);
  header.writeUInt32BE(sequenceNumber, 12);
  return Buffer.concat([header, body]);
}

export function buildEnquireLink(): Buffer {
  return buildPdu(CMD.ENQUIRE_LINK, STATUS.ESME_ROK, nextSequence(), Buffer.alloc(0));
}

export function buildEnquireLinkResp(sequenceNumber: number): Buffer {
  return buildPdu(CMD.ENQUIRE_LINK_RESP, STATUS.ESME_ROK, sequenceNumber, Buffer.alloc(0));
}

export function buildUnbindResp(sequenceNumber: number): Buffer {
  return buildPdu(CMD.UNBIND_RESP, STATUS.ESME_ROK, sequenceNumber, Buffer.alloc(0));
}

export function buildBindTransceiverResp(
  sequenceNumber: number,
  status: number,
  systemId: string = ""
): Buffer {
  const body = Buffer.from(systemId + "\0", "ascii");
  return buildPdu(CMD.BIND_TRANSCEIVER_RESP, status, sequenceNumber, body);
}

export function buildSubmitSmResp(
  sequenceNumber: number,
  status: number,
  messageId: string = ""
): Buffer {
  const body = Buffer.from(messageId + "\0", "ascii");
  return buildPdu(CMD.SUBMIT_SM_RESP, status, sequenceNumber, body);
}

// ─── PDU Parser ───────────────────────────────────────────

export function parseHeader(buf: Buffer): PduHeader | null {
  if (buf.length < 16) return null;
  return {
    commandLength: buf.readUInt32BE(0),
    commandId: buf.readUInt32BE(4),
    commandStatus: buf.readUInt32BE(8),
    sequenceNumber: buf.readUInt32BE(12),
  };
}

export function parsePdu(buf: Buffer): Pdu | null {
  const header = parseHeader(buf);
  if (!header) return null;
  if (buf.length < header.commandLength) return null;
  return {
    header,
    body: buf.subarray(16, header.commandLength),
  };
}

// Read a null-terminated string from buffer at offset
function readCString(buf: Buffer, offset: number): { value: string; nextOffset: number } {
  let end = offset;
  while (end < buf.length && buf[end] !== 0) end++;
  return {
    value: buf.subarray(offset, end).toString("ascii"),
    nextOffset: end + 1,
  };
}

export interface SubmitSmFields {
  serviceType: string;
  sourceTon: number;
  sourceNpi: number;
  sourceAddr: string;
  destTon: number;
  destNpi: number;
  destAddr: string;
  esmClass: number;
  protocolId: number;
  priorityFlag: number;
  registeredDelivery: number;
  dataCoding: number;
  smLength: number;
  shortMessage: string;
}

export function parseSubmitSm(body: Buffer): SubmitSmFields {
  let offset = 0;

  const serviceType = readCString(body, offset);
  offset = serviceType.nextOffset;

  const sourceTon = body[offset++];
  const sourceNpi = body[offset++];
  const sourceAddr = readCString(body, offset);
  offset = sourceAddr.nextOffset;

  const destTon = body[offset++];
  const destNpi = body[offset++];
  const destAddr = readCString(body, offset);
  offset = destAddr.nextOffset;

  const esmClass = body[offset++];
  const protocolId = body[offset++];
  const priorityFlag = body[offset++];

  // schedule_delivery_time
  const schedule = readCString(body, offset);
  offset = schedule.nextOffset;

  // validity_period
  const validity = readCString(body, offset);
  offset = validity.nextOffset;

  const registeredDelivery = body[offset++];
  offset++; // replace_if_present_flag -- not used by this app, but the byte must still be consumed
  const dataCoding = body[offset++];
  offset++; // sm_default_msg_id -- not used by this app, but the byte must still be consumed
  const smLength = body[offset++];

  let shortMessage: string;
  const msgBuf = body.subarray(offset, offset + smLength);
  if (dataCoding === DATA_CODING.UCS2) {
    // UCS-2BE -> UTF-16BE -> string
    const swapped = Buffer.alloc(msgBuf.length);
    for (let i = 0; i < msgBuf.length; i += 2) {
      swapped[i] = msgBuf[i + 1] || 0;
      swapped[i + 1] = msgBuf[i];
    }
    shortMessage = swapped.toString("utf16le");
  } else {
    shortMessage = msgBuf.toString("ascii");
  }

  return {
    serviceType: serviceType.value,
    sourceTon,
    sourceNpi,
    sourceAddr: sourceAddr.value,
    destTon,
    destNpi,
    destAddr: destAddr.value,
    esmClass,
    protocolId,
    priorityFlag,
    registeredDelivery,
    dataCoding,
    smLength,
    shortMessage,
  };
}

// Parse bind_transceiver PDU body
export interface BindFields {
  systemId: string;
  password: string;
  systemType: string;
  interfaceVersion: number;
}

export function parseBind(body: Buffer): BindFields {
  let offset = 0;
  const systemId = readCString(body, offset);
  offset = systemId.nextOffset;
  const password = readCString(body, offset);
  offset = password.nextOffset;
  const systemType = readCString(body, offset);
  offset = systemType.nextOffset;
  const interfaceVersion = body[offset] || 0x34;

  return {
    systemId: systemId.value,
    password: password.value,
    systemType: systemType.value,
    interfaceVersion,
  };
}

// ─── Stream Buffer for handling TCP fragmentation ──────────
export class SmppStreamBuffer {
  private buffer: Buffer = Buffer.alloc(0);

  append(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);
  }

  extractPdu(): Pdu | null {
    if (this.buffer.length < 16) return null;
    const cmdLen = this.buffer.readUInt32BE(0);
    if (cmdLen < 16 || cmdLen > 65536) {
      // Invalid PDU, skip 4 bytes
      this.buffer = this.buffer.subarray(4);
      return null;
    }
    if (this.buffer.length < cmdLen) return null;

    const pduBuf = this.buffer.subarray(0, cmdLen);
    this.buffer = this.buffer.subarray(cmdLen);
    return parsePdu(pduBuf);
  }
}

// ─── Command name lookup for logging ──────────────────────
export function commandName(id: number): string {
  const names: Record<number, string> = {
    [CMD.BIND_TRANSCEIVER]: "BIND_TRX",
    [CMD.BIND_TRANSCEIVER_RESP]: "BIND_TRX_RESP",
    [CMD.BIND_RECEIVER]: "BIND_RX",
    [CMD.BIND_RECEIVER_RESP]: "BIND_RX_RESP",
    [CMD.BIND_TRANSMITTER]: "BIND_TX",
    [CMD.BIND_TRANSMITTER_RESP]: "BIND_TX_RESP",
    [CMD.SUBMIT_SM]: "SUBMIT_SM",
    [CMD.SUBMIT_SM_RESP]: "SUBMIT_SM_RESP",
    [CMD.DELIVER_SM]: "DELIVER_SM",
    [CMD.DELIVER_SM_RESP]: "DELIVER_SM_RESP",
    [CMD.ENQUIRE_LINK]: "ENQUIRE_LINK",
    [CMD.ENQUIRE_LINK_RESP]: "ENQUIRE_LINK_RESP",
    [CMD.UNBIND]: "UNBIND",
    [CMD.UNBIND_RESP]: "UNBIND_RESP",
    [CMD.GENERIC_NACK]: "GENERIC_NACK",
  };
  return names[id] || `0x${id.toString(16).padStart(8, "0")}`;
}
