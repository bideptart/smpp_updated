"use client";

import { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area,
} from "recharts";
import TopBar from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, SlidersHorizontal, X, RefreshCw, Inbox, Clock, Send,
  CheckCircle2, XCircle, Percent, Users, Truck, ChevronLeft, ChevronRight,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Company { id: number; name: string; type: "customer" | "vendor"; }
interface Row { id: number; name: string; total: number; sent: number; delivered: number; failed: number; queued: number; avgRate: number; }

const STATUS_COLORS: Record<string, string> = {
  delivered: "var(--t-green-fg-2)", sent: "var(--t-indigo-fg)", submitted: "#0ea5e9",
  sending: "#3b82f6", queued: "var(--t-amber-fg)", failed: "var(--t-red-fg-2)",
};

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Filled meter: colored box background + fill bar + % overlaid on top. */
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

function StatCard({ icon: Icon, label, value, color, bg }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; color: string; bg: string; }) {
  return (
    <div className="campaign-stat-card">
      <div className="campaign-stat-icon" style={{ background: bg, color }}><Icon className="h-4 w-4" /></div>
      <div className="campaign-stat-info">
        <span className="campaign-stat-label">{label}</span>
        <span className="campaign-stat-value" style={{ color }}>{typeof value === "number" ? value.toLocaleString() : value}</span>
      </div>
    </div>
  );
}

const PAGE_SIZES = [10, 50, 100, 500];

