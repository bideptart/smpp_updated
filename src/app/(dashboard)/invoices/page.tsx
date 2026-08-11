"use client";

import { useState } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import StatCard from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, Users, Calendar, Save, X, Download, CheckCircle2, FileText,
  FilePen, TrendingUp, TrendingDown, Wallet, Search,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Compact money for KPI tiles — full precision stays in the table. */
function money(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

interface InvoiceRow {
  id: number;
  customerId: number;
  customerName: string;
  periodStart: string;
  periodEnd: string;
  submitted: number;
  delivered: number;
  failed: number;
  revenue: number;
  cost: number;
  margin: number;
  status: string;
  createdAt: string;
}

interface Company {
  id: number;
  name: string;
  type: string;
}

export default function InvoicesPage() {
  const { data, mutate } = useSWR("/api/invoices", fetcher, { refreshInterval: 30000 });
  const { data: companiesData } = useSWR("/api/companies", fetcher);

  const invoices: InvoiceRow[] = data?.data || [];
  const companies: Company[] = companiesData?.data || [];
  const customers = companies.filter((c) => c.type === "customer");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ customerId: "", periodStart: "", periodEnd: "" });
  const [generating, setGenerating] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "finalized">("all");

  const totals = invoices.reduce(
    (a, i) => ({
      count: a.count + 1,
      draft: a.draft + (i.status === "draft" ? 1 : 0),
      finalized: a.finalized + (i.status === "finalized" ? 1 : 0),
      revenue: a.revenue + i.revenue,
      cost: a.cost + i.cost,
      margin: a.margin + i.margin,
    }),
    { count: 0, draft: 0, finalized: 0, revenue: 0, cost: 0, margin: 0 }
  );

  const q = query.trim().toLowerCase();
  const visible = invoices.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    return !q || i.customerName.toLowerCase().includes(q);
  });

  async function handleGenerate() {
    if (!form.customerId || !form.periodStart || !form.periodEnd) {
      toast.error("Customer, start date, and end date are required");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: parseInt(form.customerId, 10),
          periodStart: new Date(form.periodStart).toISOString(),
          periodEnd: new Date(form.periodEnd + "T23:59:59.999Z").toISOString(),
        }),
      });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.error || "Failed to generate statement");
        return;
      }
      toast.success("Statement generated");
      setDialogOpen(false);
      setForm({ customerId: "", periodStart: "", periodEnd: "" });
      mutate();
    } catch {
      toast.error("An error occurred");
    } finally {
      setGenerating(false);
    }
  }

  async function handleFinalize(id: number) {
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "finalized" }),
      });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.error || "Failed to finalize");
        return;
      }
      toast.success("Statement finalized");
      mutate();
    } catch {
      toast.error("An error occurred");
    }
  }

  return (
    <>
      <TopBar
        title="Invoices"
        subtitle="Usage statements reconciling customer consumption against prepaid balance"
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Generate Statement
          </Button>
        }
      />
      <div className="page-content">
        <div className="dp-stats">
          <StatCard icon={FileText} label="Statements" value={totals.count} color="var(--t-text-4)" bg="var(--t-bg-muted)" />
          <StatCard icon={FilePen} label="Draft" value={totals.draft} color="var(--t-amber-fg)" bg="var(--t-amber-bg)" />
          <StatCard icon={CheckCircle2} label="Finalized" value={totals.finalized} color="var(--t-green-fg)" bg="var(--t-green-bg)" />
          <StatCard icon={TrendingUp} label="Revenue" value={money(totals.revenue)} color="var(--t-indigo-fg)" bg="var(--t-indigo-bg)" />
          <StatCard icon={TrendingDown} label="Cost" value={money(totals.cost)} color="var(--t-red-fg)" bg="var(--t-red-bg)" />
          <StatCard
            icon={Wallet}
            label="Margin"
            value={money(totals.margin)}
            color={totals.margin >= 0 ? "var(--t-green-fg)" : "var(--t-red-fg)"}
            bg={totals.margin >= 0 ? "var(--t-green-bg)" : "var(--t-red-bg)"}
          />
        </div>

        <div className="help-card">
          <div className="help-card-title">Usage Statements</div>
          <p className="help-card-text">
            A statement reconciles what a customer consumed against their prepaid balance for a
            period — it doesn&apos;t charge anything new. Balance is already deducted at send time.
          </p>
        </div>

        <div className="dp-toolbar">
          <div className="dp-search">
            <Search className="dp-search-icon" />
            <input
              className="dp-search-input"
              placeholder="Search customer…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="dp-search-clear" onClick={() => setQuery("")} aria-label="Clear search">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="dp-seg">
            {(["all", "draft", "finalized"] as const).map((s) => (
              <button
                key={s}
                className={`dp-seg-btn${statusFilter === s ? " dp-seg-btn--active" : ""}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === "all" ? "All" : s === "draft" ? "Draft" : "Finalized"}
              </button>
            ))}
          </div>
          <span className="dp-count">
            {visible.length} of {invoices.length} statement{invoices.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="dp-card">
          {visible.length === 0 ? (
            <div className="dp-empty">
              <div className="dp-empty-icon"><FileText className="h-5 w-5" /></div>
              <div className="dp-empty-title">
                {invoices.length === 0 ? "No statements generated yet" : "No statements match your search"}
              </div>
              <div className="dp-empty-hint">
                {invoices.length === 0
                  ? "Generate a statement to summarise a customer's usage for a date range."
                  : "Try a different customer or clear the filters."}
              </div>
            </div>
          ) : (
            <div className="dp-scroll">
              <table className="dp-table">
                <thead>
                  <tr>
                    <th className="dp-th">Customer</th>
                    <th className="dp-th">Period</th>
                    <th className="dp-th dp-th--right">Messages</th>
                    <th className="dp-th dp-th--right">Revenue</th>
                    <th className="dp-th dp-th--right">Cost</th>
                    <th className="dp-th dp-th--right">Margin</th>
                    <th className="dp-th dp-th--center">Status</th>
                    <th className="dp-th dp-th--right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((inv) => {
                    const dlr = inv.submitted > 0 ? (inv.delivered / inv.submitted) * 100 : 0;
                    return (
                      <tr key={inv.id} className="dp-tr">
                        <td className="dp-td dp-td--strong">
                          {inv.customerName}
                          <span className="dp-sub">
                            Generated {new Date(inv.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="dp-td">
                          {new Date(inv.periodStart).toLocaleDateString()} – {new Date(inv.periodEnd).toLocaleDateString()}
                        </td>
                        <td className="dp-td dp-td--num">
                          {inv.submitted.toLocaleString()}
                          <span className="dp-sub">
                            {inv.delivered.toLocaleString()} dlvd · {inv.failed.toLocaleString()} failed · {dlr.toFixed(1)}%
                          </span>
                        </td>
                        <td className="dp-td dp-td--num">{inv.revenue.toFixed(4)}</td>
                        <td className="dp-td dp-td--num">{inv.cost.toFixed(4)}</td>
                        <td
                          className="dp-td dp-td--num"
                          style={{
                            color:
                              inv.margin > 0
                                ? "var(--t-green-fg)"
                                : inv.margin < 0
                                ? "var(--t-red-fg)"
                                : undefined,
                            fontWeight: 600,
                          }}
                        >
                          {inv.margin.toFixed(4)}
                        </td>
                        <td className="dp-td dp-td--center">
                          <span className={`dp-pill ${inv.status === "finalized" ? "dp-pill--green" : "dp-pill--amber"}`}>
                            <i className="dp-dot" />
                            {inv.status}
                          </span>
                        </td>
                        <td className="dp-td dp-td--right">
                          <div className="dp-actions">
                            {inv.status === "draft" && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleFinalize(inv.id)} title="Finalize">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <a href={`/api/invoices/${inv.id}/export`} title="Export CSV">
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md modal-card">
            <DialogHeader className="modal-header">
              <div className="modal-header-icon">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="modal-title">Generate Statement</DialogTitle>
                <p className="modal-subtitle">Summarizes a customer&apos;s usage for a date range</p>
              </div>
            </DialogHeader>
            <div className="modal-body">
              <div className="modal-section">
                <div className="modal-field modal-field--full">
                  <Label className="modal-label">Customer</Label>
                  <Select
                    value={form.customerId}
                    onValueChange={(v) => v && setForm((f) => ({ ...f, customerId: v }))}
                  >
                    <SelectTrigger className="modal-select-trigger">
                      <Users className="modal-select-icon" />
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="modal-grid">
                  <div className="modal-field">
                    <Label className="modal-label">Period Start</Label>
                    <div className="modal-input-wrap">
                      <Calendar className="modal-input-icon" />
                      <Input
                        type="date"
                        value={form.periodStart}
                        onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
                        className="modal-input-with-icon"
                      />
                    </div>
                  </div>
                  <div className="modal-field">
                    <Label className="modal-label">Period End</Label>
                    <div className="modal-input-wrap">
                      <Calendar className="modal-input-icon" />
                      <Input
                        type="date"
                        value={form.periodEnd}
                        onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
                        className="modal-input-with-icon"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="modal-footer">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                <X className="mr-1.5 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={generating} className="modal-save-btn">
                <Save className="mr-1.5 h-4 w-4" />
                {generating ? "Generating..." : "Generate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
