"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { MessageSquare, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

function PlatformBackground() {
  return (
    <svg className="lp-bg-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <pattern id="lp-dots" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="#c7d2fe" />
        </pattern>
        <linearGradient id="lp-base" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f0f4ff" />
          <stop offset="55%" stopColor="#f5f7ff" />
          <stop offset="100%" stopColor="#eef2ff" />
        </linearGradient>
        <radialGradient id="lp-vignette" cx="50%" cy="50%" r="70%">
          <stop offset="20%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="0.7" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#lp-base)" />
      <rect width="100%" height="100%" fill="url(#lp-dots)" opacity="0.5" />
      <ellipse cx="14%" cy="18%" rx="200" ry="130" fill="#e0e7ff" opacity="0.3" />
      <ellipse cx="86%" cy="78%" rx="220" ry="140" fill="#dde4ff" opacity="0.25" />
      <ellipse cx="50%" cy="96%" rx="320" ry="70" fill="#ede9fe" opacity="0.18" />
      <g opacity="0.18" stroke="#6366f1" strokeWidth="1" fill="none">
        <line x1="8%" y1="18%" x2="18%" y2="32%" />
        <line x1="18%" y1="32%" x2="12%" y2="52%" />
        <line x1="18%" y1="32%" x2="28%" y2="45%" />
        <line x1="12%" y1="52%" x2="22%" y2="65%" />
        <line x1="5%" y1="70%" x2="12%" y2="52%" />
        <line x1="22%" y1="65%" x2="28%" y2="45%" />
        <line x1="28%" y1="45%" x2="35%" y2="28%" />
        <line x1="35%" y1="28%" x2="18%" y2="32%" />
        <line x1="35%" y1="28%" x2="45%" y2="18%" />
        <line x1="5%" y1="35%" x2="8%" y2="18%" />
        <line x1="5%" y1="35%" x2="18%" y2="32%" />
        <line x1="72%" y1="15%" x2="82%" y2="28%" />
        <line x1="82%" y1="28%" x2="88%" y2="45%" />
        <line x1="88%" y1="45%" x2="78%" y2="58%" />
        <line x1="78%" y1="58%" x2="85%" y2="72%" />
        <line x1="72%" y1="15%" x2="65%" y2="30%" />
        <line x1="92%" y1="30%" x2="88%" y2="45%" />
        <line x1="78%" y1="58%" x2="68%" y2="68%" />
        <line x1="18%" y1="82%" x2="30%" y2="75%" />
        <line x1="30%" y1="75%" x2="42%" y2="82%" />
        <line x1="42%" y1="82%" x2="55%" y2="76%" />
        <line x1="55%" y1="76%" x2="68%" y2="68%" />
      </g>
      <g opacity="0.3">
        {[[8,18],[18,32],[12,52],[5,70],[22,65],[28,45],[35,28],[45,18],[5,35],[65,30],[72,15],[82,28],[88,45],[78,58],[85,72],[92,30],[68,68],[18,82],[30,75],[42,82],[55,76]].map(([x,y],i) => (
          <circle key={i} cx={x+"%"} cy={y+"%"} r={i%4===0?"5":i%3===0?"3.5":"2.5"} fill={i%3===0?"#818cf8":"#c7d2fe"} stroke="#6366f1" strokeWidth="0.8" opacity="0.7" />
        ))}
      </g>
      <rect width="100%" height="100%" fill="url(#lp-vignette)" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { username: loginId, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid credentials. Please try again.");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="lp-root">
      <PlatformBackground />
      <div className="lp-card">
        <div className="lp-logo-wrap">
          <div className="lp-logo-icon">
            <MessageSquare className="lp-logo-svg" />
          </div>
        </div>
        <h1 className="lp-title">SMSLocal BSS</h1>
        <p className="lp-subtitle">Sign in to your account</p>
        {error && <div className="lp-error">{error}</div>}
        <form onSubmit={handleLogin} className="lp-form">
          <div className="lp-field">
            <label className="lp-label">Email or Username</label>
            <div className="lp-input-wrap">
              <Mail className="lp-input-icon" />
              <input type="text" className="lp-input" placeholder="Enter email or username" value={loginId} onChange={e => setLoginId(e.target.value)} autoComplete="username" required autoFocus />
            </div>
          </div>
          <div className="lp-field">
            <label className="lp-label">Password</label>
            <div className="lp-input-wrap">
              <Lock className="lp-input-icon" />
              <input type={showPwd ? "text" : "password"} className="lp-input" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
              <button type="button" className="lp-eye-btn" onClick={() => setShowPwd(s => !s)} tabIndex={-1}>
                {showPwd ? <EyeOff className="lp-eye-icon" /> : <Eye className="lp-eye-icon" />}
              </button>
            </div>
          </div>
          <button type="submit" className="lp-submit" disabled={loading}>
            {loading ? <><Loader2 className="lp-spin" />Signing in…</> : "Sign in"}
          </button>
        </form>
        <p className="lp-footer-note">Authorized access only · Contact your administrator for support</p>
      </div>
    </div>
  );
}