function TrafficTable({ title, icon: Icon, rows, rateLabel }: { title: string; icon: React.ComponentType<{ className?: string }>; rows: Row[]; rateLabel: string; }) {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(page, totalPages);
  const view = rows.slice((cur - 1) * pageSize, cur * pageSize);
  const from = total === 0 ? 0 : (cur - 1) * pageSize + 1;
  const to = Math.min(cur * pageSize, total);

  return (
    <div className="dtable-card">
      <div className="dtable-header">
        <Icon className="h-4 w-4" /> {title}
        <span className="dtable-header-count">{total} total</span>
      </div>
      <div className="dtable-scroll">
        <table className="dtable">
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ textAlign: "right" }}>Total</th>
              <th style={{ textAlign: "right" }}>Queued</th>
              <th style={{ textAlign: "right" }}>Sent</th>
              <th style={{ textAlign: "right" }}>Delivered</th>
              <th style={{ textAlign: "right" }}>Failed</th>
              <th style={{ minWidth: 110 }}>ASR</th>
              <th style={{ minWidth: 110 }}>DLR</th>
              <th style={{ textAlign: "right" }}>{rateLabel}</th>
            </tr>
          </thead>
          <tbody>
            {view.length === 0 ? (
              <tr><td colSpan={9} className="dtable-empty">No traffic</td></tr>
            ) : view.map((r) => {
              const asr = r.total ? ((r.sent + r.delivered) / r.total) * 100 : 0;
              const dlr = r.total ? (r.delivered / r.total) * 100 : 0;
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600, color: "var(--t-text-2)" }}>{r.name}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.total}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--t-amber-fg)" }}>{r.queued}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--t-indigo-fg)" }}>{r.sent}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--t-green-fg)" }}>{r.delivered}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--t-red-fg)" }}>{r.failed}</td>
                  <td style={{ padding: "6px 12px" }}><Meter pct={asr} /></td>
                  <td style={{ padding: "6px 12px" }}><Meter pct={dlr} /></td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--t-text-4)" }}>{r.avgRate.toFixed(4)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="dtable-footer">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Show
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="dtable-page-size">
            {PAGE_SIZES.map((n) => (<option key={n} value={n}>{n}</option>))}
          </select>
          entries · <strong style={{ color: "var(--t-text-2)" }}>{from}-{to}</strong> of {total}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Button variant="outline" size="sm" disabled={cur <= 1} onClick={() => setPage(cur - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="dtable-page-indicator">{cur} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={cur >= totalPages} onClick={() => setPage(cur + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [customerId, setCustomerId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [sender, setSender] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: companiesData } = useSWR("/api/companies", fetcher);
  const companies: Company[] = companiesData?.data || [];
  const customers = companies.filter((c) => c.type === "customer");
  const vendors = companies.filter((c) => c.type === "vendor");

  const params = new URLSearchParams();
  if (customerId) params.set("customerId", customerId);
  if (vendorId) params.set("vendorId", vendorId);
  if (sender) params.set("sender", sender);
  if (status) params.set("status", status);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (search) params.set("search", search);

  const { data, mutate } = useSWR(`/api/dashboard/summary?${params}`, fetcher, { refreshInterval: 10000 });
  const [updatedAt, setUpdatedAt] = useState<number>(0);
  const [agoSec, setAgoSec] = useState(0);
  // Stamps when data last actually changed (for the "Xs ago" indicator) --
  // this has to be an effect, not derived during render, since it needs to
  // record a point in time correlated with the SWR cache updating, not a
  // value recomputable from `data` alone.
  useEffect(() => {
    if (data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUpdatedAt(Date.now());
    }
  }, [data]);
  useEffect(() => {
    if (!updatedAt) return;
    const tick = () => setAgoSec(Math.max(0, Math.round((Date.now() - updatedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [updatedAt]);
  const totals = data?.totals || { total: 0, queued: 0, sent: 0, delivered: 0, failed: 0, dlrPercent: 0 };
  const byCustomer: Row[] = data?.byCustomer || [];
  const byVendor: Row[] = data?.byVendor || [];
  const daily = data?.daily || [];

  const statusChart = useMemo(() => {
    const order = ["delivered", "sent", "submitted", "sending", "queued", "failed"];
    const rows: Array<{ status: string; count: number }> = data?.statusBreakdown || [];
    return order.map((s) => ({ name: s, value: rows.find((x) => x.status === s)?.count || 0 })).filter((d) => d.value > 0);
  }, [data]);

  const activeFilters = [customerId, vendorId, sender, status, dateFrom, dateTo].filter(Boolean).length;

  function setQuickRange(mins: number | "today") {
    const end = new Date();
    let start: Date;
    if (mins === "today") { start = new Date(); start.setHours(0, 0, 0, 0); }
    else start = new Date(end.getTime() - mins * 60000);
    setDateFrom(toLocalInput(start)); setDateTo(toLocalInput(end));
  }
  function clearFilters() {
    setCustomerId(""); setVendorId(""); setSender(""); setStatus(""); setDateFrom(""); setDateTo(""); setSearch("");
  }

  return (
    <>
      <TopBar title="Dashboard" />
      <div className="page-content">
        <div className="dash-toolbar">
          <div className="dash-toolbar-title">Overall Report</div>
          <div className="dash-toolbar-search">
            <Search className="dash-toolbar-search-icon" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search number or message ID…" className="pl-8" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filters
            {activeFilters > 0 && <span className="dash-filter-count">{activeFilters}</span>}
          </Button>
          <span className="dash-live-badge">
            <span className="dash-live-dot" />
            Live · {agoSec}s ago
          </span>
          <Button variant="outline" size="sm" onClick={() => mutate()}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>

        <div className="campaign-stats-grid">
          <StatCard icon={Inbox} label="Total SMS" value={totals.total} color="var(--t-text-4)" bg="var(--t-bg-muted)" />
          <StatCard icon={Clock} label="Queued" value={totals.queued} color="var(--t-amber-fg)" bg="var(--t-amber-bg-2)" />
          <StatCard icon={Send} label="Sent" value={totals.sent} color="var(--t-indigo-fg)" bg="var(--t-indigo-bg)" />
          <StatCard icon={CheckCircle2} label="Delivered" value={totals.delivered} color="var(--t-green-fg-2)" bg="var(--t-green-bg-2)" />
          <StatCard icon={XCircle} label="Failed" value={totals.failed} color="var(--t-red-fg-2)" bg="var(--t-red-bg-2)" />
          <StatCard icon={Percent} label="DLR%" value={`${totals.dlrPercent}%`} color="var(--t-violet-fg)" bg="var(--t-violet-bg)" />
        </div>

        <div className="dash-charts-grid">
          <div className="chart-container">
            <div className="chart-header">
              <h3 className="chart-title">Status distribution</h3>
            </div>
            {statusChart.length === 0 ? (
              <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t-text-faint)", fontSize: 13 }}>No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusChart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {statusChart.map((d) => (<Cell key={d.name} fill={STATUS_COLORS[d.name] || "#94a3b8"} />))}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="chart-container">
            <div className="chart-header">
              <h3 className="chart-title">Traffic trend (last 14 days)</h3>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={daily} margin={{ top: 5, right: 10, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip /><Legend />
                <Area type="monotone" dataKey="total" stroke="#6366f1" fill="#e0e7ff" name="Total" />
                <Area type="monotone" dataKey="delivered" stroke="#10b981" fill="#d1fae5" name="Delivered" />
                <Area type="monotone" dataKey="failed" stroke="#ef4444" fill="#fee2e2" name="Failed" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <TrafficTable title="Customer Traffic" icon={Users} rows={byCustomer} rateLabel="Avg Rate (C)" />
        <TrafficTable title="Vendor Traffic" icon={Truck} rows={byVendor} rateLabel="Avg Rate (V)" />
      </div>

      {filtersOpen && <div onClick={() => setFiltersOpen(false)} className="dash-filter-overlay" />}
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
            {([["15m", 15], ["30m", 30], ["2h", 120], ["4h", 240], ["8h", 480], ["Today", "today"]] as const).map(([lab, v]) => (
              <button key={lab} onClick={() => setQuickRange(v as number | "today")} className="dash-quick-range-btn">{lab}</button>
            ))}
          </div>
          <div className="dash-date-grid">
            <div>
              <label className="dash-field-label">From</label>
              <input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="dash-field-input" />
            </div>
            <div>
              <label className="dash-field-label">To</label>
              <input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="dash-field-input" />
            </div>
          </div>
          <div className="dash-field">
            <label className="dash-field-label">Customer</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="dash-field-input" style={{ cursor: "pointer" }}>
              <option value="">All customers</option>
              {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div className="dash-field">
            <label className="dash-field-label">Vendor</label>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="dash-field-input" style={{ cursor: "pointer" }}>
              <option value="">All vendors</option>
              {vendors.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div className="dash-field">
            <label className="dash-field-label">Delivery status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="dash-field-input" style={{ cursor: "pointer" }}>
              <option value="">All statuses</option>
              {["queued", "sending", "submitted", "sent", "delivered", "failed"].map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
          <div className="dash-field">
            <label className="dash-field-label">Sender ID</label>
            <Input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="e.g. SMSLCL" />
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
