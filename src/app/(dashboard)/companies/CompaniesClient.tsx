"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Plus, Pencil, Trash2, Building2, Mail, Phone, User, Hash, Save, X, Server, Globe2, Lock, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import TopBar from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { currencies } from "@/lib/currencies";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Company {
  id: number;
  name: string;
  code: string;
  type: "customer" | "vendor";
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isActive: boolean;
  balance: number;
  currency: string;
  createdAt: string;
  connectionCount: number;
  traffic24h: number;
}

interface FormData {
  name: string;
  code: string;
  type: "customer" | "vendor";
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  isActive: boolean;
  balance: string;
  currency: string;
  connHost: string;
  connPort: string;
  connUsername: string;
  connPassword: string;
  createSmppAccount: boolean;
  smppAccountName: string;
}

const emptyForm: FormData = {
  name: "",
  code: "",
  type: "customer",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  isActive: true,
  balance: "0",
  currency: "INR",
  connHost: "",
  connPort: "2775",
  connUsername: "",
  connPassword: "",
  createSmppAccount: true,
  smppAccountName: "",
};

/** Two-letter monogram from the company code, falling back to the name. */
function monogram(c: Company) {
  const src = (c.code || c.name || "?").replace(/[^A-Za-z0-9]/g, "");
  return src.slice(0, 2).toUpperCase() || "?";
}

function CompanyCard({
  c,
  maxTraffic,
  onEdit,
  onDelete,
}: {
  c: Company;
  maxTraffic: number;
  onEdit: (c: Company) => void;
  onDelete: (id: number) => void;
}) {
  // Bar is share-of-busiest rather than an absolute scale, so it stays readable
  // whether the top company sends 50 or 5 million messages a day.
  const share = maxTraffic > 0 ? (c.traffic24h / maxTraffic) * 100 : 0;
  const hasContact = !!(c.contactName || c.contactEmail || c.contactPhone);

  return (
    <div className={`co-card${c.isActive ? "" : " co-card--inactive"}`}>
      <div className="co-card-head">
        <div className={`co-avatar co-avatar--${c.type}`}>{monogram(c)}</div>
        <div className="co-heading">
          <div className="co-name" title={c.name}>{c.name}</div>
          <div className="co-meta-row">
            <span className="co-code">{c.code}</span>
            <span className={`co-type co-type--${c.type}`}>{c.type}</span>
          </div>
        </div>
        <span
          className={`co-status-dot co-status-dot--${c.isActive ? "on" : "off"}`}
          title={c.isActive ? "Active" : "Inactive"}
        />
      </div>

      <div className="co-contact">
        {hasContact ? (
          <>
            {c.contactName && (
              <div className="co-contact-row">
                <User className="h-3 w-3 shrink-0" />
                <span>{c.contactName}</span>
              </div>
            )}
            {c.contactEmail && (
              <div className="co-contact-row">
                <Mail className="h-3 w-3 shrink-0" />
                <span>{c.contactEmail}</span>
              </div>
            )}
            {c.contactPhone && (
              <div className="co-contact-row">
                <Phone className="h-3 w-3 shrink-0" />
                <span>{c.contactPhone}</span>
              </div>
            )}
          </>
        ) : (
          <span className="co-contact-empty">No contact details</span>
        )}
      </div>

      <div className="co-traffic">
        <div className="co-traffic-head">
          <span className="co-traffic-label">24h traffic</span>
          <span className="co-traffic-value">{c.traffic24h.toLocaleString()}</span>
        </div>
        <div className="co-traffic-bar">
          <div
            className={`co-traffic-fill co-traffic-fill--${c.type}`}
            style={{ width: `${share}%` }}
          />
        </div>
      </div>

      <div className="co-stats">
        <div className="co-stat">
          <span className="co-stat-label">Connections</span>
          <span className="co-stat-value">{c.connectionCount}</span>
        </div>
        <div className="co-stat">
          <span className="co-stat-label">Balance ({c.currency || "INR"})</span>
          <span className="co-stat-value">
            {Number(c.balance ?? 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>

      <div className="co-card-actions">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(c)} title="Edit">
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(c.id)} title="Delete">
          <Trash2 className="h-3.5 w-3.5 text-red-400" />
        </Button>
      </div>
    </div>
  );
}

