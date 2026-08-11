"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { MessageSquare, Mail, Lock, User as UserIcon, Eye, EyeOff, Loader2, Check as CheckIcon } from "lucide-react";
import AuthBackground from "@/components/auth/AuthBackground";
import { toast } from "sonner";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

interface InviteInfo {
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  isReset: boolean;
}

export default function InvitePage({ params }: InvitePageProps) {
  const { token } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const isReset = search.get("reset") === "1";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState<InviteInfo | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/invite/${token}`);
        const json = await res.json();
        if (!json.success) {
          setError(json.error || "Invalid invitation");
        } else {
          setInvite(json.data);
          if (json.data.firstName) setFirstName(json.data.firstName);
          if (json.data.lastName) setLastName(json.data.lastName);
        }
      } catch {
        setError("Failed to load invitation");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First and last name required");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, password }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Activation failed");
        setSubmitting(false);
        return;
      }
      toast.success(
        isReset || invite?.isReset ? "Password updated — signing you in" : "Account activated — signing you in"
      );
      // Auto sign-in
      const signRes = await signIn("credentials", {
        username: json.data.email,
        password,
        redirect: false,
      });
      if (signRes?.error) {
        setError("Activation complete but sign-in failed. Please log in manually.");
        router.push("/login");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Network error");
      setSubmitting(false);
    }
  }

  const heading = isReset || invite?.isReset ? "Reset your password" : "Activate your account";
  const sub =
    isReset || invite?.isReset
      ? "Choose a new password to continue."
      : "Set your name and password to get started.";

  return (
    <div className="auth-page">
      <AuthBackground />

      <div className="auth-shell">
        <div className="auth-left">
          <div className="auth-brand">
            <div className="auth-brand-icon">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="auth-brand-title">SMSLocal</h1>
              <p className="auth-brand-sub">BSS Platform</p>
            </div>
          </div>

          <div className="auth-hero">
            <h2 className="auth-hero-title">
              You&apos;ve been invited to <span className="auth-hero-accent">join the team.</span>
            </h2>
            <p className="auth-hero-sub">
              Once you activate your account, you&apos;ll have access to the shared SMS
              workspace — campaigns, contacts, templates, and real-time delivery reports.
            </p>
          </div>

          <div className="auth-left-footer">
            <span>© 2026 SMSLocal</span>
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-card">
            <div className="auth-card-header">
              <h3 className="auth-card-title">{heading}</h3>
              <p className="auth-card-sub">{sub}</p>
            </div>

            {loading ? (
              <div style={{ padding: "40px 0", textAlign: "center" }}>
                <Loader2 className="h-6 w-6 animate-spin" style={{ margin: "0 auto", color: "#6366f1" }} />
                <p style={{ marginTop: 12, fontSize: 13, color: "#64748b" }}>Loading invitation...</p>
              </div>
            ) : error && !invite ? (
              <div className="auth-error">
                <strong>Invitation problem</strong>
                <p style={{ margin: "4px 0 0", fontSize: 12 }}>{error}</p>
              </div>
            ) : invite ? (
              <>
                <div className="invite-info-card">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <strong>{invite.email}</strong>
                  </div>
                  <div className="invite-info-role">
                    {invite.role === "admin" ? "Admin account" : "User account"}
                  </div>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                  {!(isReset || invite.isReset) && (
                    <div className="auth-grid-2">
                      <div className="auth-field">
                        <label className="auth-label">First name</label>
                        <div className="auth-input-wrap">
                          <UserIcon className="auth-input-icon" />
                          <input
                            type="text"
                            className="auth-input"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="auth-field">
                        <label className="auth-label">Last name</label>
                        <div className="auth-input-wrap">
                          <UserIcon className="auth-input-icon" />
                          <input
                            type="text"
                            className="auth-input"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="auth-field">
                    <label className="auth-label">
                      {isReset || invite.isReset ? "New password" : "Create password"}
                    </label>
                    <div className="auth-input-wrap">
                      <Lock className="auth-input-icon" />
                      <input
                        type={showPwd ? "text" : "password"}
                        className="auth-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 chars, letters + numbers"
                        autoComplete="new-password"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        className="auth-input-btn"
                        onClick={() => setShowPwd((s) => !s)}
                        tabIndex={-1}
                      >
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" className="auth-submit" disabled={submitting}>
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckIcon className="mr-1.5 h-4 w-4" />
                        {isReset || invite.isReset ? "Update password" : "Activate account"}
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
