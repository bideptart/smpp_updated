"use client";

import { useState } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import PageBreadcrumb from "@/components/layout/PageBreadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Cable, Server, Key, Link2, Save, X, Lock, Tag, Globe2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Connection {
  id: number;
  name: string;
  companyId: number;
  companyName: string;
  type: "SMPP" | "HTTP";
  direction: "MT" | "MO" | "BOTH";
  host: string | null;
  port: number | null;
  username: string | null;
  apiUrl: string | null;
  maxTps: number;
  transport: "JASMIN" | "DIRECT";
  status: "active" | "inactive" | "error";
  lastActivity: string | null;
}

interface Company {
  id: number;
  name: string;
  type: string;
}

const emptyForm = {
  companyId: "",
  name: "",
  type: "HTTP" as "SMPP" | "HTTP",
  direction: "MT" as "MT" | "MO" | "BOTH",
  host: "",
  port: "",
  username: "",
  password: "",
  apiUrl: "",
  apiKey: "",
  maxTps: "10",
  transport: "JASMIN" as "JASMIN" | "DIRECT",
  status: "active" as "active" | "inactive" | "error",
};

export default function ConnectionsPage() {
  const { data, mutate } = useSWR("/api/connections", fetcher);
  const { data: companiesData } = useSWR("/api/companies", fetcher);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const connections: Connection[] = data?.data || [];
  const vendors: Company[] = (companiesData?.data || []).filter(
    (c: Company) => c.type === "vendor"
  );

  function openCreate() {
    setEditId(null);
    setForm({ ...emptyForm });
    setOpen(true);
  }

  function openEdit(conn: Connection) {
    setEditId(conn.id);
    setForm({
      companyId: String(conn.companyId),
      name: conn.name,
      type: conn.type,
      direction: conn.direction,
      host: conn.host || "",
      port: conn.port ? String(conn.port) : "",
      username: conn.username || "",
      password: "",
      apiUrl: conn.apiUrl || "",
      apiKey: "",
      maxTps: String(conn.maxTps),
      transport: conn.transport || "JASMIN",
      status: conn.status,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.companyId || !form.type) {
      toast.error("Name, company, and type are required");
      return;
    }
    setSaving(true);
    try {
      const url = editId ? `/api/connections/${editId}` : "/api/connections";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: Number(form.companyId),
          name: form.name,
          type: form.type,
          direction: form.direction,
          host: form.host || null,
          port: form.port ? Number(form.port) : null,
          username: form.username || null,
          password: form.password || null,
          apiUrl: form.apiUrl || null,
          apiKey: form.apiKey || null,
          maxTps: Number(form.maxTps) || 10,
          transport: form.type === "SMPP" ? form.transport : "JASMIN",
          status: form.status,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(editId ? "Connection updated" : "Connection created");
        if (result.note) toast.warning(result.note);
        setOpen(false);
        mutate();
      } else {
        toast.error(result.error || "Save failed");
      }
    } catch {
      toast.error("Failed to save connection");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleteId === null) return;
    try {
      const res = await fetch(`/api/connections/${deleteId}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        toast.success("Connection deleted");
        mutate();
      } else {
        toast.error(result.error || "Delete failed");
      }
    } catch {
      toast.error("Failed to delete connection");
    } finally {
      setDeleteId(null);
    }
  }

  const typeBadge = (type: string) =>
    type === "SMPP" ? (
      <Badge className="bg-purple-100 text-purple-700 border-purple-200">
        SMPP
      </Badge>
    ) : (
      <Badge className="bg-blue-100 text-blue-700 border-blue-200">HTTP</Badge>
    );

  const transportBadge = (conn: Connection) => {
    if (conn.type !== "SMPP") return <span className="text-xs text-muted-foreground">—</span>;
    return conn.transport === "DIRECT" ? (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200">Direct</Badge>
    ) : (
      <Badge className="bg-muted text-foreground border-border">Jasmin</Badge>
    );
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: "bg-green-100 text-green-700 border-green-200",
      inactive: "bg-gray-100 text-muted-foreground border-border",
      error: "bg-red-100 text-red-700 border-red-200",
    };
    return (
      <Badge className={map[status] || map.inactive}>
        {status}
      </Badge>
    );
  };

  return (
    <>
      <TopBar title="Vendor Connections" />
      <div className="page-content">
        <PageBreadcrumb crumbs={[{ label: "Connections" }, { label: "Manage" }]} />
        <div className="page-header">
          <p className="page-subtitle">
            Manage SMPP and HTTP vendor connections
          </p>
          <Button onClick={openCreate} className="btn-primary-action">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Connection
          </Button>
        </div>

        {/* How-to help card */}
        <div className="help-card">
          <div className="help-card-title">How to add a new vendor</div>
          <ol className="help-card-steps">
            <li><strong>Add Company:</strong> Go to Companies → Add a vendor company</li>
            <li><strong>Add Connection:</strong> Click &quot;Add Connection&quot; above → Fill SMPP host, port, username, password from vendor</li>
            <li><strong>Create Route:</strong> Go to Routes → Map a customer to this vendor</li>
            <li><strong>Daemon auto-connects:</strong> Within 30 seconds, the new vendor connects automatically (no restart needed)</li>
            <li><strong>Verify:</strong> Check Vendor Live page → status should show &quot;Connected&quot;</li>
            <li><strong>Test:</strong> Send a test SMS from Send SMS page</li>
          </ol>
        </div>

        <div className="tt-container">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Max TPS</TableHead>
                <TableHead>Transport</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No connections found
                  </TableCell>
                </TableRow>
              )}
              {connections.map((conn) => (
                <TableRow key={conn.id}>
                  <TableCell className="font-medium">{conn.name}</TableCell>
                  <TableCell>{conn.companyName}</TableCell>
                  <TableCell>{typeBadge(conn.type)}</TableCell>
                  <TableCell>{conn.direction}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {conn.type === "SMPP"
                      ? conn.host && conn.port
                        ? `${conn.host}:${conn.port}`
                        : "-"
                      : conn.apiUrl || "-"}
                  </TableCell>
                  <TableCell>{conn.maxTps}</TableCell>
                  <TableCell>{transportBadge(conn)}</TableCell>
                  <TableCell>{statusBadge(conn.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {conn.lastActivity
                      ? new Date(conn.lastActivity).toLocaleString()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => openEdit(conn)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setDeleteId(conn.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Create / Edit Dialog — Professional design */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-2xl modal-card">
            <DialogHeader className="modal-header">
              <div className="modal-header-icon">
                <Cable className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="modal-title">
                  {editId ? "Edit Connection" : "Add New Connection"}
                </DialogTitle>
                <p className="modal-subtitle">
                  Configure SMPP or HTTP vendor connection
                </p>
              </div>
            </DialogHeader>

            <div className="modal-body">
              {/* Section 1: Basic */}
              <div className="modal-section">
                <div className="modal-section-title">
                  <span className="modal-section-num">1</span>
                  Basic Information
                </div>
                <div className="modal-grid">
                  <div className="modal-field modal-field--full">
                    <Label className="modal-label">Connection Name *</Label>
                    <div className="modal-input-wrap">
                      <Tag className="modal-input-icon" />
                      <Input
                        placeholder="e.g. Vendor MT Primary"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="modal-input-with-icon"
                      />
                    </div>
                  </div>
                  <div className="modal-field modal-field--full">
                    <Label className="modal-label">Vendor Company *</Label>
                    <Select
                      value={form.companyId}
                      onValueChange={(val) => setForm({ ...form, companyId: val as string })}
                    >
                      <SelectTrigger className="modal-select-trigger">
                        <SelectValue placeholder="Select vendor company" />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="modal-field">
                    <Label className="modal-label">Protocol Type *</Label>
                    <Select
                      value={form.type}
                      onValueChange={(val) => setForm({ ...form, type: val as "SMPP" | "HTTP" })}
                    >
                      <SelectTrigger className="modal-select-trigger">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectItem value="SMPP">SMPP</SelectItem>
                        <SelectItem value="HTTP">HTTP API</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="modal-field">
                    <Label className="modal-label">Direction *</Label>
                    <Select
                      value={form.direction}
                      onValueChange={(val) => setForm({ ...form, direction: val as "MT" | "MO" | "BOTH" })}
                    >
                      <SelectTrigger className="modal-select-trigger">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectItem value="MT">MT (Outbound)</SelectItem>
                        <SelectItem value="MO">MO (Inbound)</SelectItem>
                        <SelectItem value="BOTH">BOTH (Both ways)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Section 2: SMPP or HTTP Config */}
              {form.type === "SMPP" ? (
                <div className="modal-section">
                  <div className="modal-section-title">
                    <span className="modal-section-num">2</span>
                    SMPP Configuration
                  </div>
                  <div className="modal-grid">
                    <div className="modal-field">
                      <Label className="modal-label">Host *</Label>
                      <div className="modal-input-wrap">
                        <Server className="modal-input-icon" />
                        <Input
                          placeholder="smpp.vendor.com"
                          value={form.host}
                          onChange={(e) => setForm({ ...form, host: e.target.value })}
                          className="modal-input-with-icon"
                        />
                      </div>
                    </div>
                    <div className="modal-field">
                      <Label className="modal-label">Port *</Label>
                      <div className="modal-input-wrap">
                        <Globe2 className="modal-input-icon" />
                        <Input
                          type="number"
                          placeholder="2775"
                          value={form.port}
                          onChange={(e) => setForm({ ...form, port: e.target.value })}
                          className="modal-input-with-icon"
                        />
                      </div>
                    </div>
                    <div className="modal-field">
                      <Label className="modal-label">Username *</Label>
                      <div className="modal-input-wrap">
                        <Key className="modal-input-icon" />
                        <Input
                          placeholder="smpp_user"
                          value={form.username}
                          onChange={(e) => setForm({ ...form, username: e.target.value })}
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
                          placeholder={editId ? "Leave blank to keep" : "Password"}
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          className="modal-input-with-icon"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="modal-section">
                  <div className="modal-section-title">
                    <span className="modal-section-num">2</span>
                    HTTP API Configuration
                  </div>
                  <div className="modal-grid">
                    <div className="modal-field modal-field--full">
                      <Label className="modal-label">API URL *</Label>
                      <div className="modal-input-wrap">
                        <Link2 className="modal-input-icon" />
                        <Input
                          placeholder="https://api.vendor.com/sms/send"
                          value={form.apiUrl}
                          onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
                          className="modal-input-with-icon"
                        />
                      </div>
                    </div>
                    <div className="modal-field modal-field--full">
                      <Label className="modal-label">API Key *</Label>
                      <div className="modal-input-wrap">
                        <Key className="modal-input-icon" />
                        <Input
                          type="password"
                          placeholder={editId ? "Leave blank to keep" : "API key"}
                          value={form.apiKey}
                          onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                          className="modal-input-with-icon"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 3: Limits */}
              <div className="modal-section">
                <div className="modal-section-title">
                  <span className="modal-section-num">3</span>
                  Rate Limits & Status
                </div>
                <div className="modal-grid">
                  {form.type === "SMPP" && (
                    <div className="modal-field">
                      <Label className="modal-label">Sending Transport</Label>
                      <Select
                        value={form.transport}
                        onValueChange={(val) => setForm({ ...form, transport: val as "JASMIN" | "DIRECT" })}
                      >
                        <SelectTrigger className="modal-select-trigger">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectItem value="JASMIN">Jasmin (default)</SelectItem>
                          <SelectItem value="DIRECT">Direct (app-managed bind)</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="modal-hint">
                        Direct bypasses Jasmin&apos;s one-in-flight-per-connector limit for higher TPS
                      </span>
                    </div>
                  )}
                  <div className="modal-field">
                    <Label className="modal-label">Max TPS</Label>
                    <Input
                      type="number"
                      placeholder="10"
                      value={form.maxTps}
                      onChange={(e) => setForm({ ...form, maxTps: e.target.value })}
                    />
                    <span className="modal-hint">Transactions per second</span>
                  </div>
                  <div className="modal-field">
                    <Label className="modal-label">Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(val) => setForm({ ...form, status: val as "active" | "inactive" | "error" })}
                    >
                      <SelectTrigger className="modal-select-trigger">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="modal-footer">
              <DialogClose render={<Button variant="outline" />}>
                <X className="mr-1.5 h-4 w-4" />
                Cancel
              </DialogClose>
              <Button onClick={handleSave} disabled={saving} className="modal-save-btn">
                <Save className="mr-1.5 h-4 w-4" />
                {saving ? "Saving..." : editId ? "Update Connection" : "Create Connection"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete connection</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this connection? This action cannot be undone.
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
      </div>
    </>
  );
}