export default function CompaniesClient({ filterType }: { filterType?: "customer" | "vendor" }) {
  const router = useRouter();
  const { data, mutate } = useSWR("/api/companies", fetcher);
  const companies: Company[] = (data?.data || []).filter(
    (c: Company) => !filterType || c.type === filterType
  );

  const maxTraffic = companies.reduce((m, c) => Math.max(m, c.traffic24h || 0), 0);

  const heading =
    filterType === "vendor"
      ? "Vendor Companies"
      : filterType === "customer"
      ? "Customer Companies"
      : "Companies";

  const description =
    filterType === "vendor"
      ? "Manage vendor companies (SMS delivery partners)"
      : filterType === "customer"
      ? "Manage customer companies (SMS senders)"
      : "Manage customers and vendors";

  const addLabel =
    filterType === "vendor"
      ? "Add Vendor"
      : filterType === "customer"
      ? "Add Customer"
      : "Add Company";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [credentials, setCredentials] = useState<{ systemId: string; password: string; smppHost: string; smppPort: number } | null>(null);

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, type: filterType ?? "customer" });
    setDialogOpen(true);
  }

  function openEdit(c: Company) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      code: c.code,
      type: c.type,
      contactName: c.contactName || "",
      contactEmail: c.contactEmail || "",
      contactPhone: c.contactPhone || "",
      isActive: c.isActive,
      balance: String(c.balance ?? 0),
      currency: c.currency || "INR",
      connHost: "",
      connPort: "2775",
      connUsername: "",
      connPassword: "",
      createSmppAccount: false,
      smppAccountName: "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Name and code are required");
      return;
    }
    const wantsVendorConnection =
      !editingId && form.type === "vendor" && form.connHost.trim() && form.connUsername.trim() && form.connPassword.trim();
    const wantsCustomerAccount = !editingId && form.type === "customer" && form.createSmppAccount;

    setSaving(true);
    try {
      const url = editingId
        ? `/api/companies/${editingId}`
        : wantsVendorConnection
        ? "/api/companies/onboard-vendor"
        : wantsCustomerAccount
        ? "/api/companies/onboard-customer"
        : "/api/companies";
      const method = editingId ? "PUT" : "POST";
      const body = wantsVendorConnection
        ? {
            ...form,
            connection: {
              host: form.connHost,
              port: form.connPort,
              username: form.connUsername,
              password: form.connPassword,
            },
          }
        : wantsCustomerAccount
        ? { ...form, smppAccount: { accountName: form.smppAccountName || undefined } }
        : form;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Operation failed");
        return;
      }
      toast.success(editingId ? "Company updated" : "Company created");
      if (json.data?.note) toast.message(json.data.note);
      if (json.data?.credentials) {
        setCredentials(json.data.credentials);
      }
      const newCustomerId =
        !editingId && form.type === "customer" ? json.data?.company?.id ?? json.data?.id : null;
      if (newCustomerId) {
        toast("Set up a rate card for this customer now?", {
          action: {
            label: "Add Route",
            onClick: () => router.push(`/routes?customerId=${newCustomerId}`),
          },
        });
      }
      setDialogOpen(false);
      mutate();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/companies/${deleteId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Delete failed");
      } else {
        toast.success("Company deleted");
      }
      setDeleteId(null);
      mutate();
    } catch {
      toast.error("Network error");
      setDeleteId(null);
    }
  }

  return (
    <>
      <TopBar
        title={heading}
        subtitle={description}
        actions={
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            {addLabel}
          </Button>
        }
      />
      <div className="page-content">
        <div className="co-grid">
          {companies.length === 0 && (
            <div className="co-empty">No companies found</div>
          )}
          {companies.map((c) => (
            <CompanyCard
              key={c.id}
              c={c}
              maxTraffic={maxTraffic}
              onEdit={openEdit}
              onDelete={setDeleteId}
            />
          ))}
        </div>
      </div>

      {/* Add / Edit Dialog — Professional form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl modal-card">
          <DialogHeader className="modal-header">
            <div className="modal-header-icon">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="modal-title">
                {editingId ? "Edit Company" : "Add New Company"}
              </DialogTitle>
              <DialogDescription className="modal-subtitle">
                {editingId
                  ? "Update company details below."
                  : "Create a customer or vendor company."}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="modal-body">
            {/* Section 1: Basic Info */}
            <div className="modal-section">
              <div className="modal-section-title">
                <span className="modal-section-num">1</span>
                Basic Information
              </div>
              <div className="modal-grid">
                <div className="modal-field modal-field--full">
                  <Label className="modal-label">Company Name *</Label>
                  <div className="modal-input-wrap">
                    <Building2 className="modal-input-icon" />
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Acme Corp"
                      className="modal-input-with-icon"
                    />
                  </div>
                </div>

                <div className="modal-field">
                  <Label className="modal-label">Company Code *</Label>
                  <div className="modal-input-wrap">
                    <Hash className="modal-input-icon" />
                    <Input
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                      placeholder="ACME"
                      className="modal-input-with-icon uppercase"
                    />
                  </div>
                  <span className="modal-hint">Short unique identifier</span>
                </div>

                <div className="modal-field">
                  <Label className="modal-label">Type *</Label>
                  <Select
                    value={form.type}
                    onValueChange={(val) => setForm((f) => ({ ...f, type: val as "customer" | "vendor" }))}
                  >
                    <SelectTrigger className="modal-select-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="modal-hint">Customer sends SMS · Vendor delivers SMS</span>
                </div>
              </div>
            </div>

            {/* Section 2: Contact */}
            <div className="modal-section">
              <div className="modal-section-title">
                <span className="modal-section-num">2</span>
                Contact Details (optional)
              </div>
              <div className="modal-grid">
                <div className="modal-field modal-field--full">
                  <Label className="modal-label">Contact Name</Label>
                  <div className="modal-input-wrap">
                    <User className="modal-input-icon" />
                    <Input
                      value={form.contactName}
                      onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                      placeholder="John Doe"
                      className="modal-input-with-icon"
                    />
                  </div>
                </div>

                <div className="modal-field">
                  <Label className="modal-label">Email</Label>
                  <div className="modal-input-wrap">
                    <Mail className="modal-input-icon" />
                    <Input
                      type="email"
                      value={form.contactEmail}
                      onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                      placeholder="john@example.com"
                      className="modal-input-with-icon"
                    />
                  </div>
                </div>

                <div className="modal-field">
                  <Label className="modal-label">Phone</Label>
                  <div className="modal-input-wrap">
                    <Phone className="modal-input-icon" />
                    <Input
                      value={form.contactPhone}
                      onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                      placeholder="+91 9876543210"
                      className="modal-input-with-icon"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Status */}
            <div className="modal-section">
              <div className="modal-section-title">
                <span className="modal-section-num">3</span>
                Status
              </div>
              <div className="modal-toggle-row">
                <div>
                  <Label className="modal-label">Active</Label>
                  <span className="modal-hint">Inactive companies won&apos;t appear in routing</span>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: !!checked }))}
                />
              </div>
              <div className="modal-grid" style={{ marginTop: 12 }}>
                <div className="modal-field">
                  <Label className="modal-label">Currency</Label>
                  <Select
                    value={form.currency}
                    onValueChange={(val) => val && setForm((f) => ({ ...f, currency: val }))}
                  >
                    <SelectTrigger className="modal-select-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {currencies.map((cur) => (
                        <SelectItem key={cur.code} value={cur.code}>
                          {cur.symbol} {cur.code} — {cur.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="modal-hint">Rates and balance for this company are in this currency</span>
                </div>
                <div className="modal-field">
                  <Label className="modal-label">Balance / Credit</Label>
                  <Input type="number" step="0.0001" value={form.balance} onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))} placeholder="0.00" />
                  <span className="modal-hint">Sending is blocked when the balance runs out</span>
                </div>
              </div>
            </div>

            {/* Section 4: Connection Details — new vendors only */}
            {!editingId && form.type === "vendor" && (
              <div className="modal-section">
                <div className="modal-section-title">
                  <span className="modal-section-num">4</span>
                  SMPP Connection (optional)
                </div>
                <p className="modal-hint" style={{ marginBottom: 8 }}>
                  Fill this in to set up delivery in one step — creates the connection record and,
                  if you&apos;re a gateway admin, the real Jasmin connector too. Leave blank to just
                  create the company record and set up delivery later on Connections/Gateway.
                </p>
                <div className="modal-grid">
                  <div className="modal-field">
                    <Label className="modal-label">Host</Label>
                    <div className="modal-input-wrap">
                      <Globe2 className="modal-input-icon" />
                      <Input
                        value={form.connHost}
                        onChange={(e) => setForm((f) => ({ ...f, connHost: e.target.value }))}
                        placeholder="smpp.vendor.com"
                        className="modal-input-with-icon"
                      />
                    </div>
                  </div>
                  <div className="modal-field">
                    <Label className="modal-label">Port</Label>
                    <Input
                      value={form.connPort}
                      onChange={(e) => setForm((f) => ({ ...f, connPort: e.target.value }))}
                      placeholder="2775"
                    />
                  </div>
                  <div className="modal-field">
                    <Label className="modal-label">Username</Label>
                    <div className="modal-input-wrap">
                      <User className="modal-input-icon" />
                      <Input
                        value={form.connUsername}
                        onChange={(e) => setForm((f) => ({ ...f, connUsername: e.target.value }))}
                        className="modal-input-with-icon"
                      />
                    </div>
                  </div>
                  <div className="modal-field">
                    <Label className="modal-label">Password</Label>
                    <div className="modal-input-wrap">
                      <Lock className="modal-input-icon" />
                      <Input
                        type="password"
                        value={form.connPassword}
                        onChange={(e) => setForm((f) => ({ ...f, connPassword: e.target.value }))}
                        className="modal-input-with-icon"
                      />
                    </div>
                  </div>
                </div>
                <span className="modal-hint" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Server className="h-3 w-3" /> Connector ID derived from the company code above.
                </span>
              </div>
            )}

            {/* Section 4: SMPP Account — new customers only */}
            {!editingId && form.type === "customer" && (
              <div className="modal-section">
                <div className="modal-section-title">
                  <span className="modal-section-num">4</span>
                  SMPP Account
                </div>
                <div className="modal-toggle-row">
                  <div>
                    <Label className="modal-label">Create SMPP account now</Label>
                    <span className="modal-hint">System ID and password are generated automatically — you&apos;ll see them once after saving</span>
                  </div>
                  <Switch
                    checked={form.createSmppAccount}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, createSmppAccount: !!checked }))}
                  />
                </div>
                {form.createSmppAccount && (
                  <div className="modal-field" style={{ marginTop: 12 }}>
                    <Label className="modal-label">Account Name (optional)</Label>
                    <Input
                      value={form.smppAccountName}
                      onChange={(e) => setForm((f) => ({ ...f, smppAccountName: e.target.value }))}
                      placeholder="e.g. Primary bind"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="modal-footer">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              <X className="mr-1.5 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="modal-save-btn">
              <Save className="mr-1.5 h-4 w-4" />
              {saving ? "Saving..." : editingId ? "Update Company" : "Create Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Company</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this company? This action cannot be
              undone.
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

      {/* SMPP Credentials Reveal — shown once right after creation */}
      <Dialog open={credentials !== null} onOpenChange={(open) => { if (!open) setCredentials(null); }}>
        <DialogContent className="sm:max-w-sm modal-card">
          <DialogHeader className="modal-header">
            <div className="modal-header-icon">
              <KeyRound className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="modal-title">SMPP Account Created</DialogTitle>
              <p className="modal-subtitle">This password will not be shown again</p>
            </div>
          </DialogHeader>
          {credentials && (
            <div className="modal-body">
              <div className="modal-section">
                <div className="modal-field modal-field--full">
                  <Label className="modal-label">System ID</Label>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={credentials.systemId} className="font-mono" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(credentials.systemId)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="modal-field modal-field--full">
                  <Label className="modal-label">Password</Label>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={credentials.password} className="font-mono" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(credentials.password)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="modal-field">
                  <Label className="modal-label">Host</Label>
                  <Input readOnly value={credentials.smppHost} />
                </div>
                <div className="modal-field">
                  <Label className="modal-label">Port</Label>
                  <Input readOnly value={String(credentials.smppPort)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="modal-footer">
            <Button onClick={() => setCredentials(null)} className="modal-save-btn">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
