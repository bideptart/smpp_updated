"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Send,
  AlertCircle,
  Loader2,
  Users,
  List as ListIcon,
  Search,
  X as XIcon,
  Settings,
  FileText,
  Braces,
  Paperclip,
  Eye,
  Calendar as CalendarIcon,
  CalendarCheck,
  CheckCircle,
  Shield,
  Upload,
} from "lucide-react";
import SchedulePanel, { type ScheduleSettings } from "@/components/schedule/SchedulePanel";
import PreviewMessageDialog, { type PreviewRecipient } from "@/components/schedule/PreviewMessageDialog";
import CalendarPreviewDialog from "@/components/schedule/CalendarPreviewDialog";
import TemplatePickerDialog from "@/components/templates/TemplatePickerDialog";
import AttachFileDialog, { type AttachedFile } from "@/components/send-sms/AttachFileDialog";
import SendProgressDialog from "@/components/send-sms/SendProgressDialog";
import * as XLSX from "xlsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { validatePhoneNumber } from "@/lib/sms-engine";
import { countries } from "@/lib/countries";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatPhoneDisplay(normalized: string): string {
  const match = countries
    .map((c) => c.dialCode.replace("+", ""))
    .filter((dial) => normalized.startsWith(dial))
    .sort((a, b) => b.length - a.length)[0];
  if (!match) return `+${normalized}`;
  const country = countries.find((c) => c.dialCode.replace("+", "") === match);
  return `${country?.flag || ""} +${match} ${normalized.slice(match.length)}`.trim();
}

function detectEncoding(text: string) {
  const totalChars = text.length;
  const isUCS2 = [...text].some((ch) => ch.charCodeAt(0) > 127);
  if (isUCS2) {
    const parts = totalChars <= 70 ? 1 : Math.ceil(totalChars / 67);
    return { encoding: "UCS-2", parts, charsPerPart: totalChars <= 70 ? 70 : 67, totalChars, maxChars: 70 };
  }
  const parts = totalChars <= 160 ? 1 : Math.ceil(totalChars / 153);
  return { encoding: "GSM-7", parts, charsPerPart: totalChars <= 160 ? 160 : 153, totalChars, maxChars: 160 };
}

interface SendResult {
  destination: string;
  messageId?: string;
  status: string;
  error?: string;
}

interface Contact {
  id: number;
  phoneNumber: string;
  firstName: string | null;
  lastName: string | null;
  email?: string | null;
}

interface ContactList {
  id: number;
  name: string;
  contactCount: number;
}

export default function SendSmsPageWrapper() {
  return (
    <Suspense fallback={<div className="page-content"><div>Loading…</div></div>}>
      <SendSmsPage />
    </Suspense>
  );
}

