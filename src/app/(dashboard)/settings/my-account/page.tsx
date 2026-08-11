"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
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
  Pencil,
  Save,
  X as XIcon,
  UserCircle,
  Shield,
  Bell,
  Check as CheckIcon,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { countries } from "@/lib/countries";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Tab = "account" | "security" | "notifications";

interface MeUser {
  id: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  country: string | null;
  countryCode: string | null;
  timezone: string | null;
  timeFormat: string | null;
  role: string;
  status: string;
}

const TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
];

function roleLabel(role: string): string {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Administrator";
  if (role === "user") return "User";
  return role;
}

export default function MyAccountPage() {
  const [tab, setTab] = useState<Tab>("account");
  const { data, mutate } = useSWR<{ success: boolean; data: MeUser }>("/api/me", fetcher);
  const me = data?.data;

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState<string>("IN");
  const [timezone, setTimezone] = useState("UTC");
  const [timeFormat, setTimeFormat] = useState("24h");
  const [saving, setSaving] = useState(false);

  // Security state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  useEffect(() => {
    if (me) {
      setFirstName(me.firstName || "");
      setLastName(me.lastName || "");
      setPhoneNumber(me.phoneNumber || "");
      setCountry(me.countryCode || "IN");
      setTimezone(me.timezone || "UTC");
      setTimeFormat(me.timeFormat || "24h");
    }
  }, [me]);

  async function handleSave() {
    setSaving(true);
    try {
      const selCountry = countries.find((c) => c.code === country);
      const res = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          phoneNumber,
          country: selCountry?.name || country,
          countryCode: country,
          timezone,
          timeFormat,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Update failed");
        return;
      }
      toast.success("Account details updated");
      setEditing(false);
      mutate();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!newPassword) {
      toast.error("New password is required");
      return;
    }
    setChangingPwd(true);
    try {
      const res = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Password change failed");
        return;
      }
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      toast.error("Network error");
    } finally {
      setChangingPwd(false);
    }
  }

  const currentCountry = countries.find((c) => c.code === country) || countries[0];
  const selectedCountryName = me?.country || currentCountry.name;

  return (
    <>
      <div className="page-content">
        <PageBreadcrumb crumbs={[{ label: "Settings" }, { label: "My account" }]} />

        <h1 className="settings-page-title">My account</h1>

        <div className="account-tabs">
          <button
            className={`account-tab ${tab === "account" ? "account-tab--active" : ""}`}
            onClick={() => setTab("account")}
          >
            <UserCircle className="h-4 w-4" />
            Account details
          </button>
          <button
            className={`account-tab ${tab === "security" ? "account-tab--active" : ""}`}
            onClick={() => setTab("security")}
          >
            <Shield className="h-4 w-4" />
            Security
          </button>
          <button
            className={`account-tab ${tab === "notifications" ? "account-tab--active" : ""}`}
            onClick={() => setTab("notifications")}
          >
            <Bell className="h-4 w-4" />
            Notifications
          </button>
        </div>

        {tab === "account" && (
          <div className="account-panel">
            {!editing ? (
              <div style={{ marginBottom: 16 }}>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Edit account details
                </Button>
              </div>
            ) : (
              <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
                <Button onClick={handleSave} disabled={saving} className="modal-save-btn">
                  <Save className="mr-1.5 h-4 w-4" />
                  {saving ? "Saving..." : "Save changes"}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  <XIcon className="mr-1.5 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            )}

            <div className="account-table">
              <div className="account-row">
                <div className="account-row-label">Username</div>
                <div className="account-row-value">{me?.username || "—"}</div>
              </div>

              <div className="account-row">
                <div className="account-row-label">Account owner</div>
                <div className="account-row-value">
                  {editing ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <Input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First name"
                      />
                      <Input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Last name"
                      />
                    </div>
                  ) : (
                    me?.fullName || "—"
                  )}
                </div>
              </div>

              <div className="account-row">
                <div className="account-row-label">Role</div>
                <div className="account-row-value">
                  <span className={`role-pill role-pill--${me?.role}`}>
                    {me ? roleLabel(me.role) : "—"}
                  </span>
                </div>
              </div>

              <div className="account-row">
                <div className="account-row-label">Contact email</div>
                <div className="account-row-value">
                  <span>{me?.email || "—"}</span>
                  {me?.emailVerified && (
                    <span className="verified-pill">
                      <CheckIcon className="h-3 w-3" />
                      Verified
                    </span>
                  )}
                </div>
              </div>

              <div className="account-row">
                <div className="account-row-label">Mobile number</div>
                <div className="account-row-value">
                  {editing ? (
                    <Input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+91 9876543210"
                    />
                  ) : (
                    me?.phoneNumber || <span className="account-add-link">Add number</span>
                  )}
                </div>
              </div>

              <div className="account-row">
                <div className="account-row-label">Time zone</div>
                <div className="account-row-value">
                  {editing ? (
                    <Select value={timezone} onValueChange={(v) => v && setTimezone(v)}>
                      <SelectTrigger>
                        <span>{timezone}</span>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    me?.timezone || "UTC"
                  )}
                </div>
              </div>

              <div className="account-row">
                <div className="account-row-label">Time display format</div>
                <div className="account-row-value">
                  {editing ? (
                    <Select value={timeFormat} onValueChange={(v) => v && setTimeFormat(v)}>
                      <SelectTrigger>
                        <span>{timeFormat === "24h" ? "24-hour clock" : "12-hour clock"}</span>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectItem value="24h">24-hour clock</SelectItem>
                        <SelectItem value="12h">12-hour clock</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    me?.timeFormat === "12h" ? "12-hour clock" : "24-hour clock"
                  )}
                </div>
              </div>

              <div className="account-row">
                <div className="account-row-label">Registration country</div>
                <div className="account-row-value">
                  {editing ? (
                    <Select value={country} onValueChange={(v) => v && setCountry(v)}>
                      <SelectTrigger>
                        <span>{currentCountry.flag} {currentCountry.name}</span>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {countries.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.flag} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      <span className="auth-country-flag" style={{ marginRight: 6 }}>
                        {currentCountry.flag}
                      </span>
                      {selectedCountryName}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "security" && (
          <div className="account-panel">
            <h3 className="panel-h3">Change password</h3>
            <p className="panel-sub">Passwords must be 8+ chars and contain letters and numbers.</p>
            <div className="security-form">
              <div className="auth-field">
                <label className="auth-label">Current password</label>
                <div className="auth-input-wrap">
                  <Lock className="auth-input-icon" />
                  <input
                    type={showPwd ? "text" : "password"}
                    className="auth-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                  />
                  <button
                    type="button"
                    className="auth-input-btn"
                    onClick={() => setShowPwd((s) => !s)}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="auth-field">
                <label className="auth-label">New password</label>
                <div className="auth-input-wrap">
                  <Lock className="auth-input-icon" />
                  <input
                    type={showPwd ? "text" : "password"}
                    className="auth-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </div>
              </div>
              <Button onClick={handleChangePassword} disabled={changingPwd} className="modal-save-btn">
                <Save className="mr-1.5 h-4 w-4" />
                {changingPwd ? "Updating..." : "Update password"}
              </Button>
            </div>
          </div>
        )}

        {tab === "notifications" && (
          <div className="account-panel">
            <h3 className="panel-h3">Notification preferences</h3>
            <p className="panel-sub">Notification settings will be available soon.</p>
          </div>
        )}
      </div>
    </>
  );
}
