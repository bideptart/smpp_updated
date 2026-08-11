"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import PageBreadcrumb from "@/components/layout/PageBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  BarChart3,
  RefreshCw,
  Inbox,
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  Percent,
  SlidersHorizontal,
  X,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ReportMessage {
  id: string;
  messageId: string;
  customerName: string;
  accountName: string;
  systemId: string;
  routeName: string;
  senderId: string;
  destination: string;
  messageText: string;
  encoding: string;
  parts: number;
  status: string;
  errorCode: string | null;
  submittedAt: string;
  deliveredAt: string | null;
}

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function CustomerReportsPage() {
  const [accountId, setAccountId] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sender, setSender] = useState("");
  const [destination, setDestination] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [groupByAccount, setGroupByAccount] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});

  const { data: accountsData } = useSWR("/api/customer-accounts", fetcher);
  const accounts = accountsData?.data || [];

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (accountId) params.set("accountId", accountId);
  if (status) params.set("status", status);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (sender) params.set("sender", sender);
  if (destination) params.set("destination", destination);
  if (search) params.set("search", search);

  const { data: reportData, mutate } = useSWR(
    `/api/reports/messages?${params}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const messages: ReportMessage[] = reportData?.data || [];
  const stats = reportData?.stats || {};
  const pagination = reportData?.pagination || { page: 1, totalPages: 1, total: 0, limit };

  // Dashboard summary (charts)
  const summaryParams = new URLSearchParams();
  if (accountId) summaryParams.set("accountId", accountId);
  if (dateFrom) summaryParams.set("dateFrom", dateFrom);
  if (dateTo) summaryParams.set("dateTo", dateTo);
  const { data: summaryData } = useSWR(
    `/api/reports/summary?${summaryParams}`,
    fetcher,
    { refreshInterval: 15000 }
  );
  const [liveOnly, setLiveOnly] = useState(false);
  const accountRows = useMemo(() => {
    const rows: Array<{ systemId: string; accountName: string | null; companyName: string | null; bindMode: string | null; total: number; sent: number; delivered: number; failed: number; live: boolean }> =
      summaryData?.perAccount || [];
    return rows
      .filter((r) => !liveOnly || r.live)
      .map((r) => {
        const submitted = r.total;
        const successful = r.sent + r.delivered;
        return {
          ...r,
          submitted,
          successful,
          billableC: successful,
          billableV: successful,
          asr: submitted > 0 ? (successful / submitted) * 100 : 0,
          dlr: submitted > 0 ? (r.delivered / submitted) * 100 : 0,
          cr: 0,
        };
      });
  }, [summaryData, liveOnly]);

  // Group messages by account for campaign view
  const groupedMessages = messages.reduce((acc: Record<string, ReportMessage[]>, m) => {
    const key = m.customerName || m.systemId || m.accountName || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const toggleAccountExpand = (key: string) => {
    setExpandedAccounts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activeFilters =
    [accountId, status, dateFrom, dateTo, sender, destination].filter(Boolean).length;

  function setQuickRange(kind: "15m" | "2h" | "6h" | "12h" | "24h" | "today") {
    const end = new Date();
    let start: Date;
    if (kind === "today") { start = new Date(); start.setHours(0, 0, 0, 0); }
    else {
      const mins = { "15m": 15, "2h": 120, "6h": 360, "12h": 720, "24h": 1440 }[kind];
      start = new Date(end.getTime() - mins * 60000);
    }
    setDateFrom(toLocalInput(start));
    setDateTo(toLocalInput(end));
    setPage(1);
  }

  async function exportCSV() {
    try {
      const allParams = new URLSearchParams({ page: "1", limit: "10000" });
      if (accountId) allParams.set("accountId", accountId);
      if (status) allParams.set("status", status);
      if (dateFrom) allParams.set("dateFrom", dateFrom);
      if (dateTo) allParams.set("dateTo", dateTo);
      if (sender) allParams.set("sender", sender);
      if (destination) allParams.set("destination", destination);
      if (search) allParams.set("search", search);

      const res = await fetch(`/api/reports/messages?${allParams}`);
      const result = await res.json();
      if (!result.success || !result.data?.length) {
        toast.error("No data to export");
        return;
      }
      const headers = [
        "Message ID", "Customer", "Account", "System ID", "Route", "Sender",
        "Destination", "Encoding", "Parts", "Status", "Error Code", "Submitted At", "Delivered At",
      ];
      const rows = result.data.map((m: ReportMessage) => [
        m.messageId, m.customerName, m.accountName, m.systemId, m.routeName,
        m.senderId, m.destination, m.encoding, m.parts, m.status,
        m.errorCode || "", m.submittedAt, m.deliveredAt || "",
      ]);
      const csv = [headers, ...rows]
        .map((row) => row.map((cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sms-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch {
      toast.error("Export failed");
    }
  }

  function clearFilters() {
    setAccountId(""); setStatus(""); setDateFrom(""); setDateTo("");
    setSender(""); setDestination(""); setSearch(""); setPage(1);
  }

  const statusStyle = (s: string) => {
    if (s === "delivered") return "campaign-status campaign-status--delivered";
    if (s === "failed") return "campaign-status campaign-status--failed";
    if (s === "queued" || s === "sending") return "campaign-status campaign-status--pending";
    if (s === "sent" || s === "submitted") return "campaign-status campaign-status--sent";
    return "campaign-status campaign-status--default";
  };

  const selectedAccount = accounts.find((a: { id: number }) => String(a.id) === accountId);
  const total = pagination.total || 0;
  const from = total === 0 ? 0 : (pagination.page - 1) * (pagination.limit || limit) + 1;
  const to = Math.min(pagination.page * (pagination.limit || limit), total);

  return (
    <>
      <TopBar title="Customer Reports" />
      <div className="page-content">
        <PageBreadcrumb crumbs={[{ label: "Customers" }, { label: "Reports" }]} />

        {/* Toolbar */}
        <div className="dash-toolbar">
          <div className="dash-toolbar-search">
            <Search className="dash-toolbar-search-icon" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search number, sender or message ID…"
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="h-4 w-4 mr-1.5" />
            Filters
            {activeFilters > 0 && <span className="dash-filter-count">{activeFilters}</span>}
          </Button>
          <div className="dash-toggle-group">
            <button onClick={() => setGroupByAccount(true)} className={`dash-toggle-btn ${groupByAccount ? "dash-toggle-btn--active" : ""}`}>Campaign</button>
            <button onClick={() => setGroupByAccount(false)} className={`dash-toggle-btn ${!groupByAccount ? "dash-toggle-btn--active" : ""}`}>List</button>
          </div>
          <div style={{ flex: 1 }} />
          <Button variant="outline" size="sm" onClick={() => mutate()}><RefreshCw className="h-3.5 w-3.5" /></Button>
          <Button size="sm" onClick={exportCSV}><Download className="h-3.5 w-3.5 mr-1" />Export</Button>
        </div>

        {/* Summary Cards */}
        <div className="campaign-stats-grid">
          <CampaignStatCard icon={Inbox} label="Total" value={stats.total || 0} color="var(--t-text-4)" bg="var(--t-bg-muted)" />
          <CampaignStatCard icon={Clock} label="Queued" value={stats.queued || 0} color="var(--t-amber-fg)" bg="var(--t-amber-bg-2)" />
          <CampaignStatCard icon={Send} label="Sending" value={stats.sending || 0} color="#3b82f6" bg="var(--t-blue-bg)" />
          <CampaignStatCard icon={CheckCircle2} label="Sent" value={stats.sent || 0} color="var(--t-indigo-fg)" bg="var(--t-indigo-bg)" />
          <CampaignStatCard icon={CheckCircle2} label="Delivered" value={stats.delivered || 0} color="var(--t-green-fg-2)" bg="var(--t-green-bg-2)" />
          <CampaignStatCard icon={XCircle} label="Failed" value={stats.failed || 0} color="var(--t-red-fg-2)" bg="var(--t-red-bg-2)" />
          <CampaignStatCard icon={Percent} label="DLR%" value={stats.dlrPercent != null ? `${stats.dlrPercent}%` : "—"} color="#8b5cf6" bg="#f5f3ff" />
        </div>

        {/* Account traffic — Active Ports (ASR / DLR / CR) */}
        <div className="dtable-card">
          <div className="dtable-header">
            Customer Traffic
            <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--t-text-muted)", cursor: "pointer", fontWeight: 500 }}>
              <input type="checkbox" checked={liveOnly} onChange={(e) => setLiveOnly(e.target.checked)} />
              Live only
            </label>
          </div>
          <div className="dtable-scroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Type</th>
                  <th style={{ textAlign: "right" }}>Submitted</th>
                  <th style={{ textAlign: "right" }}>Successful</th>
                  <th style={{ textAlign: "right" }}>Failed</th>
                  <th style={{ textAlign: "right" }}>Billable (C)</th>
                  <th style={{ textAlign: "right" }}>Billable (V)</th>
                  <th style={{ textAlign: "center" }}>ASR%</th>
                  <th style={{ textAlign: "center" }}>DLR%</th>
                  <th style={{ textAlign: "center" }}>CR%</th>
                </tr>
              </thead>
              <tbody>
                {accountRows.length === 0 ? (
                  <tr><td colSpan={10} className="dtable-empty">No traffic</td></tr>
                ) : accountRows.map((r) => (
                  <tr key={r.systemId}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--t-indigo-fg)", display: "inline-block", flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--t-text-2)" }}>{r.systemId}</div>
                          <div style={{ fontSize: 10, color: "var(--t-text-faint)" }}>{"Customer"}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: "var(--t-text-4)" }}>{r.bindMode || "API"}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--t-blue-fg)", fontWeight: 600 }}>{r.submitted}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--t-green-fg)", fontWeight: 600 }}>{r.successful}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--t-red-fg)", fontWeight: 600 }}>{r.failed}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--t-text-4)" }}>{r.billableC}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--t-text-4)" }}>{r.billableV}</td>
                    <td style={{ padding: "6px 10px" }}><Meter pct={r.asr} /></td>
                    <td style={{ padding: "6px 10px" }}><Meter pct={r.dlr} /></td>
                    <td style={{ padding: "6px 10px" }}><Meter pct={r.cr} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Results header: entries + count */}
        <div className="dash-results-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Show
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="dtable-page-size"
            >
              {[25, 50, 100, 200].map((n) => (<option key={n} value={n}>{n}</option>))}
            </select>
            entries
          </div>
          {groupByAccount && Object.keys(groupedMessages).length > 1 && (
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => { const o: Record<string, boolean> = {}; Object.keys(groupedMessages).forEach((k) => (o[k] = true)); setExpandedAccounts(o); }} className="dash-expand-link">Expand all</button>
              <button onClick={() => { const o: Record<string, boolean> = {}; Object.keys(groupedMessages).forEach((k) => (o[k] = false)); setExpandedAccounts(o); }} className="dash-expand-link dash-expand-link--muted">Collapse all</button>
            </div>
          )}
          <div>
            Showing <strong style={{ color: "var(--t-text-2)" }}>{from}</strong>–<strong style={{ color: "var(--t-text-2)" }}>{to}</strong> of <strong style={{ color: "var(--t-text-2)" }}>{total.toLocaleString()}</strong>
          </div>
        </div>

        {/* Messages — Campaign or List view */}
        <div style={{ maxHeight: "62vh", overflowY: "auto", borderRadius: 10 }}>
        {messages.length === 0 ? (
          <div className="campaign-empty">
            <BarChart3 className="h-12 w-12 text-slate-300" />
            <p className="campaign-empty-title">No messages found</p>
            <p className="campaign-empty-hint">Adjust your filters or check back later</p>
          </div>
        ) : groupByAccount ? (
          <div className="campaign-groups">
            {Object.entries(groupedMessages).map(([key, msgs]) => {
              const delivered = msgs.filter((m) => m.status === "delivered").length;
              const failed = msgs.filter((m) => m.status === "failed").length;
              const isExpanded = expandedAccounts[key] ?? (Object.keys(groupedMessages).length <= 6);
              return (
                <div key={key} className="campaign-group">
                  <button className="campaign-group-header" onClick={() => toggleAccountExpand(key)}>
                    <div className="campaign-group-header-left">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <div>
                        <div className="campaign-group-name">{key}</div>
                        <div className="campaign-group-sub">{msgs[0]?.customerName || ""}</div>
                      </div>
                    </div>
                    <div className="campaign-group-metrics">
                      <div className="campaign-metric"><span className="campaign-metric-label">Total</span><span className="campaign-metric-value">{msgs.length}</span></div>
                      <div className="campaign-metric"><span className="campaign-metric-label">Delivered</span><span className="campaign-metric-value campaign-metric-value--success">{delivered}</span></div>
                      <div className="campaign-metric"><span className="campaign-metric-label">Failed</span><span className="campaign-metric-value campaign-metric-value--danger">{failed}</span></div>
                      <div className="campaign-metric"><span className="campaign-metric-label">DLR%</span><span className="campaign-metric-value">{msgs.length > 0 ? ((delivered / msgs.length) * 100).toFixed(1) : "0"}%</span></div>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="campaign-group-body">
                      <table className="campaign-table">
                        <thead>
                          <tr>
                            <th className="campaign-th">Time</th>
                            <th className="campaign-th">Sender</th>
                            <th className="campaign-th">Destination</th>
                            <th className="campaign-th">Message</th>
                            <th className="campaign-th">Parts</th>
                            <th className="campaign-th">Status</th>
                            <th className="campaign-th">Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {msgs.map((m) => (
                            <tr key={m.id} className="campaign-tr">
                              <td className="campaign-td campaign-td--mono">
                                {new Date(m.submittedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                              </td>
                              <td className="campaign-td">{m.senderId}</td>
                              <td className="campaign-td campaign-td--mono">{m.destination}</td>
                              <td className="campaign-td campaign-td--msg">{m.messageText}</td>
                              <td className="campaign-td campaign-td--center">{m.parts}</td>
                              <td className="campaign-td"><span className={statusStyle(m.status)}>{m.status}</span></td>
                              <td className="campaign-td campaign-td--error">{m.errorCode || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="campaign-list-wrap">
            <table className="campaign-table">
              <thead>
                <tr>
                  <th className="campaign-th">Time</th>
                  <th className="campaign-th">Account</th>
                  <th className="campaign-th">Sender</th>
                  <th className="campaign-th">Destination</th>
                  <th className="campaign-th">Message</th>
                  <th className="campaign-th">Parts</th>
                  <th className="campaign-th">Status</th>
                  <th className="campaign-th">Error</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id} className="campaign-tr">
                    <td className="campaign-td campaign-td--mono">
                      {new Date(m.submittedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}
                    </td>
                    <td className="campaign-td"><div>{m.accountName}</div><div className="text-[10px] text-muted-foreground">{m.systemId}</div></td>
                    <td className="campaign-td">{m.senderId}</td>
                    <td className="campaign-td campaign-td--mono">{m.destination}</td>
                    <td className="campaign-td campaign-td--msg">{m.messageText}</td>
                    <td className="campaign-td campaign-td--center">{m.parts}</td>
                    <td className="campaign-td"><span className={statusStyle(m.status)}>{m.status}</span></td>
                    <td className="campaign-td campaign-td--error">{m.errorCode || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>

        {/* Pagination */}
        <div className="dash-pagination">
          <span>
            Page <strong style={{ color: "var(--t-text-2)" }}>{pagination.page}</strong> of <strong style={{ color: "var(--t-text-2)" }}>{pagination.totalPages}</strong>
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(1)}><ChevronsLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="dtable-page-indicator">{pagination.page}</span>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(pagination.totalPages)}><ChevronsRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      {/* Right slide-over Filters */}
      {filtersOpen && (
        <div onClick={() => setFiltersOpen(false)} className="dash-filter-overlay" />
      )}
      <aside className={`dash-filter-panel ${filtersOpen ? "" : "dash-filter-panel--closed"}`}>
        <div className="dash-filter-panel-header">
          <div className="dash-filter-panel-title">
            <SlidersHorizontal className="h-4 w-4" /> Filters {activeFilters > 0 && <span className="dash-filter-count" style={{ background: "var(--t-blue-bg)", color: "var(--t-blue-fg)" }}>{activeFilters}</span>}
          </div>
          <button onClick={() => setFiltersOpen(false)} className="dash-filter-panel-close"><X className="h-5 w-5" /></button>
        </div>

        <div className="dash-filter-panel-body">
          <label className="dash-field-label">Quick range</label>
          <div className="dash-quick-range-grid">
            {([["15m", "Last 15 Min"], ["2h", "Last 2 Hrs"], ["6h", "Last 6 Hrs"], ["12h", "Last 12 Hrs"], ["24h", "Last 24 Hrs"], ["today", "Today"]] as const).map(([k, lab]) => (
              <button key={k} onClick={() => setQuickRange(k)} className="dash-quick-range-btn">{lab}</button>
            ))}
          </div>

          <div className="dash-date-grid">
            <div>
              <label className="dash-field-label">Start date/time</label>
              <input type="datetime-local" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="dash-field-input" />
            </div>
            <div>
              <label className="dash-field-label">End date/time</label>
              <input type="datetime-local" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="dash-field-input" />
            </div>
          </div>

          <div className="dash-field">
            <label className="dash-field-label">Account</label>
            <Select value={accountId} onValueChange={(v) => { if (v !== null) setAccountId(v); setPage(1); }}>
              <SelectTrigger style={{ height: 38 }}>
                <span className="truncate">{accountId ? (selectedAccount?.accountName || selectedAccount?.systemId || "Account") : "All accounts"}</span>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="">All accounts</SelectItem>
                {accounts.map((a: { id: number; systemId: string; accountName: string | null }) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.accountName || a.systemId}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="dash-field">
            <label className="dash-field-label">Delivery status</label>
            <Select value={status} onValueChange={(v) => { if (v !== null) setStatus(v); setPage(1); }}>
              <SelectTrigger style={{ height: 38 }}>
                <span className="truncate">{status ? status : "All statuses"}</span>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="sending">Sending</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="dash-field">
            <label className="dash-field-label">Sender ID</label>
            <Input value={sender} onChange={(e) => { setSender(e.target.value); setPage(1); }} placeholder="e.g. SMSLCL" />
          </div>

          <div className="dash-field">
            <label className="dash-field-label">Destination / MSISDN</label>
            <Input value={destination} onChange={(e) => { setDestination(e.target.value); setPage(1); }} placeholder="e.g. 9193…" />
          </div>
        </div>

        <div className="dash-filter-panel-footer">
          <Button variant="outline" style={{ flex: 1 }} onClick={clearFilters}>Reset</Button>
          <Button style={{ flex: 1 }} onClick={() => setFiltersOpen(false)}>Apply</Button>
        </div>
      </aside>
    </>
  );
}

function Meter({ pct }: { pct: number }) {
  const color = pct >= 80 ? "var(--t-green-fg)" : pct >= 50 ? "var(--t-amber-fg)" : "var(--t-red-fg-2)";
  const bg = pct >= 80 ? "var(--t-green-bg)" : pct >= 50 ? "var(--t-amber-bg)" : "var(--t-red-bg)";
  const w = Math.min(Math.max(pct, 0), 100);
  return (
    <div className="dash-meter" style={{ background: bg }}>
      <div className="dash-meter-fill" style={{ width: `${w}%`, backgroundColor: color }} />
      <span className="dash-meter-label">{pct.toFixed(2)}%</span>
    </div>
  );
}

function CampaignStatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
  bg: string;
}) {
  return (
    <div className="campaign-stat-card">
      <div className="campaign-stat-icon" style={{ background: bg, color }}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="campaign-stat-info">
        <span className="campaign-stat-label">{label}</span>
        <span className="campaign-stat-value" style={{ color }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
      </div>
    </div>
  );
}
