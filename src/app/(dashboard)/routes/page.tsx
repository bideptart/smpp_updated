"use client";

import { Fragment, Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import * as XLSX from "xlsx";
import TopBar from "@/components/layout/TopBar";
import PageBreadcrumb from "@/components/layout/PageBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Plus, Pencil, Trash2, Route as RouteIcon, Users, Globe, Hash, Save, X, CheckCircle2, AlertTriangle, Upload, Download, Search, Copy, ChevronRight, Layers } from "lucide-react";
import { countries } from "@/lib/countries";
import { getCurrencySymbol } from "@/lib/currencies";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Route {
  id: number;
  name: string;
  customerId: number;
  customerName: string;
  customerCurrency?: string;
  vendorId: number;
  vendorName: string;
  vendorCurrency?: string;
  vendorOnline?: boolean;
  jasminSynced?: boolean;
  countryCode: string;
  numberPrefix: string;
  operatorName: string | null;
  batchId?: string | null;
  sellingRate: number;
  buyingRate: number;
  margin: number;
  priority: number;
  weight: number;
  isActive: boolean;
}

interface Company {
  id: number;
  name: string;
  type: string;
  currency?: string;
}

interface Allocation {
  routeId?: number;
  vendorId: string;
  sellingRate: string;
  buyingRate: string;
  weight: string;
}

const PAGE_SIZE = 20;
const GROUP_PAGE_SIZE = 10;

const emptyLaneForm = {
  customerId: "",
  countryCode: "91",
  numberPrefix: "",
  operatorName: "",
  priority: "1",
  isActive: true,
};

function emptyAllocation(weight = "100"): Allocation {
  return { vendorId: "", sellingRate: "0", buyingRate: "0", weight };
}

function laneKey(r: { customerId: number; countryCode: string; numberPrefix: string; operatorName: string | null }) {
  return `${r.customerId}|${r.countryCode}|${r.numberPrefix}|${r.operatorName || ""}`;
}

export default function RoutesPage() {
  return (
    <Suspense fallback={null}>
      <RoutesPageInner />
    </Suspense>
  );
}

function RoutesPageInner() {
  const searchParams = useSearchParams();
  const { data: routesData, mutate } = useSWR("/api/routes", fetcher, { refreshInterval: 15000 });
  const { data: companiesData } = useSWR("/api/companies", fetcher);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [laneForm, setLaneForm] = useState(emptyLaneForm);
  const [allocations, setAllocations] = useState<Allocation[]>([emptyAllocation()]);

  // Coming from "Create Customer" with a prompt to set up their first route
  useEffect(() => {
    const customerId = searchParams.get("customerId");
    if (customerId) {
      setLaneForm({ ...emptyLaneForm, customerId });
      setAllocations([emptyAllocation()]);
      setDialogOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneForm, setCloneForm] = useState({ sourceCustomerId: "", targetCustomerId: "" });
  const [cloning, setCloning] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    updated: number;
    failed: number;
    errors: { row: number; reason: string }[];
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});

  function toggleGroupExpanded(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderRouteRow(r: Route, indented?: boolean) {
    return (
      <TableRow key={r.id} className={indented ? "bg-muted/40" : undefined}>
        <TableCell className={`font-medium ${indented ? "pl-8 text-foreground" : ""}`}>{r.name}</TableCell>
        <TableCell>{r.customerName}</TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span>{r.vendorName}</span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${r.vendorOnline ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${r.vendorOnline ? "bg-emerald-500" : "bg-red-500"}`} />
              {r.vendorOnline ? "Online" : "Offline"}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${r.jasminSynced ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}
              title={r.jasminSynced ? "This vendor has a dedicated Jasmin route" : "Not routed in Jasmin — falls through to DefaultRoute (see Gateway page)"}
            >
              {r.jasminSynced ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
              {r.jasminSynced ? "Routed" : "Not routed"}
            </span>
          </div>
        </TableCell>
        <TableCell>{r.countryCode}</TableCell>
        <TableCell>{r.numberPrefix || "-"}</TableCell>
        <TableCell>{r.operatorName || "-"}</TableCell>
        <TableCell className="text-right tabular-nums">
          {getCurrencySymbol(r.customerCurrency)}
          {r.sellingRate.toFixed(4)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {getCurrencySymbol(r.vendorCurrency)}
          {r.buyingRate.toFixed(4)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {r.customerCurrency && r.vendorCurrency && r.customerCurrency !== r.vendorCurrency ? (
            <span
              className="text-amber-600 text-[11px] font-medium"
              title="Selling and buying are in different currencies — this margin is not currency-converted"
            >
              mixed currency
            </span>
          ) : (
            <span className={r.margin > 0 ? "text-emerald-600" : r.margin < 0 ? "text-red-600" : ""}>
              {getCurrencySymbol(r.customerCurrency)}
              {r.margin.toFixed(4)}
            </span>
          )}
        </TableCell>
        <TableCell className="text-center">{r.priority}</TableCell>
        <TableCell className="text-center">{r.weight}%</TableCell>
        <TableCell className="text-center">
          <Badge variant={r.isActive ? "default" : "secondary"}>{r.isActive ? "Active" : "Inactive"}</Badge>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-500 hover:text-red-700"
              onClick={() => setDeleteId(r.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  // A group is a "lane" — one customer + country + prefix + operator,
  // possibly split across several vendors. A lane with one vendor renders
  // as a plain row; a lane with more than one shows the split as a
  // collapsible summary, since that's the shape a real wholesale route
  // actually has (one destination, N vendors sharing it by weight%).
  function renderRouteGroup(group: { key: string; routes: Route[] }) {
    if (group.routes.length === 1) return renderRouteRow(group.routes[0]);

    const isExpanded = expandedGroups.has(group.key);
    const first = group.routes[0];
    const fmtRange = (vals: number[], symbol: string) => {
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      return min === max ? `${symbol}${min.toFixed(4)}` : `${symbol}${min.toFixed(4)}–${symbol}${max.toFixed(4)}`;
    };
    const groupMixedCurrency = !!(
      first.customerCurrency && group.routes.some((r) => r.vendorCurrency && r.vendorCurrency !== first.customerCurrency)
    );
    const allActive = group.routes.every((r) => r.isActive);
    const allSamePriority = group.routes.every((r) => r.priority === first.priority);
    const totalWeight = group.routes.reduce((sum, r) => sum + r.weight, 0);
    const anyOnline = group.routes.some((r) => r.vendorOnline);

    return (
      <Fragment key={group.key}>
        <TableRow
          className="bg-muted/70 hover:bg-muted/70 cursor-pointer"
          onClick={() => toggleGroupExpanded(group.key)}
        >
          <TableCell className="font-medium">
            <div className="flex items-center gap-1.5">
              <ChevronRight
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
              />
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              Multi-vendor split
            </div>
          </TableCell>
          <TableCell>{first.customerName}</TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <span>{group.routes.length} vendors</span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${anyOnline ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${anyOnline ? "bg-emerald-500" : "bg-red-500"}`} />
                {anyOnline ? "Online" : "Offline"}
              </span>
            </div>
          </TableCell>
          <TableCell>{first.countryCode}</TableCell>
          <TableCell>{first.numberPrefix || "-"}</TableCell>
          <TableCell>{first.operatorName || "-"}</TableCell>
          <TableCell className="text-right tabular-nums text-foreground">
            {fmtRange(
              group.routes.map((r) => r.sellingRate),
              getCurrencySymbol(first.customerCurrency)
            )}
          </TableCell>
          <TableCell className="text-right tabular-nums text-foreground">
            {fmtRange(group.routes.map((r) => r.buyingRate), "")}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {groupMixedCurrency ? (
              <span className="text-amber-600 text-[11px] font-medium">mixed currency</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </TableCell>
          <TableCell className="text-center">{allSamePriority ? first.priority : "—"}</TableCell>
          <TableCell className="text-center">
            <span className={totalWeight === 100 ? "text-foreground" : "text-amber-600 font-semibold"}>
              {totalWeight}%
            </span>
          </TableCell>
          <TableCell className="text-center">
            <Badge variant={allActive ? "default" : "secondary"}>{allActive ? "Active" : "Mixed"}</Badge>
          </TableCell>
          <TableCell className="text-right text-xs text-muted-foreground">{isExpanded ? "Collapse" : "Expand"}</TableCell>
        </TableRow>
        {isExpanded &&
          (() => {
            const gTotalPages = Math.max(1, Math.ceil(group.routes.length / GROUP_PAGE_SIZE));
            const gPage = Math.min(groupPages[group.key] || 1, gTotalPages);
            const start = (gPage - 1) * GROUP_PAGE_SIZE;
            const pageRoutes = group.routes.slice(start, start + GROUP_PAGE_SIZE);
            return (
              <>
                {pageRoutes.map((r) => renderRouteRow(r, true))}
                {group.routes.length > GROUP_PAGE_SIZE && (
                  <TableRow className="bg-muted/40">
                    <TableCell colSpan={13} className="py-1.5">
                      <div className="flex items-center justify-between pl-8 text-xs text-muted-foreground">
                        <span>
                          Showing {start + 1}–{Math.min(start + GROUP_PAGE_SIZE, group.routes.length)} of{" "}
                          {group.routes.length} vendors
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={gPage <= 1}
                            onClick={() => setGroupPages((prev) => ({ ...prev, [group.key]: gPage - 1 }))}
                            className="px-2 py-0.5 rounded border border-border disabled:opacity-40 hover:bg-card"
                          >
                            Prev
                          </button>
                          <span>
                            Page {gPage} of {gTotalPages}
                          </span>
                          <button
                            type="button"
                            disabled={gPage >= gTotalPages}
                            onClick={() => setGroupPages((prev) => ({ ...prev, [group.key]: gPage + 1 }))}
                            className="px-2 py-0.5 rounded border border-border disabled:opacity-40 hover:bg-card"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })()}
      </Fragment>
    );
  }

  const routes: Route[] = routesData?.data || [];
  const companies: Company[] = companiesData?.data || [];
  const customers = companies.filter((c) => c.type === "customer");
  const vendors = companies.filter((c) => c.type === "vendor");
  const customerCurrency = customers.find((c) => String(c.id) === laneForm.customerId)?.currency || "INR";
  const sellSymbol = getCurrencySymbol(customerCurrency);

  const filteredRoutes = search.trim()
    ? routes.filter((r) => {
        const q = search.trim().toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.vendorName.toLowerCase().includes(q) ||
          r.countryCode.toLowerCase().includes(q) ||
          (r.operatorName || "").toLowerCase().includes(q)
        );
      })
    : routes;

  // Group by lane (customer + country + prefix + operator) — the real
  // business unit of a wholesale route: one destination, one or more
  // vendors sharing it by weight%. A lane with a single vendor is just a
  // group of one and renders as a plain row.
  const routeGroups: { key: string; routes: Route[] }[] = [];
  {
    const byKey = new Map<string, Route[]>();
    for (const r of filteredRoutes) {
      const key = laneKey(r);
      if (!byKey.has(key)) {
        byKey.set(key, []);
        routeGroups.push({ key, routes: byKey.get(key)! });
      }
      byKey.get(key)!.push(r);
    }
  }

  const totalPages = Math.max(1, Math.ceil(routeGroups.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedGroups = routeGroups.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalWeight = allocations.reduce((sum, a) => sum + (parseInt(a.weight, 10) || 0), 0);

  function openAdd() {
    setEditId(null);
    setLaneForm(emptyLaneForm);
    setAllocations([emptyAllocation()]);
    setDialogOpen(true);
  }

  function openImport() {
    setImportResult(null);
    setImportDialogOpen(true);
  }

  // Editing any one vendor in a lane opens the whole lane — every vendor
  // currently serving that customer+country together, so an admin adjusts
  // the full split in one place instead of one row at a time.
  function openEdit(r: Route) {
    const key = laneKey(r);
    const siblings = routes.filter((x) => laneKey(x) === key);
    setEditId(r.id);
    setLaneForm({
      customerId: String(r.customerId),
      countryCode: r.countryCode,
      numberPrefix: r.numberPrefix,
      operatorName: r.operatorName || "",
      priority: String(r.priority),
      isActive: siblings.every((s) => s.isActive),
    });
    setAllocations(
      siblings.map((s) => ({
        routeId: s.id,
        vendorId: String(s.vendorId),
        sellingRate: String(s.sellingRate),
        buyingRate: String(s.buyingRate),
        weight: String(s.weight),
      }))
    );
    setDialogOpen(true);
  }

  function updateAllocation(idx: number, field: keyof Allocation, value: string) {
    setAllocations((prev) => prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  }

  function addAllocation() {
    setAllocations((prev) => [...prev, emptyAllocation("0")]);
  }

  function removeAllocation(idx: number) {
    setAllocations((prev) => prev.filter((_, i) => i !== idx));
  }

  function vendorCurrencyFor(vendorId: string) {
    return vendors.find((v) => String(v.id) === vendorId)?.currency || "INR";
  }

  async function handleSave() {
    if (!laneForm.customerId || !laneForm.countryCode) {
      toast.error("Select a customer and country");
      return;
    }
    if (allocations.some((a) => !a.vendorId)) {
      toast.error("Select a vendor for every allocation row");
      return;
    }
    if (totalWeight !== 100) {
      toast.error(`Vendor allocation must total 100% — currently ${totalWeight}%`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/routes/lane", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: parseInt(laneForm.customerId, 10),
          countryCode: laneForm.countryCode,
          numberPrefix: laneForm.numberPrefix || laneForm.countryCode,
          operatorName: laneForm.operatorName || null,
          priority: parseInt(laneForm.priority, 10) || 1,
          isActive: laneForm.isActive,
          allocations: allocations.map((a) => ({
            routeId: a.routeId,
            vendorId: parseInt(a.vendorId, 10),
            sellingRate: parseFloat(a.sellingRate) || 0,
            buyingRate: parseFloat(a.buyingRate) || 0,
            weight: parseInt(a.weight, 10) || 0,
          })),
        }),
      });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.error || "Failed to save route");
        return;
      }
      toast.success(editId ? "Route updated" : "Route created");
      setDialogOpen(false);
      mutate();
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleteId === null) return;
    try {
      const res = await fetch(`/api/routes/${deleteId}`, { method: "DELETE" });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.error || "Failed to delete");
        return;
      }
      toast.success("Route deleted");
      mutate();
    } catch {
      toast.error("An error occurred");
    } finally {
      setDeleteId(null);
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
      if (rows.length === 0) {
        toast.error("No rows found in file");
        return;
      }

      const res = await fetch("/api/routes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.error || "Import failed");
        return;
      }

      setImportResult(result.data);
      mutate();
    } catch {
      toast.error("Could not read file. Use .xlsx, .xls or .csv");
    } finally {
      setImporting(false);
    }
  }

  async function handleClone() {
    if (!cloneForm.sourceCustomerId || !cloneForm.targetCustomerId) {
      toast.error("Select both a source and target customer");
      return;
    }
    setCloning(true);
    try {
      const res = await fetch("/api/routes/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceCustomerId: parseInt(cloneForm.sourceCustomerId, 10),
          targetCustomerId: parseInt(cloneForm.targetCustomerId, 10),
        }),
      });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.error || "Failed to clone routes");
        return;
      }
      const { cloned, skipped } = result.data;
      toast.success(`${cloned} route(s) cloned${skipped ? `, ${skipped} already existed` : ""}`);
      setCloneDialogOpen(false);
      setCloneForm({ sourceCustomerId: "", targetCustomerId: "" });
      mutate();
    } catch {
      toast.error("An error occurred");
    } finally {
      setCloning(false);
    }
  }

  const templateUrl =
    "data:text/csv;charset=utf-8," +
    encodeURIComponent(
      "customerName,vendorName,countryCode,numberPrefix,operatorName,sellingRate,buyingRate,priority,weight\n" +
        "Acme Corp,Acepeak,91,,,0.40,0.35,1,100\n" +
        "Acme Corp,Acepeak,91,98765,Airtel,0.42,0.37,1,100\n"
    );

  return (
    <>
      <TopBar title="Routes Management" />
      <div className="page-content">
        <PageBreadcrumb crumbs={[{ label: "Routes" }]} />
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            Routes ({routes.length})
          </h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={openImport}>
              <Upload className="mr-1.5 h-4 w-4" />
              Import Rate Sheet
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCloneDialogOpen(true)}>
              <Copy className="mr-1.5 h-4 w-4" />
              Clone Rates
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Route
            </Button>
          </div>
        </div>

        <div className="modal-input-wrap" style={{ maxWidth: 360 }}>
          <Search className="modal-input-icon" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by customer, vendor, country, or operator…"
            className="modal-input-with-icon"
          />
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead className="text-right">Selling Rate</TableHead>
                <TableHead className="text-right">Buying Rate</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-center">Priority</TableHead>
                <TableHead className="text-center">Weight %</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routeGroups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-muted-foreground">
                    {routes.length === 0 ? "No routes configured" : "No routes match your search"}
                  </TableCell>
                </TableRow>
              )}
              {pagedGroups.map(renderRouteGroup)}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t text-xs text-muted-foreground">
              <span>
                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, routeGroups.length)} of{" "}
                {routeGroups.length} entries
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                  className="px-2.5 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted"
                >
                  Prev
                </button>
                <span>
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                  className="px-2.5 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Add / Edit Route — one flow: customer, country, then a vendor
            allocation table whose weight% must total 100 before it can be
            saved. A single vendor is just one row at 100%; a split is two
            or more rows. No separate "bulk" or "multi-country" mode. */}
        {dialogOpen && <div onClick={() => setDialogOpen(false)} className="dash-filter-overlay" />}
        <aside className={`dash-filter-panel dash-filter-panel--wide ${dialogOpen ? "" : "dash-filter-panel--closed"}`}>
          <div className="dash-filter-panel-header">
            <div className="dash-filter-panel-title">
              <RouteIcon className="h-4 w-4" />
              {editId ? "Edit Route" : "Add Route"}
            </div>
            <button onClick={() => setDialogOpen(false)} className="dash-filter-panel-close">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="dash-filter-panel-body">
              <p className="modal-subtitle" style={{ marginTop: -8, marginBottom: 16 }}>
                Which customer, for which country, to which vendor(s) — and their rates
              </p>
              <div className="modal-section">
                <div className="modal-section-title">
                  <span className="modal-section-num">1</span>
                  Customer &amp; Destination
                </div>
                <div className="modal-grid modal-grid--3col">
                  <div className="modal-field">
                    <Label className="modal-label">Customer *</Label>
                    <Select
                      value={laneForm.customerId}
                      onValueChange={(v) => v && setLaneForm({ ...laneForm, customerId: v })}
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
                  <div className="modal-field">
                    <Label className="modal-label">Country *</Label>
                    <Select
                      value={countries.find((c) => c.dialCode.replace("+", "") === laneForm.countryCode)?.code || ""}
                      onValueChange={(iso) => {
                        const country = countries.find((c) => c.code === iso);
                        if (!country) return;
                        const dial = country.dialCode.replace("+", "");
                        setLaneForm({ ...laneForm, countryCode: dial, numberPrefix: dial });
                      }}
                    >
                      <SelectTrigger className="modal-select-trigger">
                        <Globe className="modal-select-icon" />
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {countries.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.flag} {c.name} ({c.dialCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="modal-field">
                    <Label className="modal-label">Number Prefix</Label>
                    <div className="modal-input-wrap">
                      <Hash className="modal-input-icon" />
                      <Input
                        value={laneForm.numberPrefix}
                        onChange={(e) => setLaneForm({ ...laneForm, numberPrefix: e.target.value })}
                        placeholder="e.g. 98"
                        className="modal-input-with-icon"
                      />
                    </div>
                    <span className="modal-hint">Empty = match all of this country</span>
                  </div>
                </div>
                <div className="modal-grid">
                  <div className="modal-field">
                    <Label className="modal-label">Operator</Label>
                    <Input
                      value={laneForm.operatorName}
                      onChange={(e) => setLaneForm({ ...laneForm, operatorName: e.target.value })}
                      placeholder="e.g. Airtel — leave blank for country-wide"
                    />
                  </div>
                  <div className="modal-field">
                    <Label className="modal-label">Priority</Label>
                    <Input
                      type="number"
                      min="1"
                      value={laneForm.priority}
                      onChange={(e) => setLaneForm({ ...laneForm, priority: e.target.value })}
                    />
                    <span className="modal-hint">Lower = tried first, before falling back to any other priority tier for this lane</span>
                  </div>
                </div>
              </div>

              <div className="modal-section">
                <div className="modal-section-title" style={{ justifyContent: "space-between" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="modal-section-num">2</span>
                    Vendor Allocation
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      totalWeight === 100 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    Total {totalWeight}%
                  </span>
                </div>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left font-medium text-foreground px-2 py-1.5">Vendor</th>
                        <th className="text-right font-medium text-foreground px-2 py-1.5">Selling ({sellSymbol})</th>
                        <th className="text-right font-medium text-foreground px-2 py-1.5">Buying</th>
                        <th className="text-right font-medium text-foreground px-2 py-1.5">Weight %</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map((a, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-2 py-1.5">
                            <Select value={a.vendorId} onValueChange={(v) => v && updateAllocation(idx, "vendorId", v)}>
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select vendor" />
                              </SelectTrigger>
                              <SelectContent alignItemWithTrigger={false}>
                                {vendors.map((v) => (
                                  <SelectItem key={v.id} value={String(v.id)}>
                                    {v.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              step="0.0001"
                              className="h-8 text-right"
                              value={a.sellingRate}
                              onChange={(e) => updateAllocation(idx, "sellingRate", e.target.value)}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {getCurrencySymbol(vendorCurrencyFor(a.vendorId))}
                              </span>
                              <Input
                                type="number"
                                step="0.0001"
                                className="h-8 text-right"
                                value={a.buyingRate}
                                onChange={(e) => updateAllocation(idx, "buyingRate", e.target.value)}
                              />
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              className="h-8 text-right"
                              value={a.weight}
                              onChange={(e) => updateAllocation(idx, "weight", e.target.value)}
                            />
                          </td>
                          <td className="px-1 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={allocations.length === 1}
                              onClick={() => removeAllocation(idx)}
                            >
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button variant="outline" size="sm" onClick={addAllocation} style={{ marginTop: 8 }}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Vendor
                </Button>
                {totalWeight !== 100 && (
                  <div className="text-xs text-red-600 mt-1.5 font-medium">
                    Vendor allocation must total exactly 100% before this can be saved.
                  </div>
                )}
                {allocations.length > 1 && (
                  <span className="modal-hint" style={{ display: "block", marginTop: 6 }}>
                    Real traffic to this destination splits across these vendors by weight% (e.g. 80 + 20)
                  </span>
                )}
              </div>

              <div className="modal-section">
                <div className="modal-toggle-row">
                  <div>
                    <Label className="modal-label">Active</Label>
                    <span className="modal-hint">Inactive routes are not used for auto-selection</span>
                  </div>
                  <Switch
                    checked={laneForm.isActive}
                    onCheckedChange={(checked) => setLaneForm({ ...laneForm, isActive: !!checked })}
                  />
                </div>
              </div>
          </div>
          <div className="dash-filter-panel-footer">
            <Button variant="outline" onClick={() => setDialogOpen(false)} style={{ flex: 1 }}>
              <X className="mr-1.5 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || totalWeight !== 100} className="modal-save-btn" style={{ flex: 1 }}>
              <Save className="mr-1.5 h-4 w-4" />
              {saving ? "Saving..." : editId ? "Update Route" : "Create Route"}
            </Button>
          </div>
        </aside>

        {/* Import Rate Sheet — a separate, single-purpose tool for loading
            many customer/vendor/country rows from a CSV at once. Not a mode
            inside the Add Route dialog. */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent className="modal-card sm:max-w-2xl">
            <DialogHeader className="modal-header">
              <div className="modal-header-icon">
                <Upload className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="modal-title">Import Rate Sheet</DialogTitle>
                <p className="modal-subtitle">Customer, vendor, country, and rates all come from the sheet</p>
              </div>
            </DialogHeader>
            <div className="modal-body">
              <div className="modal-section">
                <div
                  onClick={() => importInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleImportFile(f);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
                    dragOver ? "border-blue-400 bg-blue-50" : "border-border bg-muted hover:border-border hover:bg-muted/60"
                  }`}
                >
                  <div className={`rounded-full p-3 ${dragOver ? "bg-blue-100" : "bg-card"} shadow-sm`}>
                    <Upload className={`h-6 w-6 ${dragOver ? "text-blue-500" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {importing ? "Importing…" : "Click to upload, or drag a file here"}
                  </div>
                  <div className="text-xs text-muted-foreground text-center max-w-sm">
                    .csv, .xlsx, or .xls — one row per customer + vendor + country, with selling and
                    buying rate columns
                  </div>
                </div>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                    e.currentTarget.value = "";
                  }}
                />
                <div className="flex items-center justify-between mt-3">
                  <a
                    href={templateUrl}
                    download="routes-template.csv"
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                  >
                    <Download className="h-3 w-3" />
                    Download template
                  </a>
                  {importResult && (
                    <button
                      type="button"
                      onClick={() => setImportResult(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear result
                    </button>
                  )}
                </div>

                {importResult && (
                  <div
                    className={`mt-3 rounded-lg border p-3 text-sm ${
                      importResult.failed > 0
                        ? "border-amber-200 bg-amber-50"
                        : "border-emerald-200 bg-emerald-50"
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      {importResult.failed > 0 ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      )}
                      {importResult.imported} created, {importResult.updated} updated
                      {importResult.failed > 0 ? `, ${importResult.failed} failed` : ""}
                    </div>
                    {importResult.errors?.length > 0 && (
                      <ul className="mt-1.5 list-disc list-inside text-xs text-amber-700 space-y-0.5">
                        {importResult.errors.slice(0, 5).map((e, i) => (
                          <li key={i}>
                            Row {e.row}: {e.reason}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="modal-footer">
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                <X className="mr-1.5 h-4 w-4" />
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete route</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this route? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
          <DialogContent className="sm:max-w-md modal-card">
            <DialogHeader className="modal-header">
              <div className="modal-header-icon">
                <Copy className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="modal-title">Clone Rate Card</DialogTitle>
                <p className="modal-subtitle">Copy a customer&apos;s full country/operator rate card to another</p>
              </div>
            </DialogHeader>
            <div className="modal-body">
              <div className="modal-section">
                <div className="modal-field modal-field--full">
                  <Label className="modal-label">From Customer</Label>
                  <Select
                    value={cloneForm.sourceCustomerId}
                    onValueChange={(v) => v && setCloneForm((f) => ({ ...f, sourceCustomerId: v }))}
                  >
                    <SelectTrigger className="modal-select-trigger">
                      <Users className="modal-select-icon" />
                      <SelectValue placeholder="Select source customer" />
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
                <div className="modal-field modal-field--full">
                  <Label className="modal-label">To Customer</Label>
                  <Select
                    value={cloneForm.targetCustomerId}
                    onValueChange={(v) => v && setCloneForm((f) => ({ ...f, targetCustomerId: v }))}
                  >
                    <SelectTrigger className="modal-select-trigger">
                      <Users className="modal-select-icon" />
                      <SelectValue placeholder="Select target customer" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {customers
                        .filter((c) => String(c.id) !== cloneForm.sourceCustomerId)
                        .map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <span className="modal-hint">Routes the target already has for the same vendor/country/operator are skipped, not duplicated</span>
                </div>
              </div>
            </div>
            <DialogFooter className="modal-footer">
              <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>
                <X className="mr-1.5 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleClone} disabled={cloning} className="modal-save-btn">
                <Copy className="mr-1.5 h-4 w-4" />
                {cloning ? "Cloning..." : "Clone Rates"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
