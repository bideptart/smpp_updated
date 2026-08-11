"use client";

import { useState } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import PageBreadcrumb from "@/components/layout/PageBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Plus,
  Pencil,
  Trash2,
  Server,
  Globe2,
  Hash,
  User,
  Lock,
  Play,
  Square,
  Save,
  X,
  Inbox,
  Filter,
  Activity,
  GitBranch,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface JasminConnector {
  cid: string;
  service: string;
  session: string;
  starts: number;
  stops: number;
}

interface JasminConnectorStatus extends JasminConnector {
  submitted: number;
  delivered: number;
  boundAt: string | null;
  lastActivityAt: string | null;
}

interface JasminRoute {
  order: number;
  type: string;
  rate: string;
  connectorIds: string;
  filters: string;
}

// cids that already have a dedicated TagFilter + MT route (set up via
// syncVendorRouting()) — without one, a connector's traffic only reaches it
// through the catch-all DefaultRoute, not the app's own per-vendor selection.
function syncedCidsFromRoutes(routes: JasminRoute[]): Set<string> {
  const cids = new Set<string>();
  for (const r of routes) {
    if (r.order === 0) continue;
    const match = r.filters.match(/tag=([^)]+)\)/i);
    if (match) cids.add(match[1].toLowerCase());
  }
  return cids;
}

// Jasmin's HTTP API `tags` param (which reuses the connector cid) only accepts this charset —
// anything else silently breaks every send routed through the connector.
const CID_PATTERN = /^[a-zA-Z0-9-]+$/;
const CID_ERROR_MESSAGE = "Only letters, numbers, and hyphens are allowed — Jasmin rejects any other character when routing sends by this ID.";

const emptyConnectorForm = {
  cid: "",
  host: "",
  port: "2775",
  username: "",
  password: "",
  bind: "transceiver",
};

const NOT_AVAILABLE = [
  { name: "Inbound / two-way SMS (MO)", reason: "No database model yet for received messages or number-to-customer mapping." },
  { name: "Content / keyword filters", reason: "Jasmin supports these natively, but nothing in this app configures them yet." },
  { name: "Multi-vendor failover", reason: "Only one vendor connector exists — failover has nothing to fail over to until a second one is added." },
];

const METRIC_LABELS: Record<string, string> = {
  httpapi_request_count: "HTTP Requests",
  httpapi_auth_error_count: "Auth Errors",
  httpapi_route_error_count: "Routing Errors",
  httpapi_throughput_error_count: "Throughput Errors",
  httpapi_charging_error_count: "Charging Errors",
  httpapi_interceptor_error_count: "Interceptor Errors",
};

