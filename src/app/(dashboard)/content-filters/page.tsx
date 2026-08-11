"use client";

import { useState } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import StatCard from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Plus, Pencil, Trash2, ShieldAlert, ShieldCheck, ShieldOff,
  Users, Globe2, Hash, Save, X, Search,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ContentFilterRow {
  id: number;
  customerId: number | null;
  keyword: string;
  action: string;
  isActive: boolean;
  createdAt: string;
}

interface Company {
  id: number;
  name: string;
  type: string;
}

const emptyForm = {
  customerId: "",
  keyword: "",
  isActive: true,
};

export default function ContentFiltersPage() {
  const { data: filtersData, mutate } = useSWR("/api/content-filters", fetcher, { refreshInterval: 15000 });
  const { data: companiesData } = useSWR("/api/companies", fetcher);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");

  const filters: ContentFilterRow[] = filtersData?.data || [];
  const companies: Company[] = companiesData?.data || [];
  const customers = companies.filter((c) => c.type === "customer");

  function customerName(id: number | null): string {
    if (id === null) return "All customers";
    return customers.find((c) => c.id === id)?.name || `#${id}`;
  }

  const stats = {
    total: filters.length,
    active: filters.filter((f) => f.isActive).length,
    inactive: filters.filter((f) => !f.isActive).length,
    global: filters.filter((f) => f.customerId === null).length,
    scoped: filters.filter((f) => f.customerId !== null).length,
  };

  const q = query.trim().toLowerCase();
  const visible = filters.filter((f) => {
    if (status === "active" && !f.isActive) return false;
    if (status === "inactive" && f.isActive) return false;
    if (!q) return true;
    return (
      f.keyword.toLowerCase().includes(q) ||
      customerName(f.customerId).toLowerCase().includes(q)
    );
  });

  function openAdd() {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(f: ContentFilterRow) {
    setEditId(f.id);
    setForm({
      customerId: f.customerId ? String(f.customerId) : "",
      keyword: f.keyword,
      isActive: f.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.keyword.trim()) {
      toast.error("Keyword is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customerId: form.customerId ? parseInt(form.customerId, 10) : null,
        keyword: form.keyword.trim(),
        action: "block",
        isActive: form.isActive,
      };

      const url = editId ? `/api/content-filters/${editId}` : "/api/content-filters";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (!result.success) {
        toast.error(result.error || "Failed to save filter");
        return;
      }

      toast.success(editId ? "Filter updated" : "Filter created");
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
      const res = await fetch(`/api/content-filters/${deleteId}`, { method: "DELETE" });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.error || "Failed to delete");
        return;
      }
      toast.success("Filter deleted");
      mutate();
    } catch {
      toast.error("An error occurred");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <>
      <TopBar
        title="Content Filters"
        subtitle="Block messages containing banned keywords before they are routed"
        actions={
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Filter
          </Button>
        }
      />
      <div className="page-content">
        <div className="dp-stats">
          <StatCard icon={ShieldAlert} label="Total Rules" value={stats.total} color="var(--t-text-4)" bg="var(--t-bg-muted)" />
          <StatCard icon={ShieldCheck} label="Active" value={stats.active} color="var(--t-green-fg)" bg="var(--t-green-bg)" />
          <StatCard icon={ShieldOff} label="Inactive" value={stats.inactive} color="var(--t-text-muted)" bg="var(--t-bg-muted)" />
          <StatCard icon={Globe2} label="Global Rules" value={stats.global} color="var(--t-blue-fg)" bg="var(--t-blue-bg)" />
          <StatCard icon={Users} label="Customer-Specific" value={stats.scoped} color="var(--t-indigo-fg)" bg="var(--t-indigo-bg)" />
        </div>

        <div className="dp-toolbar">
          <div className="dp-search">
            <Search className="dp-search-icon" />
            <input
              className="dp-search-input"
              placeholder="Search keyword or customer…"
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
            {(["all", "active", "inactive"] as const).map((s) => (
              <button
                key={s}
                className={`dp-seg-btn${status === s ? " dp-seg-btn--active" : ""}`}
                onClick={() => setStatus(s)}
              >
                {s === "all" ? "All" : s === "active" ? "Active" : "Inactive"}
              </button>
            ))}
          </div>
          <span className="dp-count">
            {visible.length} of {filters.length} rule{filters.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="dp-card">
          {visible.length === 0 ? (
            <div className="dp-empty">
              <div className="dp-empty-icon"><ShieldAlert className="h-5 w-5" /></div>
              <div className="dp-empty-title">
                {filters.length === 0 ? "No content filters configured" : "No filters match your search"}
              </div>
              <div className="dp-empty-hint">
                {filters.length === 0
                  ? "Add a keyword rule to start blocking messages at submit time."
                  : "Try a different keyword or clear the filters."}
              </div>
            </div>
          ) : (
            <div className="dp-scroll">
              <table className="dp-table">
                <thead>
                  <tr>
                    <th className="dp-th">Keyword</th>
                    <th className="dp-th">Scope</th>
                    <th className="dp-th">Action</th>
                    <th className="dp-th dp-th--center">Status</th>
                    <th className="dp-th dp-th--right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((f) => (
                    <tr key={f.id} className="dp-tr">
                      <td className="dp-td dp-td--strong">
                        {f.keyword}
                        <span className="dp-sub">
                          Added {new Date(f.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="dp-td">
                        {f.customerId === null ? (
                          <span className="dp-pill dp-pill--blue">Global</span>
                        ) : (
                          customerName(f.customerId)
                        )}
                      </td>
                      <td className="dp-td">
                        <span className="dp-pill dp-pill--red">Block</span>
                      </td>
                      <td className="dp-td dp-td--center">
                        <span className={`dp-pill ${f.isActive ? "dp-pill--green" : "dp-pill--grey"}`}>
                          <i className="dp-dot" />
                          {f.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="dp-td dp-td--right">
                        <div className="dp-actions">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(f)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700"
                            onClick={() => setDeleteId(f.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg modal-card">
            <DialogHeader className="modal-header">
              <div className="modal-header-icon">
                <ShieldAlert className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="modal-title">{editId ? "Edit Filter" : "Add Content Filter"}</DialogTitle>
                <p className="modal-subtitle">Block messages containing this keyword</p>
              </div>
            </DialogHeader>
            <div className="modal-body">
              <div className="modal-section">
                <div className="modal-field modal-field--full">
                  <Label className="modal-label">Keyword *</Label>
                  <div className="modal-input-wrap">
                    <Hash className="modal-input-icon" />
                    <Input
                      value={form.keyword}
                      onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                      placeholder="e.g. lottery"
                      className="modal-input-with-icon"
                    />
                  </div>
                  <span className="modal-hint">Case-insensitive substring match</span>
                </div>
                <div className="modal-field modal-field--full">
                  <Label className="modal-label">Customer Scope</Label>
                  <Select
                    value={form.customerId || "all"}
                    onValueChange={(v) => v && setForm({ ...form, customerId: v === "all" ? "" : v })}
                  >
                    <SelectTrigger className="modal-select-trigger">
                      <Users className="modal-select-icon" />
                      <SelectValue placeholder="All customers" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectItem value="all">All customers</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="modal-hint">Leave as &quot;All customers&quot; for a global rule</span>
                </div>
                <div className="modal-toggle-row">
                  <div>
                    <Label className="modal-label">Active</Label>
                    <span className="modal-hint">Inactive filters don&apos;t block anything</span>
                  </div>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(checked) => setForm({ ...form, isActive: !!checked })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="modal-footer">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                <X className="mr-1.5 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="modal-save-btn">
                <Save className="mr-1.5 h-4 w-4" />
                {saving ? "Saving..." : editId ? "Update Filter" : "Create Filter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete filter</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this content filter? This action cannot be undone.
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
