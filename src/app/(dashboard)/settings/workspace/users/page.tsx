"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import PageBreadcrumb from "@/components/layout/PageBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus,
  Search,
  MoreVertical,
  MailCheck,
  Pencil,
  Ban,
  AlertTriangle,
  Copy,
  Check,
  Users as UsersIcon,
  UserCircle,
  X as XIcon,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface TeamUser {
  id: number;
  username: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: "super_admin" | "admin" | "user";
  status: "invited" | "active" | "inactive" | "closed";
  avatarUrl: string | null;
  lastLogin: string | null;
  createdAt: string;
}

interface UsersResponse {
  success: boolean;
  data: TeamUser[];
  meta: { callerRole: string; canCreate: ("admin" | "user")[] };
}

function initials(u: TeamUser): string {
  const name = u.fullName || u.email || "?";
  const parts = name.split(" ");
  const first = parts[0]?.[0] || "?";
  const second = parts[1]?.[0] || "";
  return (first + second).toUpperCase();
}

function colorFor(id: number): string {
  const palette = ["#6366f1", "#f59e0b", "#ec4899", "#10b981", "#8b5cf6", "#3b82f6", "#ef4444", "#14b8a6"];
  return palette[id % palette.length];
}

function StatusPill({ status }: { status: string }) {
  const cls = `status-pill status-pill--${status}`;
  const label =
    status === "active"
      ? "Active"
      : status === "invited"
      ? "Invited"
      : status === "inactive"
      ? "Inactive"
      : status === "closed"
      ? "Closed"
      : status;
  return <span className={cls}>{label}</span>;
}

function RolePill({ role }: { role: string }) {
  const label =
    role === "super_admin"
      ? "Super Admin"
      : role === "admin"
      ? "Admin"
      : role === "user"
      ? "User"
      : role;
  return <span className={`role-pill role-pill--${role}`}>{label}</span>;
}