export default function GatewayPage() {
  const { data: statusData, mutate: mutateStatus } = useSWR("/api/settings/jasmin/status", fetcher, { refreshInterval: 10000 });
  const { data: routesData, mutate: mutateRoutes } = useSWR("/api/settings/jasmin/routes", fetcher, { refreshInterval: 15000 });
  const { data: metricsData } = useSWR("/api/settings/jasmin/metrics", fetcher, { refreshInterval: 10000 });
  const metrics: Record<string, number> = metricsData?.data || {};

  const connectors: JasminConnectorStatus[] = statusData?.data || [];
  const routes: JasminRoute[] = routesData?.data || [];
  const syncedCids = syncedCidsFromRoutes(routes);

  const [syncing, setSyncing] = useState(false);

  const [connDialogOpen, setConnDialogOpen] = useState(false);
  const [editCid, setEditCid] = useState<string | null>(null);
  const [connForm, setConnForm] = useState(emptyConnectorForm);
  const [connSaving, setConnSaving] = useState(false);
  const [deleteCid, setDeleteCid] = useState<string | null>(null);
  const [busyCid, setBusyCid] = useState<string | null>(null);

  // Only applies when creating a new connector — cid is immutable once created (see editCid disabled state below).
  const cidError = !editCid && connForm.cid && !CID_PATTERN.test(connForm.cid) ? CID_ERROR_MESSAGE : null;

  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [routeForm, setRouteForm] = useState({ cid: "", rate: "0.0" });
  const [routeSaving, setRouteSaving] = useState(false);
  const [deleteOrder, setDeleteOrder] = useState<number | null>(null);

  function openAddConnector() {
    setEditCid(null);
    setConnForm(emptyConnectorForm);
    setConnDialogOpen(true);
  }

  function openEditConnector(c: JasminConnector) {
    setEditCid(c.cid);
    setConnForm({ ...emptyConnectorForm, cid: c.cid });
    setConnDialogOpen(true);
  }

  async function handleSaveConnector() {
    setConnSaving(true);
    try {
      const url = editCid ? `/api/settings/jasmin/connectors/${editCid}` : "/api/settings/jasmin/connectors";
      const method = editCid ? "PUT" : "POST";
      const body = editCid
        ? { host: connForm.host, port: connForm.port, username: connForm.username, password: connForm.password, bind: connForm.bind }
        : connForm;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.error || "Failed to save connector");
        return;
      }
      toast.success(editCid ? "Connector updated" : "Connector created");
      setConnDialogOpen(false);
      mutateStatus();
    } catch {
      toast.error("An error occurred");
    } finally {
      setConnSaving(false);
    }
  }

  async function handleDeleteConnector() {
    if (!deleteCid) return;
    try {
      const res = await fetch(`/api/settings/jasmin/connectors/${deleteCid}`, { method: "DELETE" });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.error || "Failed to delete connector");
        return;
      }
      toast.success("Connector removed");
      mutateStatus();
    } catch {
      toast.error("An error occurred");
    } finally {
      setDeleteCid(null);
    }
  }

  async function toggleConnector(cid: string, action: "start" | "stop") {
    setBusyCid(cid);
    try {
      const res = await fetch(`/api/settings/jasmin/connectors/${cid}/${action}`, { method: "POST" });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.error || `Failed to ${action} connector`);
        return;
      }
      toast.success(`Connector ${action === "start" ? "started" : "stopped"}`);
      mutateStatus();
    } catch {
      toast.error("An error occurred");
    } finally {
      setBusyCid(null);
    }
  }

  async function handleSaveRoute() {
    setRouteSaving(true);
    try {
      const res = await fetch("/api/settings/jasmin/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(routeForm),
      });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.error || "Failed to save route");
        return;
      }
      toast.success("Route created");
      setRouteDialogOpen(false);
      setRouteForm({ cid: "", rate: "0.0" });
      mutateRoutes();
    } catch {
      toast.error("An error occurred");
    } finally {
      setRouteSaving(false);
    }
  }

  async function handleDeleteRoute() {
    if (deleteOrder === null) return;
    try {
      const res = await fetch(`/api/settings/jasmin/routes/${deleteOrder}`, { method: "DELETE" });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.error || "Failed to delete route");
        return;
      }
      toast.success("Route removed");
      mutateRoutes();
    } catch {
      toast.error("An error occurred");
    } finally {
      setDeleteOrder(null);
    }
  }

  async function handleSyncRouting() {
    setSyncing(true);
    try {
      const res = await fetch("/api/settings/jasmin/sync-routing", { method: "POST" });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.error || "Failed to sync vendor routing");
        return;
      }
      const { added, alreadySynced, failed } = result.data;
      if (failed.length > 0) {
        toast.error(`Sync failed for: ${failed.join(", ")}`);
      } else if (added.length > 0) {
        toast.success(`Added routing for: ${added.join(", ")}${alreadySynced.length ? ` (${alreadySynced.length} already synced)` : ""}`);
      } else {
        toast.success("All vendor connectors already synced");
      }
      mutateRoutes();
    } catch {
      toast.error("An error occurred");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <TopBar title="Gateway" />
      <div className="page-content">
        <PageBreadcrumb crumbs={[{ label: "Gateway" }]} />

        <div className="help-card">
          <div className="help-card-title">Jasmin SMS Gateway</div>
          <p className="help-card-text">
            This controls Jasmin&apos;s own connectors and routing rules — a separate system from your
            app&apos;s Connections/Routes pages. Jasmin now handles all outbound SMS delivery to the vendor.
          </p>
        </div>

        {/* Connector health */}
        <div className="section-block">
          <div className="section-header">
            <h3 className="section-title">
              <Activity className="h-4 w-4" />
              Connector Health
            </h3>
          </div>
          <div className="server-status-grid">
            {connectors.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-text">No Jasmin connectors configured</p>
              </div>
            )}
            {connectors.map((c) => (
              <div key={c.cid} className={`server-status-card ${c.session.includes("BOUND") ? "server-status-card--online" : "server-status-card--offline"}`}>
                <div className={`server-status-icon-wrap ${c.session.includes("BOUND") ? "" : "server-status-icon-wrap--amber"}`}>
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <p className="server-status-label">{c.cid}</p>
                  <p className="server-status-value">{c.service} · {c.session}</p>
                  <p className="server-status-hint">{c.submitted} sent · {c.delivered} delivered</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Connectors table */}
        <div className="section-block">
          <div className="flex items-center justify-between">
            <h3 className="section-title">
              <Server className="h-4 w-4" />
              Jasmin Connectors
            </h3>
            <Button size="sm" onClick={openAddConnector}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Connector
            </Button>
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Connector ID</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead className="text-center">Starts / Stops</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connectors.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No connectors configured
                    </TableCell>
                  </TableRow>
                )}
                {connectors.map((c) => (
                  <TableRow key={c.cid}>
                    <TableCell className="font-medium">{c.cid}</TableCell>
                    <TableCell>
                      <Badge variant={c.service === "started" ? "default" : "secondary"}>{c.service}</Badge>
                    </TableCell>
                    <TableCell>{c.session}</TableCell>
                    <TableCell className="text-center">{c.starts} / {c.stops}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {c.service === "started" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={busyCid === c.cid}
                            onClick={() => toggleConnector(c.cid, "stop")}
                            title="Stop"
                          >
                            <Square className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={busyCid === c.cid}
                            onClick={() => toggleConnector(c.cid, "start")}
                            title="Start"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEditConnector(c)}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-700"
                          onClick={() => setDeleteCid(c.cid)}
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Vendor routing sync */}
        <div className="section-block">
          <div className="flex items-center justify-between">
            <h3 className="section-title">
              <RefreshCw className="h-4 w-4" />
              Vendor Routing Sync
            </h3>
            <Button size="sm" variant="outline" onClick={handleSyncRouting} disabled={syncing}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Routing"}
            </Button>
          </div>
          <p style={{ fontSize: 12, color: "#64748b", margin: "-4px 0 4px" }}>
            Each connector needs a dedicated route so your app&apos;s own vendor selection (Routes page)
            actually reaches it — otherwise its traffic only falls through the catch-all DefaultRoute.
          </p>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Connector ID</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connectors.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No connectors configured
                    </TableCell>
                  </TableRow>
                )}
                {connectors.map((c) => {
                  const synced = syncedCids.has(c.cid.toLowerCase());
                  return (
                    <TableRow key={c.cid}>
                      <TableCell className="font-medium">{c.cid}</TableCell>
                      <TableCell>
                        {synced ? (
                          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Synced
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-700">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Not synced — falls through to DefaultRoute
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* MT Routes table */}
        <div className="section-block">
          <div className="flex items-center justify-between">
            <h3 className="section-title">
              <GitBranch className="h-4 w-4" />
              MT Routes
            </h3>
            <Button size="sm" onClick={() => setRouteDialogOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Route
            </Button>
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Order</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Connector(s)</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No MT routes configured
                    </TableCell>
                  </TableRow>
                )}
                {routes.map((r) => (
                  <TableRow key={r.order}>
                    <TableCell className="text-center">{r.order}</TableCell>
                    <TableCell>{r.type}</TableCell>
                    <TableCell>{r.connectorIds}</TableCell>
                    <TableCell className="text-right">{r.rate}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-700"
                        onClick={() => setDeleteOrder(r.order)}
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Gateway metrics */}
        <div className="section-block">
          <div className="section-header">
            <h3 className="section-title">
              <Activity className="h-4 w-4" />
              Gateway Metrics
            </h3>
          </div>
          <div className="server-status-grid">
            {Object.keys(METRIC_LABELS).length > 0 && Object.keys(metrics).length === 0 && (
              <div className="empty-state">
                <p className="empty-state-text">Loading Jasmin metrics…</p>
              </div>
            )}
            {Object.entries(METRIC_LABELS).map(([key, label]) => (
              <div key={key} className="server-status-card server-status-card--online">
                <div className="server-status-icon-wrap">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <p className="server-status-label">{label}</p>
                  <p className="server-status-value">{(metrics[key] ?? 0).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Not available yet */}
        <div className="section-block">
          <div className="section-header">
            <h3 className="section-title">
              <Inbox className="h-4 w-4" />
              Not Available Yet
            </h3>
          </div>
          <div className="rounded-lg border bg-card" style={{ padding: 4 }}>
            {NOT_AVAILABLE.map((item, i) => (
              <div
                key={item.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderBottom: i < NOT_AVAILABLE.length - 1 ? "1px solid #f1f5f9" : "none",
                }}
              >
                <Filter className="h-4 w-4" style={{ color: "#94a3b8", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{item.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add/Edit Connector */}
      <Dialog open={connDialogOpen} onOpenChange={setConnDialogOpen}>
        <DialogContent className="sm:max-w-lg modal-card">
          <DialogHeader className="modal-header">
            <div className="modal-header-icon">
              <Server className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="modal-title">{editCid ? "Edit Connector" : "Add Jasmin Connector"}</DialogTitle>
              <p className="modal-subtitle">A vendor SMPP bind managed by Jasmin, not your app&apos;s Connections table</p>
            </div>
          </DialogHeader>
          <div className="modal-body">
            <div className="modal-section">
              <div className="modal-field modal-field--full">
                <Label className="modal-label">Connector ID *</Label>
                <div className="modal-input-wrap">
                  <Hash className="modal-input-icon" />
                  <Input
                    value={connForm.cid}
                    onChange={(e) => setConnForm({ ...connForm, cid: e.target.value })}
                    placeholder="e.g. vendor2"
                    disabled={!!editCid}
                    className="modal-input-with-icon"
                    aria-invalid={!!cidError}
                  />
                </div>
                {cidError && <p className="text-xs text-red-600 mt-1">{cidError}</p>}
              </div>
              <div className="modal-grid">
                <div className="modal-field">
                  <Label className="modal-label">Host *</Label>
                  <div className="modal-input-wrap">
                    <Globe2 className="modal-input-icon" />
                    <Input
                      value={connForm.host}
                      onChange={(e) => setConnForm({ ...connForm, host: e.target.value })}
                      placeholder="smpp.vendor.com"
                      className="modal-input-with-icon"
                    />
                  </div>
                </div>
                <div className="modal-field">
                  <Label className="modal-label">Port *</Label>
                  <Input
                    value={connForm.port}
                    onChange={(e) => setConnForm({ ...connForm, port: e.target.value })}
                    placeholder="2775"
                  />
                </div>
              </div>
              <div className="modal-grid">
                <div className="modal-field">
                  <Label className="modal-label">Username *</Label>
                  <div className="modal-input-wrap">
                    <User className="modal-input-icon" />
                    <Input
                      value={connForm.username}
                      onChange={(e) => setConnForm({ ...connForm, username: e.target.value })}
                      className="modal-input-with-icon"
                    />
                  </div>
                </div>
                <div className="modal-field">
                  <Label className="modal-label">Password *</Label>
                  <div className="modal-input-wrap">
                    <Lock className="modal-input-icon" />
                    <Input
                      type="password"
                      value={connForm.password}
                      onChange={(e) => setConnForm({ ...connForm, password: e.target.value })}
                      placeholder={editCid ? "Leave blank to keep unchanged" : ""}
                      className="modal-input-with-icon"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-field">
                <Label className="modal-label">Bind Mode</Label>
                <Select
                  value={connForm.bind}
                  onValueChange={(v) => v && setConnForm({ ...connForm, bind: v })}
                >
                  <SelectTrigger className="modal-select-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectItem value="transceiver">Transceiver</SelectItem>
                    <SelectItem value="receiver">Receiver</SelectItem>
                    <SelectItem value="transmitter">Transmitter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="modal-footer">
            <Button variant="outline" onClick={() => setConnDialogOpen(false)}>
              <X className="mr-1.5 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleSaveConnector} disabled={connSaving || !!cidError || (!editCid && !connForm.cid)} className="modal-save-btn">
              <Save className="mr-1.5 h-4 w-4" />
              {connSaving ? "Saving..." : editCid ? "Update Connector" : "Create Connector"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete connector confirmation */}
      <Dialog open={deleteCid !== null} onOpenChange={(open) => { if (!open) setDeleteCid(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove connector</DialogTitle>
            <DialogDescription>
              This stops and permanently removes the &quot;{deleteCid}&quot; connector from Jasmin. Any MT routes
              pointing at it will stop working. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCid(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConnector}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Route */}
      <Dialog open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
        <DialogContent className="sm:max-w-sm modal-card">
          <DialogHeader className="modal-header">
            <div className="modal-header-icon">
              <GitBranch className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="modal-title">Add MT Route</DialogTitle>
              <p className="modal-subtitle">A default route sending all matching traffic to one connector</p>
            </div>
          </DialogHeader>
          <div className="modal-body">
            <div className="modal-section">
              <div className="modal-field modal-field--full">
                <Label className="modal-label">Connector *</Label>
                <Select
                  value={routeForm.cid}
                  onValueChange={(v) => v && setRouteForm({ ...routeForm, cid: v })}
                >
                  <SelectTrigger className="modal-select-trigger">
                    <SelectValue placeholder="Select connector" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {connectors.map((c) => (
                      <SelectItem key={c.cid} value={c.cid}>
                        {c.cid}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-field modal-field--full">
                <Label className="modal-label">Rate</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={routeForm.rate}
                  onChange={(e) => setRouteForm({ ...routeForm, rate: e.target.value })}
                />
                <span className="modal-hint">Jasmin-side rate — your app&apos;s own billing on Routes/Companies is unaffected</span>
              </div>
            </div>
          </div>
          <DialogFooter className="modal-footer">
            <Button variant="outline" onClick={() => setRouteDialogOpen(false)}>
              <X className="mr-1.5 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleSaveRoute} disabled={routeSaving || !routeForm.cid} className="modal-save-btn">
              <Save className="mr-1.5 h-4 w-4" />
              {routeSaving ? "Saving..." : "Create Route"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete route confirmation */}
      <Dialog open={deleteOrder !== null} onOpenChange={(open) => { if (!open) setDeleteOrder(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove route</DialogTitle>
            <DialogDescription>
              Traffic that matched this route will no longer be delivered via Jasmin unless another route
              matches. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOrder(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRoute}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
