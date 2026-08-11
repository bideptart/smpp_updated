"use client";

import { useState } from "react";
import useSWR from "swr";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Copy,
  Key,
  Server,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function randomHex(len: number) {
  return Array.from({ length: len }, () =>
    Math.floor(Math.random() * 16).toString(16)
  )
    .join("")
    .toUpperCase();
}

function randomPassword(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(
    { length: len },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

interface SmppAccount {
  id: number;
  companyId: number;
  companyName: string;
  accountName: string | null;
  systemId: string;
  status: string;
  maxTps: number;
  maxConnections: number;
  speedLimit: number;
  bindMode: string;
  chargingModel: string;
  enableDelivery: string;
  allowedIps: string;
  assignedIp: string | null;
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  lastBindAt: string | null;
  lastBindIp: string | null;
}

const emptyForm = {
  companyId: "",
  accountName: "",
  systemId: "",
  password: "",
  allowedIps: "*",
  assignedIp: "",
  maxConnections: "2",
  maxTps: "10",
  speedLimit: "10",
  bindMode: "TRX",
  chargingModel: "submission",
  enableDelivery: true,
};

export default function CustomerAccountsPage() {
  const { data: accountsData, mutate } = useSWR(
    "/api/customer-accounts",
    fetcher
  );
  const { data: companiesData } = useSWR("/api/companies", fetcher);
  const { data: serverIpsData } = useSWR("/api/settings/server-ips", fetcher);
  const serverIps: string[] = serverIpsData?.data || [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<{
    systemId: string;
    password: string;
    smppHost: string;
    smppPort: number;
  } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const accounts: SmppAccount[] = accountsData?.data || [];
  const companies = (companiesData?.data || []).filter(
    (c: { type: string }) => c.type === "customer"
  );

  function openAdd() {
    setEditId(null);
    setCredentials(null);
    setForm({
      ...emptyForm,
      systemId: `BSS${randomHex(6)}`,
      password: randomPassword(8),
    });
    setDialogOpen(true);
  }

  function openEdit(a: SmppAccount) {
    setEditId(a.id);
    setCredentials(null);
    setForm({
      companyId: String(a.companyId),
      accountName: a.accountName || "",
      systemId: a.systemId,
      password: "",
      allowedIps: a.allowedIps,
      assignedIp: a.assignedIp || "",
      maxConnections: String(a.maxConnections),
      maxTps: String(a.maxTps),
      speedLimit: String(a.speedLimit),
      bindMode: a.bindMode,
      chargingModel: a.chargingModel,
      enableDelivery: a.enableDelivery === "yes",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        companyId: parseInt(form.companyId, 10),
        accountName: form.accountName || null,
        systemId: form.systemId,
        password: form.password || undefined,
        allowedIps: form.allowedIps,
        assignedIp: form.assignedIp || null,
        maxConnections: parseInt(form.maxConnections, 10),
        maxTps: parseInt(form.maxTps, 10),
        speedLimit: parseInt(form.speedLimit, 10),
        bindMode: form.bindMode,
        chargingModel: form.chargingModel,
        enableDelivery: form.enableDelivery ? "yes" : "no",
      };

      const url = editId
        ? `/api/customer-accounts/${editId}`
        : "/api/customer-accounts";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (!result.success) {
        toast.error(result.error || "Failed to save account");
        return;
      }

      if (result.credentials && !editId) {
        setCredentials(result.credentials);
        toast.success("SMPP account created - save the credentials!");
      } else {
        toast.success("SMPP account updated");
        setDialogOpen(false);
      }
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
      const res = await fetch(`/api/customer-accounts/${deleteId}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.error || "Failed to delete");
        return;
      }
      toast.success("Account deleted");
      mutate();
    } catch {
      toast.error("An error occurred");
    } finally {
      setDeleteId(null);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  const statusColor = (s: string) => {
    if (s === "active") return "default";
    if (s === "suspended") return "secondary";
    return "destructive";
  };

  return (
    <>
      <TopBar title="Customer SMPP Accounts" />
      <div className="page-content">
        <PageBreadcrumb crumbs={[{ label: "Customers" }, { label: "SMPP Accounts" }]} />
        <div className="page-header">
          <h3 className="section-title">
            SMPP Accounts ({accounts.length})
          </h3>
          <Button onClick={openAdd} className="btn-primary-action">
            <Plus className="mr-1.5 h-4 w-4" />
            Add SMPP Account
          </Button>
        </div>

        <div className="tt-container">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Name</TableHead>
                <TableHead>System ID</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">TPS</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead>Last Bind</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center text-muted-foreground"
                  >
                    No SMPP accounts configured
                  </TableCell>
                </TableRow>
              )}
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    {a.accountName || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {a.systemId}
                  </TableCell>
                  <TableCell>{a.companyName}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={statusColor(a.status)}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{a.maxTps}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {a.totalSent.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {a.totalDelivered.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {a.totalFailed.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.lastBindAt
                      ? new Date(a.lastBindAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(a)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-700"
                        onClick={() => setDeleteId(a.id)}
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

        {/* Add/Edit Dialog */}
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setCredentials(null);
          }}
        >
          <DialogContent className="sm:max-w-lg modal-card">
            <DialogHeader className="modal-header">
              <div className="modal-header-icon">
                <Server className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="modal-title">
                  {credentials
                    ? "Account Created — Save Credentials"
                    : editId
                    ? "Edit SMPP Account"
                    : "Add SMPP Account"}
                </DialogTitle>
                <p className="modal-subtitle">
                  {credentials ? "This password will not be shown again" : "SMPP bind credentials for a customer's own client"}
                </p>
              </div>
            </DialogHeader>

            {credentials ? (
              <div className="space-y-4 py-2">
                <Card className="border-emerald-200 bg-emerald-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-emerald-800">
                      <Key className="h-4 w-4" />
                      SMPP Credentials
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">System ID:</span>
                      <div className="flex items-center gap-1">
                        <code className="font-mono font-bold">
                          {credentials.systemId}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            copyToClipboard(credentials.systemId)
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">Password:</span>
                      <div className="flex items-center gap-1">
                        <code className="font-mono font-bold">
                          {credentials.password}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            copyToClipboard(credentials.password)
                          }
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">SMPP Host:</span>
                      <code className="font-mono">
                        {credentials.smppHost}
                      </code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">SMPP Port:</span>
                      <code className="font-mono">
                        {credentials.smppPort}
                      </code>
                    </div>
                  </CardContent>
                </Card>
                <p className="text-xs text-amber-600">
                  Save these credentials now. The password will not be shown
                  again.
                </p>
                <DialogFooter>
                  <Button onClick={() => setDialogOpen(false)}>Done</Button>
                </DialogFooter>
              </div>
            ) : (
              <>
                <div className="modal-body">
                  <div className="modal-section">
                    <div className="modal-section-title">
                      <span className="modal-section-num">1</span>
                      Account
                    </div>
                    <div className="modal-field modal-field--full">
                      <Label className="modal-label">Company</Label>
                      <Select
                        value={form.companyId}
                        onValueChange={(v) =>
                          v && setForm({ ...form, companyId: v })
                        }
                      >
                        <SelectTrigger className="modal-select-trigger">
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map(
                            (c: { id: number; name: string }) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="modal-field modal-field--full">
                      <Label className="modal-label">Account Name</Label>
                      <Input
                        value={form.accountName}
                        onChange={(e) =>
                          setForm({ ...form, accountName: e.target.value })
                        }
                        placeholder="e.g. Main Production"
                      />
                    </div>
                  </div>

                  <div className="modal-section">
                    <div className="modal-section-title">
                      <span className="modal-section-num">2</span>
                      Credentials
                    </div>
                    <div className="modal-grid">
                      <div className="modal-field">
                        <Label className="modal-label">System ID</Label>
                        <div className="flex gap-1">
                          <Input
                            value={form.systemId}
                            onChange={(e) =>
                              setForm({ ...form, systemId: e.target.value })
                            }
                            className="font-mono"
                          />
                          {!editId && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="shrink-0"
                              onClick={() =>
                                setForm({
                                  ...form,
                                  systemId: `BSS${randomHex(6)}`,
                                })
                              }
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="modal-field">
                        <Label className="modal-label">Password</Label>
                        <div className="flex gap-1">
                          <Input
                            value={form.password}
                            onChange={(e) =>
                              setForm({ ...form, password: e.target.value })
                            }
                            className="font-mono"
                            placeholder={
                              editId ? "Leave blank to keep" : ""
                            }
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            onClick={() =>
                              setForm({
                                ...form,
                                password: randomPassword(8),
                              })
                            }
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="modal-field modal-field--full">
                      <Label className="modal-label">Allowed IPs / Hostnames</Label>
                      <Input
                        value={form.allowedIps}
                        onChange={(e) =>
                          setForm({ ...form, allowedIps: e.target.value })
                        }
                        placeholder="* for all, or comma-separated IPs / SMSC hostnames"
                      />
                    </div>
                    <div className="modal-field modal-field--full">
                      <Label className="modal-label">Assigned Server IP</Label>
                      <Select
                        value={form.assignedIp || "any"}
                        onValueChange={(v) =>
                          setForm({ ...form, assignedIp: v && v !== "any" ? v : "" })
                        }
                      >
                        <SelectTrigger className="modal-select-trigger">
                          <SelectValue placeholder="Any server IP" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any server IP (no restriction)</SelectItem>
                          {serverIps.map((ip) => (
                            <SelectItem key={ip} value={ip}>
                              {ip}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Which of this server&apos;s own IPs the customer must connect to.
                        Binding via any other IP will be rejected, even with the
                        correct credentials.
                      </p>
                    </div>
                  </div>

                  <div className="modal-section">
                    <div className="modal-section-title">
                      <span className="modal-section-num">3</span>
                      Limits
                    </div>
                    <div className="modal-grid modal-grid--3col">
                      <div className="modal-field">
                        <Label className="modal-label">Max Connections</Label>
                        <Input
                          type="number"
                          value={form.maxConnections}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              maxConnections: e.target.value,
                            })
                          }
                          min="1"
                        />
                      </div>
                      <div className="modal-field">
                        <Label className="modal-label">Max TPS</Label>
                        <Input
                          type="number"
                          value={form.maxTps}
                          onChange={(e) =>
                            setForm({ ...form, maxTps: e.target.value })
                          }
                          min="1"
                        />
                      </div>
                      <div className="modal-field">
                        <Label className="modal-label">Speed Limit</Label>
                        <Input
                          type="number"
                          value={form.speedLimit}
                          onChange={(e) =>
                            setForm({ ...form, speedLimit: e.target.value })
                          }
                          min="1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="modal-section">
                    <div className="modal-section-title">
                      <span className="modal-section-num">4</span>
                      Configuration
                    </div>
                    <div className="modal-grid">
                      <div className="modal-field">
                        <Label className="modal-label">Bind Mode</Label>
                        <Select
                          value={form.bindMode}
                          onValueChange={(v) =>
                            v && setForm({ ...form, bindMode: v })
                          }
                        >
                          <SelectTrigger className="modal-select-trigger">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TX">TX (Transmit)</SelectItem>
                            <SelectItem value="RX">RX (Receive)</SelectItem>
                            <SelectItem value="TRX">
                              TRX (Transceiver)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="modal-field">
                        <Label className="modal-label">Charging Model</Label>
                        <Select
                          value={form.chargingModel}
                          onValueChange={(v) =>
                            v && setForm({ ...form, chargingModel: v })
                          }
                        >
                          <SelectTrigger className="modal-select-trigger">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="submission">
                              On Submission
                            </SelectItem>
                            <SelectItem value="delivery">
                              On Delivery
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="modal-toggle-row">
                      <Label className="modal-label">Enable Delivery Reports</Label>
                      <Switch
                        checked={form.enableDelivery}
                        onCheckedChange={(checked) =>
                          setForm({ ...form, enableDelivery: !!checked })
                        }
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="modal-footer">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving} className="modal-save-btn">
                    {saving
                      ? "Saving..."
                      : editId
                      ? "Update"
                      : "Create Account"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete account</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this SMPP account? This action cannot be undone.
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