export default function WorkspaceUsersPage() {
  const { data, mutate } = useSWR<UsersResponse>("/api/users", fetcher);
  const users = data?.data || [];
  const canCreate = data?.meta?.canCreate || [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>(["active", "invited"]);

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "user">(canCreate[0] || "user");
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteEmailSent, setInviteEmailSent] = useState(false);
  const [inviteEmailError, setInviteEmailError] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);

  // Edit modal
  const [editUser, setEditUser] = useState<TeamUser | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "user">("user");
  const [editStatus, setEditStatus] = useState<string>("active");
  const [savingEdit, setSavingEdit] = useState(false);

  // Close modal
  const [closeUser, setCloseUser] = useState<TeamUser | null>(null);
  const [closing, setClosing] = useState(false);

  // Reset modal (shows the reset link)
  const [resetUser, setResetUser] = useState<TeamUser | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetting, setResetting] = useState(false);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (!statusFilter.includes(u.status)) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (u.fullName || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
      );
    });
  }, [users, search, statusFilter]);

  function openInvite() {
    setInviteEmail("");
    setInviteRole(canCreate[0] || "user");
    setInviteUrl(null);
    setInviteEmailSent(false);
    setInviteEmailError(null);
    setUrlCopied(false);
    setInviteOpen(true);
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) {
      toast.error("Email is required");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Invite failed");
        return;
      }
      if (json.data.emailSent) {
        toast.success(`Invitation email sent to ${inviteEmail.trim()}`);
      } else {
        toast.success("Invitation created — copy the link below to share");
      }
      setInviteUrl(json.data.inviteUrl);
      setInviteEmailSent(!!json.data.emailSent);
      setInviteEmailError(json.data.emailError || null);
      mutate();
    } catch {
      toast.error("Network error");
    } finally {
      setInviting(false);
    }
  }

  function openEdit(u: TeamUser) {
    setEditUser(u);
    setEditFirstName(u.firstName || "");
    setEditLastName(u.lastName || "");
    setEditRole(u.role === "admin" ? "admin" : "user");
    setEditStatus(u.status);
  }

  async function handleSaveEdit() {
    if (!editUser) return;
    setSavingEdit(true);
    try {
      const body: Record<string, unknown> = {
        firstName: editFirstName,
        lastName: editLastName,
        status: editStatus,
      };
      // Only send role if caller is super admin
      if (data?.meta.callerRole === "super_admin") body.role = editRole;
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Save failed");
        return;
      }
      toast.success("User updated");
      setEditUser(null);
      mutate();
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleClose() {
    if (!closeUser) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/users/${closeUser.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Close failed");
        return;
      }
      toast.success("Account closed");
      setCloseUser(null);
      mutate();
    } finally {
      setClosing(false);
    }
  }

  async function handleResetPassword(u: TeamUser) {
    setResetUser(u);
    setResetUrl(null);
    setResetEmailSent(false);
    setResetting(true);
    try {
      const res = await fetch(`/api/users/${u.id}/reset-password`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Reset failed");
        setResetUser(null);
        return;
      }
      setResetUrl(json.data.resetUrl);
      setResetEmailSent(!!json.data.emailSent);
      if (json.data.emailSent) {
        toast.success(`Reset email sent to ${u.email}`);
      }
    } finally {
      setResetting(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setUrlCopied(true);
    toast.success("Copied");
    setTimeout(() => setUrlCopied(false), 2000);
  }

  const workspaceOwner = users.find((u) => u.role === "super_admin");
  const callerRole = data?.meta?.callerRole;

  return (
    <>
      <div className="page-content">
        <PageBreadcrumb crumbs={[{ label: "Settings" }, { label: "Workspace" }, { label: "Users" }]} />

        <h1 className="settings-page-title">Workspace</h1>

        <div className="workspace-tabs">
          <button className="workspace-tab workspace-tab--active">
            <UsersIcon className="h-4 w-4" />
            Users
          </button>
        </div>

        <div className="workspace-owner-line">
          {workspaceOwner ? (
            <>
              The workspace account owner is <strong>{workspaceOwner.fullName}</strong>{" "}
              {workspaceOwner.email && <>· {workspaceOwner.email}</>}
            </>
          ) : callerRole === "super_admin" ? (
            <>You are a workspace owner.</>
          ) : null}
        </div>

        <div className="workspace-toolbar">
          {canCreate.length > 0 && (
            <Button onClick={openInvite} variant="outline">
              <Plus className="mr-1.5 h-4 w-4" />
              Add users
            </Button>
          )}

          <div className="workspace-toolbar-right">
            <Select
              value={statusFilter.join(",")}
              onValueChange={(v) => v && setStatusFilter(v.split(","))}
            >
              <SelectTrigger className="workspace-filter-trigger">
                <span>Status: {statusFilter.map((s) => s[0].toUpperCase() + s.slice(1)).join(", ")}</span>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="active,invited">Active, Invited</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="invited">Invited only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
                <SelectItem value="closed">Closed only</SelectItem>
                <SelectItem value="active,invited,inactive,closed">All</SelectItem>
              </SelectContent>
            </Select>
            <div className="workspace-search-wrap">
              <Search className="workspace-search-icon" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users"
                className="workspace-search-input"
              />
            </div>
          </div>
        </div>

        <div className="workspace-table-wrap">
          <table className="contacts-table">
            <thead>
              <tr>
                <th className="contacts-th">Name</th>
                <th className="contacts-th">Email</th>
                <th className="contacts-th">Role</th>
                <th className="contacts-th">Status</th>
                <th className="contacts-th" style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="contacts-empty">
                    <UsersIcon className="h-10 w-10 text-slate-300" />
                    <p>No users match your filters</p>
                  </td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="contacts-tr">
                  <td className="contacts-td">
                    <div className="workspace-user-cell">
                      <div
                        className="workspace-avatar"
                        style={{ background: colorFor(u.id) + "20", color: colorFor(u.id) }}
                      >
                        {initials(u)}
                        <span
                          className={`workspace-status-dot workspace-status-dot--${u.status}`}
                        />
                      </div>
                      <span className="workspace-user-name">{u.fullName || "—"}</span>
                    </div>
                  </td>
                  <td className="contacts-td text-sm text-foreground">{u.email || "—"}</td>
                  <td className="contacts-td">
                    <RolePill role={u.role} />
                  </td>
                  <td className="contacts-td">
                    <StatusPill status={u.status} />
                  </td>
                  <td className="contacts-td">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button className="row-action-btn" aria-label="Actions">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end" className="row-menu">
                        <DropdownMenuItem
                          render={<button onClick={() => handleResetPassword(u)} />}
                        >
                          <MailCheck className="h-4 w-4" />
                          Reset password
                        </DropdownMenuItem>
                        <DropdownMenuItem render={<button onClick={() => openEdit(u)} />}>
                          <Pencil className="h-4 w-4" />
                          Edit {u.role === "admin" ? "admin" : "user"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          render={<button onClick={() => setCloseUser(u)} />}
                          className="text-red-600 focus:bg-red-50 focus:text-red-700"
                        >
                          <Ban className="h-4 w-4" />
                          Close {u.role === "admin" ? "admin" : "user"} account
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="workspace-summary">
          1–{filtered.length} of {filtered.length} user{filtered.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md modal-card">
          <DialogHeader className="modal-header">
            <div className="modal-header-icon">
              <UserCircle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="modal-title">Invite users</DialogTitle>
              <p className="modal-subtitle">
                Activation link will be sent to your team member&apos;s email.
              </p>
            </div>
          </DialogHeader>

          <div className="modal-body">
            {inviteUrl ? (
              <>
                {inviteEmailSent ? (
                  <div className="invite-email-badge invite-email-badge--ok">
                    <MailCheck className="h-4 w-4" />
                    <span>Invitation email sent to the user</span>
                  </div>
                ) : inviteEmailError ? (
                  <div className="invite-email-badge invite-email-badge--err">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Email could not be sent ({inviteEmailError}). Share the link manually:</span>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: "var(--t-text-4)", marginBottom: 12 }}>
                    Invitation created. Share this link with the user so they can activate
                    their account:
                  </p>
                )}
                <div className="invite-url-box">
                  <code className="invite-url">{inviteUrl}</code>
                  <button
                    type="button"
                    className="invite-copy-btn"
                    onClick={() => copyToClipboard(inviteUrl)}
                  >
                    {urlCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {urlCopied ? "Copied" : "Copy"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="modal-grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
                  <div className="modal-field">
                    <label className="modal-label">Email address *</label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="teammate@company.com"
                      autoFocus
                    />
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Role</label>
                    <Select value={inviteRole} onValueChange={(v) => v && setInviteRole(v as "admin" | "user")}>
                      <SelectTrigger>
                        <span>{inviteRole === "admin" ? "Admin" : "User"}</span>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {canCreate.includes("user") && <SelectItem value="user">User</SelectItem>}
                        {canCreate.includes("admin") && <SelectItem value="admin">Admin</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="modal-footer">
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              {inviteUrl ? "Close" : "Cancel"}
            </Button>
            {!inviteUrl && (
              <Button onClick={handleInvite} disabled={inviting} className="modal-save-btn">
                {inviting ? "Sending..." : "Send invitation"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editUser !== null} onOpenChange={(v) => !v && setEditUser(null)}>
        <DialogContent className="sm:max-w-md modal-card">
          <DialogHeader className="modal-header">
            <div className="modal-header-icon">
              <Pencil className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="modal-title">
                Edit {editUser?.role === "admin" ? "admin" : "user"}
              </DialogTitle>
              <p className="modal-subtitle">{editUser?.email}</p>
            </div>
          </DialogHeader>
          <div className="modal-body">
            <div className="modal-grid">
              <div className="modal-field">
                <label className="modal-label">First name</label>
                <Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
              </div>
              <div className="modal-field">
                <label className="modal-label">Last name</label>
                <Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
              </div>
            </div>

            {callerRole === "super_admin" && editUser && editUser.role !== "super_admin" && (
              <div className="modal-field">
                <label className="modal-label">Role</label>
                <Select value={editRole} onValueChange={(v) => v && setEditRole(v as "admin" | "user")}>
                  <SelectTrigger>
                    <span>{editRole === "admin" ? "Admin" : "User"}</span>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="modal-field">
              <label className="modal-label">Status</label>
              <Select value={editStatus} onValueChange={(v) => v && setEditStatus(v)}>
                <SelectTrigger>
                  <span>{editStatus[0].toUpperCase() + editStatus.slice(1)}</span>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="modal-footer">
            <Button variant="outline" onClick={() => setEditUser(null)}>
              <XIcon className="mr-1.5 h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit} className="modal-save-btn">
              {savingEdit ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close-account confirm */}
      <Dialog open={closeUser !== null} onOpenChange={(v) => !v && setCloseUser(null)}>
        <DialogContent className="sm:max-w-sm modal-card">
          <DialogHeader className="modal-header">
            <div className="modal-header-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="modal-title">Close account?</DialogTitle>
              <p className="modal-subtitle">
                This revokes {closeUser?.email}&apos;s access immediately.
              </p>
            </div>
          </DialogHeader>
          <DialogFooter className="modal-footer">
            <Button variant="outline" onClick={() => setCloseUser(null)}>Cancel</Button>
            <Button onClick={handleClose} disabled={closing} style={{ background: "#dc2626", color: "#fff" }}>
              <Ban className="mr-1.5 h-4 w-4" />
              {closing ? "Closing..." : "Close account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password link dialog */}
      <Dialog open={resetUser !== null} onOpenChange={(v) => !v && setResetUser(null)}>
        <DialogContent className="sm:max-w-md modal-card">
          <DialogHeader className="modal-header">
            <div className="modal-header-icon">
              <MailCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="modal-title">Password reset link</DialogTitle>
              <p className="modal-subtitle">
                Share this with {resetUser?.email} so they can set a new password.
              </p>
            </div>
          </DialogHeader>
          <div className="modal-body">
            {resetting && !resetUrl ? (
              <p>Generating link...</p>
            ) : (
              resetUrl && (
                <>
                  {resetEmailSent && (
                    <div className="invite-email-badge invite-email-badge--ok" style={{ marginBottom: 10 }}>
                      <MailCheck className="h-4 w-4" />
                      <span>Reset email sent to {resetUser?.email}</span>
                    </div>
                  )}
                  <div className="invite-url-box">
                    <code className="invite-url">{resetUrl}</code>
                    <button
                      type="button"
                      className="invite-copy-btn"
                      onClick={() => copyToClipboard(resetUrl)}
                    >
                      {urlCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {urlCopied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </>
              )
            )}
          </div>
          <DialogFooter className="modal-footer">
            <Button variant="outline" onClick={() => setResetUser(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