function SendSmsPage() {
  const [companyId, setCompanyId] = useState("");
  const [senderId, setSenderId] = useState("SMSLCL");
  const [routeId, setRouteId] = useState("");
  const [phones, setPhones] = useState("");
  const [uploadedNumbers, setUploadedNumbers] = useState<string[]>([]);
  const [uploadName, setUploadName] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressCampaignId, setProgressCampaignId] = useState<number | null>(null);
  const [progressMessageId, setProgressMessageId] = useState<string | null>(null);
  const [progressTotal, setProgressTotal] = useState(0);

  // Recipient picker state
  const [toMode, setToMode] = useState<"manual" | "contacts" | "lists">("manual");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());
  const [selectedListIds, setSelectedListIds] = useState<Set<number>>(new Set());
  const [contactSearch, setContactSearch] = useState("");

  // Schedule state
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 1);
  const defaultDateStr = defaultDate.toISOString().slice(0, 10);

  const searchParams = useSearchParams();
  const [scheduleMode, setScheduleMode] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleSettings>({
    date: defaultDateStr,
    hour: "12",
    minute: "00",
    timezone: "Asia/Kolkata",
    repeat: "none",
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const editScheduleId = searchParams.get("editScheduleId");
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);

  // Template picker + dynamic field popover
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [dynFieldOpen, setDynFieldOpen] = useState(false);

  // Attachments
  const [attachFileOpen, setAttachFileOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  // Send mode: DLT (full-featured) vs Quick (just numbers + message)
  const [sendMode, setSendMode] = useState<"dlt" | "quick">("dlt");
  const [quickNumbers, setQuickNumbers] = useState<string[]>([]);
  const [quickDraft, setQuickDraft] = useState("");
  const [quickError, setQuickError] = useState("");
  const [lastConfirmed, setLastConfirmed] = useState<string | null>(null);

  function commitQuickNumber(raw?: string) {
    const value = (raw ?? quickDraft).trim();
    if (!value) return;
    const v = validatePhoneNumber(value);
    if (!v.valid) {
      setQuickError(v.error || "Invalid number");
      return;
    }
    if (quickNumbers.includes(v.normalized)) {
      setQuickError("Number already added");
      return;
    }
    setQuickNumbers((prev) => [...prev, v.normalized]);
    setLastConfirmed(v.normalized);
    setQuickDraft("");
    setQuickError("");
  }

  // Auto-enable schedule mode from URL param ?schedule=true
  useEffect(() => {
    if (searchParams.get("schedule") === "true") {
      setScheduleMode(true);
    }
  }, [searchParams]);

  // Prefill message from template when templateId is in URL
  const templateId = searchParams.get("templateId");
  useEffect(() => {
    if (!templateId) return;
    (async () => {
      try {
        const res = await fetch(`/api/templates/${templateId}`);
        const json = await res.json();
        if (json.success && json.data) {
          setMessage(json.data.content);
          toast.success(`Template "${json.data.name}" loaded`);
        }
      } catch {}
    })();
  }, [templateId]);

  // Prefill from existing schedule when editScheduleId is in URL
  useEffect(() => {
    if (!editScheduleId) return;
    const id = parseInt(editScheduleId);
    if (!id) return;
    setEditingScheduleId(id);
    setScheduleMode(true);
    (async () => {
      try {
        const res = await fetch(`/api/schedule/${id}`);
        const json = await res.json();
        if (!json.success || !json.data) {
          toast.error("Failed to load schedule");
          return;
        }
        const c = json.data;
        setCompanyId(String(c.customerId));
        setSenderId(c.senderId || "SMSLCL");
        if (c.routeId) setRouteId(String(c.routeId));
        setMessage(c.messageText || "");

        // Recipients from recipientsJson
        const recips = Array.isArray(c.recipientsJson) ? c.recipientsJson : [];
        if (recips.length > 0) {
          const phones = recips.map((r: { phone?: string }) => r.phone).filter(Boolean).join("\n");
          setPhones(phones);
          setToMode("manual");
        }

        // Populate schedule fields
        const d = new Date(c.scheduledAt);
        setSchedule({
          date: d.toISOString().slice(0, 10),
          hour: String(d.getHours()).padStart(2, "0"),
          minute: String(d.getMinutes()).padStart(2, "0"),
          timezone: c.timezone || "Asia/Kolkata",
          repeat: c.repeatFreq || "none",
        });
      } catch {
        toast.error("Failed to load schedule");
      }
    })();
  }, [editScheduleId]);

  const { data: companiesData } = useSWR("/api/companies?type=customer", fetcher);
  const { data: routesData } = useSWR(
    companyId ? `/api/routes?customerId=${companyId}` : null,
    fetcher,
    { refreshInterval: 15000 }
  );
  const firstDest =
    sendMode === "quick"
      ? quickNumbers[0] || ""
      : phones.split(/[,\n\r]+/).map((n) => n.trim()).filter(Boolean)[0] || "";
  const { data: previewData } = useSWR(
    companyId && !routeId ? `/api/routes/preview?customerId=${companyId}&destination=${encodeURIComponent(firstDest)}` : null,
    fetcher,
    { refreshInterval: 15000 }
  );
  const { data: recentData, mutate: mutateRecent } = useSWR(
    "/api/messages/recent",
    fetcher,
    { refreshInterval: 10000 }
  );

  // Contacts and Lists for picker (fetch only when active)
  const { data: contactsData } = useSWR(
    companyId && toMode === "contacts"
      ? `/api/contacts?customerId=${companyId}&search=${encodeURIComponent(contactSearch)}&limit=200`
      : null,
    fetcher
  );
  const { data: listsData } = useSWR(
    companyId && toMode === "lists" ? `/api/contact-lists?customerId=${companyId}` : null,
    fetcher
  );
  const contactsList: Contact[] = contactsData?.data || [];
  const listsList: ContactList[] = listsData?.data || [];

  const companies = (companiesData?.data || []).filter(
    (c: { type: string }) => c.type === "customer"
  );
  const routes = routesData?.data || [];
  void recentData; // recent messages panel removed; kept hook for mutateRecent after send
  const enc = detectEncoding(message);

  // Compute recipient count based on mode
  const manualCount = phones.split(/[,\n\r]+/).filter((n) => n.trim()).length + uploadedNumbers.length;
  const selectedContactsCount = selectedContactIds.size;
  const selectedListsContactCount = Array.from(selectedListIds).reduce((sum, lid) => {
    const list = listsList.find((l) => l.id === lid);
    return sum + (list?.contactCount || 0);
  }, 0);
  const recipientCount =
    sendMode === "quick"
      ? quickNumbers.length
      : toMode === "manual"
      ? manualCount
      : toMode === "contacts"
      ? selectedContactsCount
      : selectedListsContactCount;

  async function handleNumbersFile(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const found = new Set<string>();
      for (const name of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, blankrows: false });
        for (const row of rows) {
          for (const cell of row as unknown[]) {
            if (cell === null || cell === undefined) continue;
            const digits = String(cell).replace(/[^0-9]/g, "");
            if (digits.length >= 8 && digits.length <= 15) found.add(digits);
          }
        }
      }
      let arr = Array.from(found);
      if (arr.length > 100000) { arr = arr.slice(0, 100000); toast.error("Capped at 100,000 numbers"); }
      setUploadedNumbers(arr);
      setUploadName(file.name);
      toast.success(`${arr.length.toLocaleString()} numbers loaded from ${file.name}`);
    } catch {
      toast.error("Could not read file. Use .xlsx, .xls or .csv");
    }
  }

  const handleSend = useCallback(async () => {
    if (!companyId || !message) {
      toast.error("Select a customer and enter a message");
      return;
    }

    // Build recipients with contact data (for dynamic field replacement)
    interface SendRecipient { phone: string; firstName?: string | null; lastName?: string | null; email?: string | null; company?: string | null }
    let recipientsData: SendRecipient[] = [];
    if (sendMode === "quick") {
      recipientsData = quickNumbers.map((p) => ({ phone: p }));
    } else if (toMode === "manual") {
      recipientsData = [
        ...phones.split(/[,\n\r]+/).map((n) => n.trim()).filter(Boolean),
        ...uploadedNumbers,
      ].map((p) => ({ phone: p }));
    } else if (toMode === "contacts") {
      recipientsData = contactsList
        .filter((c) => selectedContactIds.has(c.id))
        .map((c) => ({
          phone: c.phoneNumber,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
        }));
    } else if (toMode === "lists") {
      const fetched: SendRecipient[] = [];
      for (const lid of selectedListIds) {
        try {
          const res = await fetch(`/api/contact-lists/${lid}/contacts?limit=5000`);
          const json = await res.json();
          if (json.success) {
            for (const c of json.data) fetched.push({
              phone: c.phoneNumber,
              firstName: c.firstName,
              lastName: c.lastName,
              email: c.email,
              company: c.company,
            });
          }
        } catch {}
      }
      // Dedupe by phone
      const seen = new Set<string>();
      recipientsData = fetched.filter((r) => {
        if (seen.has(r.phone)) return false;
        seen.add(r.phone);
        return true;
      });
    }

    // Replace dynamic fields per-recipient helper
    function personalizeMessage(template: string, r: SendRecipient): string {
      return template
        .replace(/\{firstName\}/g, r.firstName || "")
        .replace(/\{lastName\}/g, r.lastName || "")
        .replace(/\{email\}/g, r.email || "")
        .replace(/\{company\}/g, r.company || "")
        .replace(/\{phoneNumber\}/g, r.phone || "");
    }

    // Append attachment URLs to the message (each file on its own line)
    const attachmentSuffix = attachedFiles.length
      ? "\n\n" + attachedFiles.map((f) => f.url).join("\n")
      : "";
    const withAttachments = (text: string) => text + attachmentSuffix;

    const numbers = recipientsData.map((r) => r.phone);

    if (numbers.length === 0) {
      toast.error("Select at least one recipient");
      return;
    }
    setSending(true);
    try {
      // Detect dynamic fields (placeholders like {firstName})
      const hasDynamicFields = /\{(firstName|lastName|email|company|phoneNumber)\}/.test(message);

      if (hasDynamicFields && recipientsData.length > 1) {
        // Personalized per-recipient sends via single-send API
        const sendResults: SendResult[] = [];
        for (const r of recipientsData) {
          const personalized = withAttachments(personalizeMessage(message, r));
          try {
            const res = await fetch("/api/sms/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                companyId: parseInt(companyId, 10),
                senderId,
                destination: r.phone,
                message: personalized,
                routeId: routeId || undefined,
              }),
            });
            const rj = await res.json();
            sendResults.push(
              rj.success
                ? { destination: rj.destination, messageId: rj.messageId, status: "queued" }
                : { destination: r.phone, status: "failed", error: rj.error }
            );
          } catch {
            sendResults.push({ destination: r.phone, status: "failed", error: "Network error" });
          }
        }
        const queued = sendResults.filter((r) => r.status === "queued").length;
        const failed = sendResults.length - queued;
        toast.success(`Personalized send: ${queued} queued, ${failed} failed`);
        setPhones("");
        setMessage("");
        setSelectedContactIds(new Set());
        setSelectedListIds(new Set());
        setAttachedFiles([]);
        setQuickNumbers([]);
        setQuickDraft("");
        setQuickError("");
        setLastConfirmed(null);
      } else if (numbers.length === 1) {
        const personalized = withAttachments(
          hasDynamicFields
            ? personalizeMessage(message, recipientsData[0])
            : message
        );
        const res = await fetch("/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: parseInt(companyId, 10),
            senderId,
            destination: numbers[0],
            message: personalized,
            routeId: routeId || undefined,
          }),
        });
        const result = await res.json();
        if (result.success) {
          toast.success("SMS queued successfully");
          setProgressCampaignId(null);
          setProgressMessageId(result.messageId);
          setProgressTotal(1);
          setProgressOpen(true);
          setPhones("");
          setMessage("");
          setSelectedContactIds(new Set());
          setSelectedListIds(new Set());
          setAttachedFiles([]);
        } else {
          toast.error(result.error || "Failed to send");
        }
      } else {
        const res = await fetch("/api/sms/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: parseInt(companyId, 10),
            senderId,
            destinations: numbers,
            message: withAttachments(message),
            routeId: routeId || undefined,
          }),
        });
        const result = await res.json();
        if (result.success) {
          toast.success(`Bulk send: ${result.queued} queued, ${result.failed} failed`);
          setProgressMessageId(null);
          setProgressCampaignId(result.campaignId);
          setProgressTotal(result.total ?? result.queued);
          setProgressOpen(true);
          setUploadedNumbers([]);
          setUploadName("");
          setPhones("");
          setMessage("");
          setSelectedContactIds(new Set());
          setSelectedListIds(new Set());
          setAttachedFiles([]);
        } else {
          toast.error(result.error || "Bulk send failed");
        }
      }
      mutateRecent();
    } catch {
      toast.error("An error occurred");
    } finally {
      setSending(false);
    }
  }, [companyId, senderId, routeId, phones, uploadedNumbers, message, mutateRecent, toMode, contactsList, selectedContactIds, selectedListIds, attachedFiles, sendMode, quickNumbers]);

  const estimatedCost = (() => {
    if (!routeId && routes.length === 0) return 0;
    const rate = routeId
      ? routes.find((r: { id: number }) => String(r.id) === routeId)?.sellingRate || 0
      : routes[0]?.sellingRate || 0;
    return (recipientCount || 0) * enc.parts * rate;
  })();

  // Build recipients list (for preview & schedule)
  const buildRecipients = useCallback(async (): Promise<PreviewRecipient[]> => {
    if (sendMode === "quick") {
      return quickNumbers.map((p) => ({ phone: p }));
    }
    if (toMode === "manual") {
      return [
        ...phones.split(/[,\n\r]+/).map((n) => n.trim()).filter(Boolean),
        ...uploadedNumbers,
      ].map((p) => ({ phone: p.replace(/^\+/, "") }));
    }
    if (toMode === "contacts") {
      return contactsList
        .filter((c) => selectedContactIds.has(c.id))
        .map((c) => ({ phone: c.phoneNumber, firstName: c.firstName, lastName: c.lastName }));
    }
    // lists — fetch contacts
    const fetched: PreviewRecipient[] = [];
    for (const lid of selectedListIds) {
      try {
        const res = await fetch(`/api/contact-lists/${lid}/contacts?limit=5000`);
        const json = await res.json();
        if (json.success) {
          for (const c of json.data) {
            fetched.push({
              phone: c.phoneNumber,
              firstName: c.firstName,
              lastName: c.lastName,
            });
          }
        }
      } catch {}
    }
    // Dedupe by phone
    const seen = new Set<string>();
    return fetched.filter((r) => {
      if (seen.has(r.phone)) return false;
      seen.add(r.phone);
      return true;
    });
  }, [toMode, phones, uploadedNumbers, contactsList, selectedContactIds, selectedListIds, sendMode, quickNumbers]);

  const [previewRecipients, setPreviewRecipients] = useState<PreviewRecipient[]>([]);

  async function openPreview() {
    const list = await buildRecipients();
    setPreviewRecipients(list);
    setPreviewOpen(true);
  }

  async function openCalendar() {
    const list = await buildRecipients();
    setPreviewRecipients(list);
    setCalendarOpen(true);
  }

  // Compute the scheduled Date from the schedule settings
  function scheduledDate(): Date | null {
    const { date, hour, minute } = schedule;
    if (!date) return null;
    const [y, m, d] = date.split("-").map(Number);
    const h = parseInt(hour || "0");
    const mi = parseInt(minute || "0");
    if ([y, m, d, h, mi].some(Number.isNaN)) return null;
    // Construct in local time; server stores as timestamptz
    return new Date(y, (m || 1) - 1, d || 1, h, mi, 0);
  }

  async function handleSchedule() {
    if (!companyId || !message) {
      toast.error("Select a customer and enter a message");
      return;
    }
    const recipients = await buildRecipients();
    if (recipients.length === 0) {
      toast.error("Select at least one recipient");
      return;
    }
    const sd = scheduledDate();
    if (!sd) {
      toast.error("Invalid schedule date/time");
      return;
    }
    if (sd.getTime() < Date.now()) {
      toast.error("Scheduled time must be in the future");
      return;
    }

    setScheduling(true);
    try {
      const isEditing = !!editingScheduleId;
      const url = isEditing ? `/api/schedule/${editingScheduleId}` : "/api/schedule";
      const method = isEditing ? "PUT" : "POST";
      const body = isEditing
        ? {
            messageText: message,
            scheduledAt: sd.toISOString(),
            timezone: schedule.timezone,
            repeatFreq: schedule.repeat,
            senderId,
          }
        : {
            customerId: parseInt(companyId, 10),
            senderId,
            routeId: routeId || null,
            messageText: message,
            encoding: enc.encoding === "UCS-2" ? "UCS2" : "GSM7",
            recipients,
            scheduledAt: sd.toISOString(),
            timezone: schedule.timezone,
            repeatFreq: schedule.repeat,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Schedule failed");
        return;
      }
      toast.success(
        isEditing
          ? `Schedule updated`
          : `Scheduled ${recipients.length} SMS for ${sd.toLocaleString()}`
      );
      setScheduleMode(false);
      setEditingScheduleId(null);
      // Reset form
      setPhones("");
      setMessage("");
      setSelectedContactIds(new Set());
      setSelectedListIds(new Set());
      setQuickNumbers([]);
      setQuickDraft("");
      setQuickError("");
      setLastConfirmed(null);
    } catch {
      toast.error("Network error");
    } finally {
      setScheduling(false);
    }
  }

  return (
    <>
      <TopBar title="Send SMS" />
      <div className="page-content">
        <div className="compose-layout">
          {/* Main Compose Card — unified single container */}
          {/* Send Mode Toggle: DLT vs Quick — compact segmented control */}
          <div className="send-mode-toggle" role="tablist" aria-label="Send mode">
            <button
              type="button"
              role="tab"
              aria-selected={sendMode === "dlt"}
              className={`send-mode-option ${sendMode === "dlt" ? "send-mode-option--active" : ""}`}
              onClick={() => setSendMode("dlt")}
            >
              DLT SMS
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sendMode === "quick"}
              className={`send-mode-option ${sendMode === "quick" ? "send-mode-option--active" : ""}`}
              onClick={() => setSendMode("quick")}
            >
              Quick SMS
            </button>
          </div>

          {/* DLT registration reminder */}
          {sendMode === "dlt" && (
            <div className="dlt-banner">
              <div className="dlt-banner-left">
                <div className="dlt-banner-icon">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <p className="dlt-banner-title">Required: verify your DLT registration</p>
                  <p className="dlt-banner-sub">
                    DLT entity, Sender ID and an approved template are required before sending DLT SMS in India.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                className="dlt-banner-btn"
                onClick={() => toast("DLT registration verification is coming soon")}
              >
                <Shield className="mr-2 h-3.5 w-3.5" />
                Verify DLT registration
              </Button>
            </div>
          )}

          <div className="compose-card compose-card--unified">
            <div className="compose-body">
              {/* Quick mode: chip-style number input */}
              {sendMode === "quick" && (
                <>
                  <div className="compose-section">
                    <label className="compose-label">Numbers</label>
                    <div className="compose-field">
                      <div
                        className={`quick-chip-input ${quickError ? "quick-chip-input--error" : ""}`}
                        onClick={(e) => {
                          const inp = (e.currentTarget.querySelector("input") as HTMLInputElement | null);
                          inp?.focus();
                        }}
                      >
                        {quickNumbers.map((n) => (
                          <span
                            key={n}
                            className={`quick-chip ${lastConfirmed === n ? "quick-chip--just-added" : ""}`}
                          >
                            <CheckCircle className="quick-chip-icon" />
                            <span className="quick-chip-text">{formatPhoneDisplay(n)}</span>
                            <button
                              type="button"
                              className="quick-chip-remove"
                              aria-label={`Remove ${n}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuickNumbers((prev) => prev.filter((p) => p !== n));
                                if (lastConfirmed === n) setLastConfirmed(null);
                              }}
                            >
                              <XIcon className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        <input
                          type="tel"
                          inputMode="tel"
                          autoComplete="off"
                          pattern="[0-9+()\-\s]*"
                          className="quick-chip-field"
                          placeholder={quickNumbers.length === 0 ? "e.g. 9876543210 (India) or +14155552671 (int'l)" : "Add another number…"}
                          value={quickDraft}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuickError("");
                            if (val.includes(",") || val.includes(" ")) {
                              const parts = val.split(/[,\s]+/).filter(Boolean);
                              parts.forEach((p) => commitQuickNumber(p));
                              return;
                            }
                            setQuickDraft(val);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "Tab") {
                              if (quickDraft.trim()) {
                                e.preventDefault();
                                commitQuickNumber();
                              }
                            } else if (e.key === "Backspace" && !quickDraft && quickNumbers.length) {
                              setQuickNumbers((prev) => prev.slice(0, -1));
                            }
                          }}
                          onBlur={() => {
                            if (quickDraft.trim()) commitQuickNumber();
                          }}
                          onPaste={(e) => {
                            const text = e.clipboardData.getData("text");
                            if (/[,\s\n]/.test(text)) {
                              e.preventDefault();
                              const parts = text.split(/[,\s\n]+/).filter(Boolean);
                              parts.forEach((p) => commitQuickNumber(p));
                            }
                          }}
                        />
                      </div>
                      <div className="compose-field-meta quick-meta">
                        <span>
                          {quickNumbers.length} number{quickNumbers.length === 1 ? "" : "s"} added
                          {quickError ? <span className="quick-meta-error"> — {quickError}</span> : null}
                        </span>
                        {quickNumbers.length > 0 && (
                          <button
                            type="button"
                            className="quick-clear-btn"
                            onClick={() => {
                              setQuickNumbers([]);
                              setQuickDraft("");
                              setQuickError("");
                              setLastConfirmed(null);
                            }}
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="compose-divider" />
                </>
              )}

              {/* DLT mode: existing recipient picker */}
              {sendMode === "dlt" && (
              <div className="compose-section compose-section--stacked">
                <div className="compose-field-header">
                  <label className="compose-label">To</label>
                  <div className="section-actions">
                    <button type="button" className="section-action" onClick={() => setToMode("contacts")}>
                      <Users className="section-action-icon" />
                      <span>Contacts</span>
                    </button>
                    <button type="button" className="section-action" onClick={() => setToMode("lists")}>
                      <ListIcon className="section-action-icon" />
                      <span>Lists</span>
                    </button>
                  </div>
                </div>
                <div className="compose-field">
                  {/* Panel content based on mode (switched via header actions) */}
                  {toMode === "manual" && (
                    <>
                      <Textarea
                        value={phones}
                        onChange={(e) => setPhones(e.target.value)}
                        placeholder="Enter phone numbers separated by commas or new lines&#10;e.g. 919876543210 (India) or 14155552671 (int'l, with country code)"
                        rows={3}
                        className="compose-input"
                      />
                      <div className="compose-field-meta" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <span>Recipients: {recipientCount.toLocaleString()}</span>
                        <label className="upload-link">
                          <input type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleNumbersFile(f); e.currentTarget.value = ""; }} />
                          <Upload className="h-3.5 w-3.5" />
                          Upload Excel / CSV
                        </label>
                        {uploadedNumbers.length > 0 && (
                          <span className="upload-chip">
                            {uploadedNumbers.length.toLocaleString()} from {uploadName}
                            <button type="button" onClick={() => { setUploadedNumbers([]); setUploadName(""); }} className="upload-chip-remove">
                              <XIcon className="h-3 w-3" />
                            </button>
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  {toMode === "contacts" && (
                    <div className="to-picker">
                      {!companyId && (
                        <div className="to-picker-hint">Select a customer first to see contacts</div>
                      )}
                      {companyId && (
                        <>
                          <div className="to-picker-search">
                            <Search className="to-picker-search-icon" />
                            <Input
                              value={contactSearch}
                              onChange={(e) => setContactSearch(e.target.value)}
                              placeholder="Search contacts..."
                              className="to-picker-input"
                            />
                          </div>
                          {selectedContactIds.size > 0 && (
                            <div className="to-picker-chips">
                              {contactsList
                                .filter((c) => selectedContactIds.has(c.id))
                                .map((c) => (
                                  <span key={c.id} className="to-picker-chip">
                                    {c.firstName || c.phoneNumber}
                                    <button
                                      onClick={() => {
                                        const next = new Set(selectedContactIds);
                                        next.delete(c.id);
                                        setSelectedContactIds(next);
                                      }}
                                      className="to-picker-chip-remove"
                                    >
                                      <XIcon className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                            </div>
                          )}
                          <div className="to-picker-list">
                            {contactsList.length === 0 && (
                              <div className="to-picker-empty">No contacts. Add contacts in the Contacts page first.</div>
                            )}
                            {contactsList.map((c) => {
                              const fullName = [c.firstName, c.lastName].filter(Boolean).join(" ") || "—";
                              const isSelected = selectedContactIds.has(c.id);
                              return (
                                <label key={c.id} className={`to-picker-item ${isSelected ? "to-picker-item--selected" : ""}`}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      const next = new Set(selectedContactIds);
                                      if (isSelected) next.delete(c.id);
                                      else next.add(c.id);
                                      setSelectedContactIds(next);
                                    }}
                                  />
                                  <div className="to-picker-item-info">
                                    <span className="to-picker-item-name">{fullName}</span>
                                    <span className="to-picker-item-phone">+{c.phoneNumber}</span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                          <div className="compose-field-meta">
                            <span>Selected: {selectedContactIds.size} contacts</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {toMode === "lists" && (
                    <div className="to-picker">
                      {!companyId && (
                        <div className="to-picker-hint">Select a customer first to see lists</div>
                      )}
                      {companyId && (
                        <>
                          <div className="to-picker-list">
                            {listsList.length === 0 && (
                              <div className="to-picker-empty">No lists. Create a list in Contacts → Lists.</div>
                            )}
                            {listsList.map((l) => {
                              const isSelected = selectedListIds.has(l.id);
                              return (
                                <label key={l.id} className={`to-picker-item ${isSelected ? "to-picker-item--selected" : ""}`}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      const next = new Set(selectedListIds);
                                      if (isSelected) next.delete(l.id);
                                      else next.add(l.id);
                                      setSelectedListIds(next);
                                    }}
                                  />
                                  <div className="to-picker-item-info">
                                    <span className="to-picker-item-name">{l.name}</span>
                                    <span className="to-picker-item-phone">{l.contactCount} contacts</span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                          <div className="compose-field-meta">
                            <span>Total recipients: {selectedListsContactCount}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              )}

              <div className="compose-divider" />

              {/* From Section */}
              <div className="compose-section compose-section--stacked">
                <div className="compose-field-header">
                  <label className="compose-label">From</label>
                  <div className="section-actions">
                    <button type="button" className="section-action" disabled>
                      <Settings className="section-action-icon" />
                      <span>Manage senders</span>
                      <span className="section-action-badge">Soon</span>
                    </button>
                  </div>
                </div>
                <div className="compose-field">
                  <div className="compose-row">
                    <div className="compose-field-group">
                      <span className="compose-field-label">Customer</span>
                      <Select
                        value={companyId}
                        onValueChange={(v) => {
                          if (v !== null) setCompanyId(v);
                          setRouteId("");
                        }}
                      >
                        <SelectTrigger className="compose-select">
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          {companies.map((c: { id: number; name: string }) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="compose-field-group">
                      <span className="compose-field-label">Sender ID</span>
                      <Input
                        value={senderId}
                        onChange={(e) => setSenderId(e.target.value.slice(0, 11))}
                        placeholder="SMSLCL"
                        maxLength={11}
                        className="compose-input-sm"
                      />
                    </div>
                  </div>
                  {/* Auto-select preview (route is always auto-selected now) */}
                  {companyId && previewData?.route && (
                    <div className="compose-preview">
                      <span className="compose-preview-label">Auto-route:</span>
                      <span className="compose-preview-route">{previewData.route.name}</span>
                      <span className="compose-preview-arrow">→</span>
                      <span className="compose-preview-vendor">{previewData.route.vendorName}</span>
                      <span className={`compose-preview-status ${previewData.route.vendorOnline ? "compose-preview-status--online" : "compose-preview-status--offline"}`}>
                        <span className="compose-preview-dot" />
                        {previewData.route.vendorOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                  )}
                  {companyId && previewData?.success && !previewData?.route && (
                    <div className="compose-preview compose-preview--warning">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {previewData.reason || "No active route for this customer"}
                    </div>
                  )}
                </div>
              </div>

              <div className="compose-divider" />

              {/* Message Section */}
              <div className="compose-section compose-section--stacked">
                <div className="compose-field-header">
                  <label className="compose-label">Message</label>
                  {sendMode === "dlt" && (
                  <div className="section-actions">
                    <button
                      type="button"
                      className="section-action"
                      onClick={() => {
                        if (!companyId) {
                          toast.error("Select a company first");
                          return;
                        }
                        setTemplatePickerOpen(true);
                      }}
                    >
                      <FileText className="section-action-icon" />
                      <span>Insert template</span>
                    </button>
                    <Popover open={dynFieldOpen} onOpenChange={setDynFieldOpen}>
                      <PopoverTrigger render={
                        <button type="button" className="section-action">
                          <Braces className="section-action-icon" />
                          <span>Add dynamic field</span>
                        </button>
                      } />
                      <PopoverContent className="dynfield-popover" align="start">
                        {[
                          { key: "firstName", label: "First name" },
                          { key: "lastName", label: "Last name" },
                          { key: "company", label: "Company name" },
                          { key: "phoneNumber", label: "Phone" },
                          { key: "email", label: "Email" },
                        ].map((f) => (
                          <button
                            key={f.key}
                            type="button"
                            className="dynfield-item"
                            onClick={() => {
                              setMessage((m) => m + `{${f.key}}`);
                              setDynFieldOpen(false);
                            }}
                          >
                            <Braces className="h-4 w-4" />
                            {f.label}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                    <button
                      type="button"
                      className="section-action"
                      onClick={() => setAttachFileOpen(true)}
                    >
                      <Paperclip className="section-action-icon" />
                      <span>Attach file</span>
                    </button>
                  </div>
                  )}
                </div>
                <div className="compose-field">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message here..."
                    rows={5}
                    className="compose-input compose-message-area"
                  />
                </div>
                {sendMode === "dlt" && attachedFiles.length > 0 && (
                  <div className="attached-files-list">
                    {attachedFiles.map((f) => (
                      <div key={f.id} className="attached-file-chip">
                        <Paperclip className="h-3.5 w-3.5" />
                        <span className="attached-file-name">{f.filename}</span>
                        <span className="attached-file-size">
                          ({(f.size / 1024).toFixed(1)} KB)
                        </span>
                        <button
                          type="button"
                          className="attached-file-remove"
                          onClick={() =>
                            setAttachedFiles((list) => list.filter((x) => x.id !== f.id))
                          }
                          aria-label="Remove attachment"
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Schedule panel (expanded when user clicks Schedule message) */}
              {scheduleMode && (
                <>
                  <div className="compose-divider" />
                  <SchedulePanel value={schedule} onChange={setSchedule} />
                </>
              )}

              {/* Hint + Encoding info row */}
              <div className="compose-hint-row">
                <span className="compose-hint">
                  {sendMode === "dlt"
                    ? (
                      <>
                        <Shield className="h-3.5 w-3.5" />
                        DLT mode — click &quot;Insert template&quot; to populate this with an approved template
                      </>
                    )
                    : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        Quick mode — just add numbers and a message, no template required
                      </>
                    )}
                </span>
                <div className="compose-meta">
                  <span className="compose-meta-item">
                    Characters: <strong>{enc.totalChars}/{enc.maxChars}</strong>
                  </span>
                  <span className="compose-meta-divider">|</span>
                  <span className="compose-meta-item">
                    Parts: <strong>{enc.parts}/6</strong>
                  </span>
                  <span className="compose-meta-divider">|</span>
                  <span className="compose-meta-item">
                    Encoding: <strong>{enc.encoding}</strong>
                  </span>
                  <span className="compose-meta-divider">|</span>
                  <span className="compose-meta-item">
                    Cost: <strong>₹{estimatedCost.toFixed(4)}</strong>
                  </span>
                </div>
              </div>

              {/* Footer: Actions */}
              <div className="compose-footer">
                {!scheduleMode ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setScheduleMode(true)}
                      className="compose-schedule-btn"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      Schedule message
                    </Button>
                    <div className="compose-actions">
                      <Button
                        variant="outline"
                        onClick={openPreview}
                        disabled={!message || recipientCount === 0}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Preview
                      </Button>
                      <Button
                        onClick={handleSend}
                        disabled={sending || !companyId || !message || recipientCount === 0}
                        className="compose-send-btn"
                      >
                        {sending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        {sending ? "Sending..." : "Send now"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => setScheduleMode(false)}
                      className="compose-cancel-schedule"
                    >
                      Cancel schedule
                    </Button>
                    <div className="compose-actions">
                      <Button
                        variant="outline"
                        onClick={openPreview}
                        disabled={!message || recipientCount === 0}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Preview message
                      </Button>
                      <Button
                        variant="outline"
                        onClick={openCalendar}
                        disabled={!message || recipientCount === 0}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        Preview in calendar
                      </Button>
                      <Button
                        onClick={handleSchedule}
                        disabled={scheduling || !companyId || !message || recipientCount === 0}
                        className="compose-send-btn"
                      >
                        {scheduling ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CalendarCheck className="mr-2 h-4 w-4" />
                        )}
                        {scheduling ? "Saving..." : editingScheduleId ? "Update schedule" : "Schedule"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Preview + Calendar dialogs */}
      <PreviewMessageDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        message={message}
        recipients={previewRecipients}
        encoding={enc.encoding}
        parts={enc.parts}
        senderId={senderId}
      />
      <CalendarPreviewDialog
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        customerId={companyId ? parseInt(companyId) : null}
        previewEvent={
          scheduleMode && message && recipientCount > 0 && scheduledDate()
            ? {
                scheduledAt: scheduledDate()!,
                recipientsCount: recipientCount,
                messageText: message,
                senderId,
                repeat: schedule.repeat,
              }
            : null
        }
      />

      {companyId && (
        <TemplatePickerDialog
          open={templatePickerOpen}
          onOpenChange={setTemplatePickerOpen}
          customerId={parseInt(companyId)}
          onSelect={(t) => {
            setMessage(t.content);
            toast.success(`Template "${t.name}" loaded`);
            // Mark as used
            fetch(`/api/templates/${t.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ markUsed: true }),
            }).catch(() => {});
          }}
        />
      )}

      <AttachFileDialog
        open={attachFileOpen}
        onOpenChange={setAttachFileOpen}
        onAttached={(f) => setAttachedFiles((list) => [...list, f])}
      />

      <SendProgressDialog
        open={progressOpen}
        onOpenChange={setProgressOpen}
        campaignId={progressCampaignId}
        messageId={progressMessageId}
        total={progressTotal}
      />
    </>
  );
}
