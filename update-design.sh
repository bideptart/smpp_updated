#!/bin/bash
# SMSLocal BSS v2 - Design Update Script
set -e
APP_DIR="/var/www/v2-smslocal-bss"
echo "Updating design files..."

# 1. Sidebar.tsx
cat > "$APP_DIR/src/components/layout/Sidebar.tsx" << 'SIDEBAR_EOF'
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Send,
  Building2,
  Cable,
  Activity,
  Users,
  UserPlus,
  BarChart3,
  Route,
  ChevronDown,
  Signal,
  Gauge,
} from "lucide-react";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Send SMS", href: "/send-sms", icon: Send },
  { name: "Companies", href: "/companies", icon: Building2 },
  {
    name: "Connections",
    icon: Cable,
    children: [
      { name: "Manage", href: "/connections", icon: Cable },
      { name: "Live Status", href: "/connections/status", icon: Activity },
    ],
  },
  {
    name: "Customers",
    icon: Users,
    children: [
      { name: "SMPP Accounts", href: "/customers", icon: UserPlus },
      { name: "Live Status", href: "/customers/live-status", icon: Gauge },
      { name: "Reports", href: "/customers/reports", icon: BarChart3 },
    ],
  },
  { name: "Routes", href: "/routes", icon: Route },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Connections: true,
    Customers: true,
  });

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const toggleGroup = (name: string) => {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <aside className="sidebar-root">
      {/* Logo Section */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Signal className="h-5 w-5 text-white" />
        </div>
        <div className="sidebar-logo-text">
          <h1>SMSLocal</h1>
          <p>BSS Platform</p>
        </div>
      </div>

      {/* Navigation - Scrollable Area */}
      <nav className="sidebar-nav">
        <div className="sidebar-nav-label">MAIN MENU</div>
        <ul className="sidebar-nav-list">
          {navigation.map((item) => {
            if (item.children) {
              const isGroupActive = item.children.some((c) =>
                isActive(c.href)
              );
              const isOpen = expanded[item.name];
              return (
                <li key={item.name}>
                  <button
                    onClick={() => toggleGroup(item.name)}
                    className={`sidebar-nav-item ${
                      isGroupActive ? "sidebar-nav-item--group-active" : ""
                    }`}
                  >
                    <item.icon className="sidebar-nav-icon" />
                    <span className="sidebar-nav-label-text">{item.name}</span>
                    <ChevronDown
                      className={`sidebar-chevron ${isOpen ? "sidebar-chevron--open" : ""}`}
                    />
                  </button>
                  <ul
                    className={`sidebar-submenu ${isOpen ? "sidebar-submenu--open" : ""}`}
                  >
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className={`sidebar-submenu-item ${
                            isActive(child.href) ? "sidebar-submenu-item--active" : ""
                          }`}
                        >
                          <span className="sidebar-submenu-dot" />
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            }
            return (
              <li key={item.name}>
                <Link
                  href={item.href!}
                  className={`sidebar-nav-item ${
                    isActive(item.href!) ? "sidebar-nav-item--active" : ""
                  }`}
                >
                  <item.icon className="sidebar-nav-icon" />
                  <span className="sidebar-nav-label-text">{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-status">
          <span className="sidebar-footer-dot" />
          <span>System Online</span>
        </div>
        <p className="sidebar-footer-version">SMSLocal BSS v2.0</p>
      </div>
    </aside>
  );
}
SIDEBAR_EOF
echo "  [1/17] Sidebar.tsx updated"

# 2. TopBar.tsx
cat > "$APP_DIR/src/components/layout/TopBar.tsx" << 'TOPBAR_EOF'
"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { LogOut, Bell, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TopBar({ title }: { title?: string }) {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const { data: session } = useSession();

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
      setDate(
        now.toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h2 className="topbar-title">{title || "Dashboard"}</h2>
      </div>
      <div className="topbar-right">
        {/* Live Indicator */}
        <div className="topbar-live-badge">
          <span className="topbar-live-dot" />
          <span className="topbar-live-text">LIVE</span>
        </div>

        {/* Clock */}
        <div className="topbar-clock">
          <span className="topbar-clock-time">{time}</span>
          <span className="topbar-clock-date">{date}</span>
        </div>

        {/* Divider */}
        <div className="topbar-divider" />

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="topbar-icon-btn">
          <Bell className="h-[18px] w-[18px]" />
        </Button>

        {/* User */}
        <div className="topbar-user">
          <div className="topbar-user-avatar">
            <User className="h-4 w-4 text-white" />
          </div>
          <span className="topbar-user-name">
            {session?.user?.name || "Admin"}
          </span>
        </div>

        {/* Logout */}
        <Button
          variant="ghost"
          size="icon"
          className="topbar-icon-btn topbar-icon-btn--danger"
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Logout"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </Button>
      </div>
    </header>
  );
}
TOPBAR_EOF
echo "  [2/17] TopBar.tsx updated"

# 3. Dashboard layout.tsx
cat > "$APP_DIR/src/app/(dashboard)/layout.tsx" << 'LAYOUT_EOF'
import Sidebar from "@/components/layout/Sidebar";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <TooltipProvider>
        <div className="app-layout">
          <Sidebar />
          <main className="app-main">{children}</main>
        </div>
        <Toaster position="top-right" richColors />
      </TooltipProvider>
    </SessionProvider>
  );
}
LAYOUT_EOF
echo "  [3/17] layout.tsx updated"

# 4. globals.css
cat > "$APP_DIR/src/app/globals.css" << 'GLOBALS_EOF'
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}

/* ============================================================
   PROFESSIONAL SMS PLATFORM DESIGN SYSTEM
   ============================================================ */

/* --- App Layout --- */
.app-layout {
  display: flex;
  min-height: 100vh;
  background: #f1f5f9;
}

.app-main {
  margin-left: 260px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* --- Sidebar --- */
.sidebar-root {
  position: fixed;
  inset: 0;
  right: auto;
  z-index: 50;
  width: 260px;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #0c1425 0%, #111d35 100%);
  color: #fff;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.15);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-logo-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
}

.sidebar-logo-text h1 {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #fff;
}

.sidebar-logo-text p {
  font-size: 11px;
  color: #64748b;
  letter-spacing: 0.02em;
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 12px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}

.sidebar-nav::-webkit-scrollbar {
  width: 4px;
}

.sidebar-nav::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-nav::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

.sidebar-nav::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

.sidebar-nav-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #475569;
  padding: 0 12px;
  margin-bottom: 8px;
  text-transform: uppercase;
}

.sidebar-nav-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 500;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  text-decoration: none;
}

.sidebar-nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
}

.sidebar-nav-item--active {
  background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
  color: #fff !important;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.35);
}

.sidebar-nav-item--group-active {
  color: #60a5fa;
}

.sidebar-nav-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.sidebar-nav-label-text {
  flex: 1;
  text-align: left;
}

.sidebar-chevron {
  width: 14px;
  height: 14px;
  transition: transform 0.2s ease;
  color: #475569;
}

.sidebar-chevron--open {
  transform: rotate(0deg);
}

.sidebar-chevron:not(.sidebar-chevron--open) {
  transform: rotate(-90deg);
}

.sidebar-submenu {
  list-style: none;
  padding: 0;
  margin: 0 0 0 20px;
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: all 0.2s ease;
}

.sidebar-submenu--open {
  max-height: 200px;
  opacity: 1;
  padding-top: 4px;
  padding-bottom: 4px;
}

.sidebar-submenu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: #64748b;
  text-decoration: none;
  transition: all 0.15s ease;
  border-left: 2px solid transparent;
  margin-left: 8px;
}

.sidebar-submenu-item:hover {
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.04);
}

.sidebar-submenu-item--active {
  color: #60a5fa !important;
  background: rgba(59, 130, 246, 0.1) !important;
  border-left-color: #3b82f6;
}

.sidebar-submenu-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.5;
}

.sidebar-submenu-item--active .sidebar-submenu-dot {
  opacity: 1;
  background: #3b82f6;
}

.sidebar-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-footer-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.sidebar-footer-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
  animation: pulse-green 2s infinite;
}

@keyframes pulse-green {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.sidebar-footer-version {
  font-size: 10px;
  color: #334155;
  margin: 0;
}

/* --- TopBar --- */
.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.topbar-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.topbar-live-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
}

.topbar-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse-green 2s infinite;
}

.topbar-live-text {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #059669;
}

.topbar-clock {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.topbar-clock-time {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #334155;
}

.topbar-clock-date {
  font-size: 10px;
  color: #94a3b8;
}

.topbar-divider {
  width: 1px;
  height: 28px;
  background: #e2e8f0;
}

.topbar-icon-btn {
  width: 34px !important;
  height: 34px !important;
  border-radius: 8px !important;
  color: #64748b;
}

.topbar-icon-btn:hover {
  background: #f1f5f9;
  color: #334155;
}

.topbar-icon-btn--danger:hover {
  background: #fef2f2;
  color: #dc2626;
}

.topbar-user {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topbar-user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  display: flex;
  align-items: center;
  justify-content: center;
}

.topbar-user-name {
  font-size: 13px;
  font-weight: 500;
  color: #334155;
}

/* --- Page Content --- */
.page-content {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-subtitle {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}

/* --- Summary Cards --- */
.summary-cards-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
}

@media (max-width: 1200px) {
  .summary-cards-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .summary-cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.summary-card {
  position: relative;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.summary-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.summary-card-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.summary-card-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.summary-card-content {
  min-width: 0;
}

.summary-card-label {
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  margin: 0 0 2px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.summary-card-value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  margin: 0;
}

.summary-card-accent {
  height: 3px;
  width: 100%;
}

/* --- Filter Bar --- */
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.filter-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-bar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-select {
  height: 34px !important;
  font-size: 12px !important;
  min-width: 140px;
  border-radius: 6px !important;
}

.filter-auto-refresh {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-auto-label {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
}

.filter-refresh-btn {
  height: 34px !important;
  font-size: 12px !important;
  gap: 6px;
  border-radius: 6px !important;
}

/* --- Chart Container --- */
.chart-container {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.chart-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.chart-subtitle {
  font-size: 12px;
  color: #94a3b8;
}

/* --- Traffic Table (Professional Data Grid) --- */
.tt-container {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.tt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.tt-head-row {
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
}

.tt-head-cell {
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-align: left;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.tt-head-cell--name {
  min-width: 240px;
}

.tt-head-icon {
  font-size: 14px;
  color: #94a3b8;
}

.tt-row {
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.1s ease;
}

.tt-row--data {
  cursor: pointer;
}

.tt-row--data:hover {
  background: #f8fafc;
}

.tt-row--expanded {
  background: #eff6ff;
}

.tt-row--total {
  background: #f1f5f9;
  font-weight: 600;
  border-bottom: 2px solid #e2e8f0;
}

.tt-row--sub {
  background: #fafbfc;
}

.tt-row--empty {
  background: transparent;
}

.tt-cell {
  padding: 10px 14px;
  vertical-align: middle;
}

.tt-cell--name {
  font-weight: 500;
  color: #1e293b;
  white-space: nowrap;
}

.tt-cell--num {
  font-variant-numeric: tabular-nums;
  text-align: left;
}

.tt-cell--success {
  color: #059669;
}

.tt-cell--danger {
  color: #dc2626;
}

.tt-cell--muted {
  color: #94a3b8;
  font-size: 12px;
}

.tt-cell--rate {
  font-size: 12px;
  color: #64748b;
}

.tt-cell--center {
  text-align: center;
  color: #94a3b8;
  padding: 20px;
}

.tt-cell--empty {
  text-align: center;
  color: #94a3b8;
  padding: 40px;
  font-size: 13px;
}

.tt-cell--indent {
  padding-left: 48px;
  font-size: 12px;
  color: #64748b;
}

.tt-company-name {
  font-weight: 600;
  color: #1e293b;
}

.tt-company-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  margin-left: 8px;
  vertical-align: middle;
}

.tt-company-badge--customer {
  background: #dbeafe;
  color: #2563eb;
}

.tt-company-badge--vendor {
  background: #fef3c7;
  color: #d97706;
}

/* --- Percentage Cell --- */
.pct-cell {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  min-width: 60px;
  text-align: center;
}

.pct-cell--success {
  background: #d1fae5;
  color: #059669;
}

.pct-cell--info {
  background: #dbeafe;
  color: #2563eb;
}

.pct-cell--warn {
  background: #fef3c7;
  color: #d97706;
}

.pct-cell--danger {
  background: #fee2e2;
  color: #dc2626;
}

.pct-cell--muted {
  background: #f1f5f9;
  color: #94a3b8;
}

/* --- Section Block --- */
.section-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.section-badge {
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 10px;
  border-radius: 12px;
}

/* --- Connection Status Page --- */
.status-summary-row {
  display: flex;
  gap: 12px;
}

.status-summary-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  flex: 1;
}

.status-summary-card--total {
  color: #3b82f6;
}

.status-summary-card--online {
  color: #10b981;
}

.status-summary-card--offline {
  color: #ef4444;
}

.status-summary-card--unchecked {
  color: #94a3b8;
}

.status-summary-value {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.status-summary-label {
  font-size: 12px;
  color: #64748b;
}

.conn-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.conn-status-card {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  padding: 16px;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.conn-status-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.conn-status-card--online {
  border-left: 3px solid #10b981;
}

.conn-status-card--offline {
  border-left: 3px solid #ef4444;
}

.conn-status-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.conn-status-card-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.conn-status-card-company {
  font-size: 12px;
  color: #64748b;
  margin: 2px 0 0;
}

.conn-status-card-endpoint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
  padding: 8px 10px;
  background: #f8fafc;
  border-radius: 6px;
  margin-bottom: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conn-status-card-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.conn-status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.conn-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.conn-status-dot--online {
  background: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
}

.conn-status-dot--offline {
  background: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
}

.conn-status-dot--unknown {
  background: #cbd5e1;
}

.conn-status-test-btn {
  height: 30px !important;
  font-size: 12px !important;
  border-radius: 6px !important;
}

.conn-status-details {
  margin-top: 12px;
  padding: 10px;
  background: #f8fafc;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.conn-status-detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #64748b;
}

.conn-status-detail-value {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  color: #334155;
}

/* --- Server Status --- */
.server-status-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 1024px) {
  .server-status-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.server-status-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.server-status-card--online {
  border-left: 3px solid #10b981;
}

.server-status-card--offline {
  border-left: 3px solid #ef4444;
}

.server-status-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ecfdf5;
  color: #059669;
}

.server-status-icon-wrap--blue {
  background: #eff6ff;
  color: #2563eb;
}

.server-status-icon-wrap--purple {
  background: #f5f3ff;
  color: #7c3aed;
}

.server-status-icon-wrap--amber {
  background: #fffbeb;
  color: #d97706;
}

.server-status-label {
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin: 0;
}

.server-status-value {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin: 2px 0 0;
}

.server-status-value-lg {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  margin: 2px 0 0;
}

.server-status-hint {
  font-size: 11px;
  color: #94a3b8;
  margin: 2px 0 0;
}

/* --- Account Cards --- */
.account-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}

.account-card {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  padding: 16px;
  transition: box-shadow 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.account-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.account-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
}

.account-card-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.account-card-company {
  font-size: 12px;
  color: #64748b;
  margin: 2px 0 0;
}

.account-card-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.account-card-detail {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.account-card-detail-label {
  font-size: 10px;
  font-weight: 500;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.account-card-detail-value {
  font-size: 12px;
  font-weight: 500;
  color: #334155;
}

/* --- Empty State --- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-state-text {
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  margin: 12px 0 4px;
}

.empty-state-hint {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}

/* --- Button Styles --- */
.btn-primary-action {
  background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
  color: #fff !important;
  border: none !important;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3) !important;
  font-size: 13px !important;
  height: 38px !important;
  border-radius: 8px !important;
}

.btn-primary-action:hover {
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4) !important;
}

/* --- Global Table Polish --- */
.rounded-xl,
.rounded-lg {
  overflow: hidden;
}

/* --- Responsive --- */
@media (max-width: 768px) {
  .app-main {
    margin-left: 0;
  }

  .sidebar-root {
    transform: translateX(-100%);
  }

  .topbar {
    padding: 0 16px;
  }

  .page-content {
    padding: 16px;
  }

  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-bar-left,
  .filter-bar-right {
    flex-wrap: wrap;
  }
}
GLOBALS_EOF
echo "  [4/17] globals.css updated"

# 5. SummaryCards.tsx
cat > "$APP_DIR/src/components/dashboard/SummaryCards.tsx" << 'SUMMARYCARDS_EOF'
"use client";

import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Percent,
  Receipt,
  Building2,
} from "lucide-react";

interface TotalsData {
  submitted: number;
  delivered: number;
  failed: number;
  dlrRate: number;
  billable: number;
  activeCompanies: number;
}

const cards = [
  {
    key: "submitted",
    label: "Total Submitted",
    icon: MessageSquare,
    accent: "#3b82f6",
    bg: "#eff6ff",
  },
  {
    key: "delivered",
    label: "Delivered",
    icon: CheckCircle2,
    accent: "#10b981",
    bg: "#ecfdf5",
  },
  {
    key: "failed",
    label: "Failed",
    icon: XCircle,
    accent: "#ef4444",
    bg: "#fef2f2",
  },
  {
    key: "dlrRate",
    label: "DLR Rate",
    icon: Percent,
    accent: "#f59e0b",
    bg: "#fffbeb",
    suffix: "%",
  },
  {
    key: "billable",
    label: "Billable (C)",
    icon: Receipt,
    accent: "#14b8a6",
    bg: "#f0fdfa",
  },
  {
    key: "activeCompanies",
    label: "Active Companies",
    icon: Building2,
    accent: "#8b5cf6",
    bg: "#f5f3ff",
  },
];

export default function SummaryCards({ data }: { data?: TotalsData }) {
  return (
    <div className="summary-cards-grid">
      {cards.map((card) => {
        const value = data?.[card.key as keyof TotalsData] ?? 0;
        return (
          <div key={card.key} className="summary-card">
            <div className="summary-card-inner">
              <div
                className="summary-card-icon"
                style={{ backgroundColor: card.bg }}
              >
                <card.icon
                  className="h-5 w-5"
                  style={{ color: card.accent }}
                />
              </div>
              <div className="summary-card-content">
                <p className="summary-card-label">{card.label}</p>
                <p className="summary-card-value" style={{ color: card.accent }}>
                  {typeof value === "number" ? value.toLocaleString() : value}
                  {card.suffix || ""}
                </p>
              </div>
            </div>
            <div
              className="summary-card-accent"
              style={{ backgroundColor: card.accent }}
            />
          </div>
        );
      })}
    </div>
  );
}
SUMMARYCARDS_EOF
echo "  [5/17] SummaryCards.tsx updated"

# 6. FilterBar.tsx
cat > "$APP_DIR/src/components/dashboard/FilterBar.tsx" << 'FILTERBAR_EOF'
"use client";

import { RefreshCw, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface FilterBarProps {
  period: string;
  setPeriod: (v: string) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  autoRefresh: boolean;
  setAutoRefresh: (v: boolean) => void;
  countdown: number;
  onRefresh: () => void;
}

export default function FilterBar({
  period,
  setPeriod,
  sortBy,
  setSortBy,
  filterType,
  setFilterType,
  autoRefresh,
  setAutoRefresh,
  countdown,
  onRefresh,
}: FilterBarProps) {
  return (
    <div className="filter-bar">
      <div className="filter-bar-left">
        <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
          <SelectTrigger className="filter-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 1 Minute</SelectItem>
            <SelectItem value="5">Last 5 Minutes</SelectItem>
            <SelectItem value="15">Last 15 Minutes</SelectItem>
            <SelectItem value="60">Last 1 Hour</SelectItem>
            <SelectItem value="120">Last 2 Hours</SelectItem>
            <SelectItem value="240">Last 4 Hours</SelectItem>
            <SelectItem value="360">Last 6 Hours</SelectItem>
            <SelectItem value="720">Last 12 Hours</SelectItem>
            <SelectItem value="1440">Last 24 Hours</SelectItem>
            <SelectItem value="0">Today</SelectItem>
            <SelectItem value="-1">Yesterday</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => v && setSortBy(v)}>
          <SelectTrigger className="filter-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="submitted">Sort By Submitted</SelectItem>
            <SelectItem value="delivered">Sort By Delivered</SelectItem>
            <SelectItem value="failed">Sort By Failed</SelectItem>
            <SelectItem value="dlr">Sort By DLR%</SelectItem>
            <SelectItem value="asr">Sort By ASR%</SelectItem>
            <SelectItem value="name">Sort By Name</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={(v) => v && setFilterType(v)}>
          <SelectTrigger className="filter-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Filter Type: All</SelectItem>
            <SelectItem value="customer">Customers Only</SelectItem>
            <SelectItem value="vendor">Vendors Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="filter-bar-right">
        <div className="filter-auto-refresh">
          <Switch
            id="auto-refresh"
            checked={autoRefresh}
            onCheckedChange={setAutoRefresh}
          />
          <Label htmlFor="auto-refresh" className="filter-auto-label">
            Auto-refresh ({countdown}s)
          </Label>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="filter-refresh-btn"
          onClick={onRefresh}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
FILTERBAR_EOF
echo "  [6/17] FilterBar.tsx updated"

# 7. TrafficChart.tsx
cat > "$APP_DIR/src/components/dashboard/TrafficChart.tsx" << 'TRAFFICCHART_EOF'
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface CompanyTraffic {
  companyName: string;
  submitted: number;
  successful: number;
  failed: number;
}

export default function TrafficChart({ data }: { data: CompanyTraffic[] }) {
  if (!data.length) return null;

  const chartData = data.slice(0, 10).map((d) => ({
    name:
      d.companyName.length > 14
        ? d.companyName.slice(0, 14) + "..."
        : d.companyName,
    Delivered: d.successful,
    Failed: d.failed,
  }));

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3 className="chart-title">Traffic by Company</h3>
        <span className="chart-subtitle">
          Top {chartData.length} companies by volume
        </span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} barGap={4} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
            }}
            cursor={{ fill: "rgba(59, 130, 246, 0.05)" }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar dataKey="Delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
TRAFFICCHART_EOF
echo "  [7/17] TrafficChart.tsx updated"

# 8. TrafficTable.tsx
cat > "$APP_DIR/src/components/dashboard/TrafficTable.tsx" << 'TRAFFICTABLE_EOF'
"use client";

import { useState } from "react";
import useSWR from "swr";
import { ChevronDown, ChevronRight, Filter } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface CompanyTraffic {
  companyId: number;
  companyName: string;
  companyType: string;
  submitted: number;
  successful: number;
  failed: number;
  billableC: number;
  billableV: number;
  asr: number;
  dlr: number;
  cr: number;
  avgRateC: number;
  avgRateV: number;
}

function PctCell({ value }: { value: number }) {
  const bg =
    value >= 90
      ? "pct-cell--success"
      : value >= 70
        ? "pct-cell--info"
        : value >= 50
          ? "pct-cell--warn"
          : value > 0
            ? "pct-cell--danger"
            : "pct-cell--muted";
  return <span className={`pct-cell ${bg}`}>{value.toFixed(2)}%</span>;
}

function DatewiseRow({
  companyId,
  period,
}: {
  companyId: number;
  period: string;
}) {
  const { data } = useSWR(
    `/api/traffic/datewise?companyId=${companyId}&period=${period}`,
    fetcher
  );

  if (!data?.data?.length)
    return (
      <tr className="tt-row tt-row--empty">
        <td colSpan={11} className="tt-cell tt-cell--center">
          No minute-level data available
        </td>
      </tr>
    );

  return (
    <>
      {data.data.map(
        (
          row: {
            time: string;
            submitted: number;
            successful: number;
            failed: number;
            asr: number;
            dlr: number;
          },
          i: number
        ) => (
          <tr key={i} className="tt-row tt-row--sub">
            <td className="tt-cell tt-cell--indent">{row.time}</td>
            <td className="tt-cell tt-cell--num">{row.submitted}</td>
            <td className="tt-cell tt-cell--num tt-cell--success">{row.successful}</td>
            <td className="tt-cell tt-cell--num tt-cell--danger">{row.failed}</td>
            <td className="tt-cell tt-cell--num">-</td>
            <td className="tt-cell tt-cell--num">-</td>
            <td className="tt-cell">
              <PctCell value={row.asr} />
            </td>
            <td className="tt-cell">
              <PctCell value={row.dlr} />
            </td>
            <td className="tt-cell tt-cell--muted">0.00%</td>
            <td className="tt-cell tt-cell--muted">-</td>
            <td className="tt-cell tt-cell--muted">-</td>
          </tr>
        )
      )}
    </>
  );
}

export default function TrafficTable({
  data,
  period,
}: {
  data: CompanyTraffic[];
  period: string;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const totals = data.reduce(
    (acc, row) => ({
      submitted: acc.submitted + row.submitted,
      successful: acc.successful + row.successful,
      failed: acc.failed + row.failed,
      billableC: acc.billableC + row.billableC,
      billableV: acc.billableV + row.billableV,
    }),
    { submitted: 0, successful: 0, failed: 0, billableC: 0, billableV: 0 }
  );

  const totalAsr =
    totals.submitted > 0
      ? (totals.successful / totals.submitted) * 100
      : 0;
  const totalDlr =
    totals.successful > 0
      ? (totals.successful / totals.submitted) * 100
      : 0;

  return (
    <div className="tt-container">
      <table className="tt-table">
        <thead>
          <tr className="tt-head-row">
            <th className="tt-head-cell tt-head-cell--name">
              <span className="tt-head-icon">=</span>
            </th>
            <th className="tt-head-cell">Submitted</th>
            <th className="tt-head-cell">Successful</th>
            <th className="tt-head-cell">Failed</th>
            <th className="tt-head-cell">Billable (C)</th>
            <th className="tt-head-cell">Billable (V)</th>
            <th className="tt-head-cell">ASR%</th>
            <th className="tt-head-cell">DLR%</th>
            <th className="tt-head-cell">CR%</th>
            <th className="tt-head-cell">Avg. Rate (C)</th>
            <th className="tt-head-cell">Avg. Rate (V)</th>
          </tr>
        </thead>
        <tbody>
          {/* TOTALS ROW */}
          {data.length > 0 && (
            <tr className="tt-row tt-row--total">
              <td className="tt-cell tt-cell--name">
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 inline mr-2" />
                Total
              </td>
              <td className="tt-cell tt-cell--num">{totals.submitted.toLocaleString()}</td>
              <td className="tt-cell tt-cell--num">{totals.successful.toLocaleString()}</td>
              <td className="tt-cell tt-cell--num tt-cell--danger">{totals.failed.toLocaleString()}</td>
              <td className="tt-cell tt-cell--num">{totals.billableC}</td>
              <td className="tt-cell tt-cell--num">{totals.billableV}</td>
              <td className="tt-cell">
                <PctCell value={totalAsr} />
              </td>
              <td className="tt-cell">
                <PctCell value={totalDlr} />
              </td>
              <td className="tt-cell tt-cell--muted">0.00%</td>
              <td className="tt-cell tt-cell--muted">-</td>
              <td className="tt-cell tt-cell--muted">-</td>
            </tr>
          )}

          {data.length === 0 && (
            <tr className="tt-row">
              <td colSpan={11} className="tt-cell tt-cell--empty">
                No traffic data for this period
              </td>
            </tr>
          )}

          {data.map((row) => (
            <>
              <tr
                key={row.companyId}
                className={`tt-row tt-row--data ${
                  expanded === row.companyId ? "tt-row--expanded" : ""
                }`}
                onClick={() =>
                  setExpanded(expanded === row.companyId ? null : row.companyId)
                }
              >
                <td className="tt-cell tt-cell--name">
                  <Filter className="h-3 w-3 text-blue-500 inline mr-1.5" />
                  {expanded === row.companyId ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 inline mr-1.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 inline mr-1.5" />
                  )}
                  <span className="tt-company-name">{row.companyName}</span>
                  <span
                    className={`tt-company-badge ${
                      row.companyType === "customer"
                        ? "tt-company-badge--customer"
                        : "tt-company-badge--vendor"
                    }`}
                  >
                    {row.companyType === "customer"
                      ? "Customer Company"
                      : "Vendor Company"}
                  </span>
                </td>
                <td className="tt-cell tt-cell--num">{row.submitted.toLocaleString()}</td>
                <td className="tt-cell tt-cell--num">{row.successful.toLocaleString()}</td>
                <td className="tt-cell tt-cell--num tt-cell--danger">{row.failed.toLocaleString()}</td>
                <td className="tt-cell tt-cell--num">{row.billableC}</td>
                <td className="tt-cell tt-cell--num">{row.billableV}</td>
                <td className="tt-cell">
                  <PctCell value={row.asr} />
                </td>
                <td className="tt-cell">
                  <PctCell value={row.dlr} />
                </td>
                <td className="tt-cell tt-cell--muted">{row.cr.toFixed(2)}%</td>
                <td className="tt-cell tt-cell--num tt-cell--rate">
                  {row.avgRateC.toFixed(3)}
                </td>
                <td className="tt-cell tt-cell--num tt-cell--rate">
                  {row.avgRateV.toFixed(5)}
                </td>
              </tr>
              {expanded === row.companyId && (
                <DatewiseRow companyId={row.companyId} period={period} />
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
TRAFFICTABLE_EOF
echo "  [8/17] TrafficTable.tsx updated"

# 9. connections/status/page.tsx
mkdir -p "$APP_DIR/src/app/(dashboard)/connections/status"
cat > "$APP_DIR/src/app/(dashboard)/connections/status/page.tsx" << 'CONNSTATUS_EOF'
"use client";

import { useState } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  RefreshCw,
  Activity,
  Wifi,
  WifiOff,
  Clock,
  Zap,
  Server,
  Globe,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Connection {
  id: number;
  name: string;
  companyName: string;
  type: "SMPP" | "HTTP";
  host: string | null;
  port: number | null;
  apiUrl: string | null;
  status: "active" | "inactive" | "error";
}

interface CheckResult {
  reachable: boolean;
  latency: number;
  detail: string;
  checkedAt: string;
}

export default function ConnectionStatusPage() {
  const { data } = useSWR("/api/connections", fetcher);
  const connections: Connection[] = data?.data || [];

  const [results, setResults] = useState<Record<number, CheckResult>>({});
  const [checking, setChecking] = useState<Record<number, boolean>>({});
  const [checkingAll, setCheckingAll] = useState(false);

  async function checkConnection(id: number) {
    setChecking((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/connections/${id}/check`, {
        method: "POST",
      });
      const result = await res.json();
      if (result.success) {
        setResults((prev) => ({ ...prev, [id]: result.data }));
      } else {
        toast.error(result.error || "Check failed");
      }
    } catch {
      toast.error("Failed to check connection");
    } finally {
      setChecking((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function checkAll() {
    setCheckingAll(true);
    const promises = connections.map((c) => checkConnection(c.id));
    await Promise.allSettled(promises);
    setCheckingAll(false);
    toast.success("All connections checked");
  }

  const reachableCount = Object.values(results).filter(
    (r) => r.reachable
  ).length;
  const unreachableCount = Object.values(results).filter(
    (r) => !r.reachable
  ).length;
  const uncheckedCount = connections.length - Object.keys(results).length;

  return (
    <>
      <TopBar title="Connection Live Status" />
      <div className="page-content">
        {/* Header */}
        <div className="page-header">
          <div>
            <p className="page-subtitle">
              Real-time connectivity status for all vendor endpoints
            </p>
          </div>
          <Button
            onClick={checkAll}
            disabled={checkingAll || connections.length === 0}
            className="btn-primary-action"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${checkingAll ? "animate-spin" : ""}`}
            />
            Check All Connections
          </Button>
        </div>

        {/* Summary Row */}
        {connections.length > 0 && (
          <div className="status-summary-row">
            <div className="status-summary-card status-summary-card--total">
              <Server className="h-4 w-4" />
              <span className="status-summary-value">
                {connections.length}
              </span>
              <span className="status-summary-label">Total</span>
            </div>
            <div className="status-summary-card status-summary-card--online">
              <Wifi className="h-4 w-4" />
              <span className="status-summary-value">{reachableCount}</span>
              <span className="status-summary-label">Reachable</span>
            </div>
            <div className="status-summary-card status-summary-card--offline">
              <WifiOff className="h-4 w-4" />
              <span className="status-summary-value">{unreachableCount}</span>
              <span className="status-summary-label">Unreachable</span>
            </div>
            <div className="status-summary-card status-summary-card--unchecked">
              <Clock className="h-4 w-4" />
              <span className="status-summary-value">{uncheckedCount}</span>
              <span className="status-summary-label">Not Checked</span>
            </div>
          </div>
        )}

        {connections.length === 0 && (
          <div className="empty-state">
            <Globe className="h-12 w-12 text-slate-300" />
            <p className="empty-state-text">No connections configured</p>
            <p className="empty-state-hint">
              Add vendor connections to start monitoring
            </p>
          </div>
        )}

        {/* Connection Cards Grid */}
        <div className="conn-status-grid">
          {connections.map((conn) => {
            const result = results[conn.id];
            const isChecking = checking[conn.id];
            const endpoint =
              conn.type === "SMPP"
                ? conn.host && conn.port
                  ? `${conn.host}:${conn.port}`
                  : "Not configured"
                : conn.apiUrl || "Not configured";

            return (
              <div
                key={conn.id}
                className={`conn-status-card ${
                  result
                    ? result.reachable
                      ? "conn-status-card--online"
                      : "conn-status-card--offline"
                    : ""
                }`}
              >
                <div className="conn-status-card-header">
                  <div className="conn-status-card-info">
                    <h4 className="conn-status-card-name">{conn.name}</h4>
                    <p className="conn-status-card-company">
                      {conn.companyName}
                    </p>
                  </div>
                  <Badge
                    className={
                      conn.type === "SMPP"
                        ? "bg-purple-100 text-purple-700 border-purple-200"
                        : "bg-blue-100 text-blue-700 border-blue-200"
                    }
                  >
                    {conn.type}
                  </Badge>
                </div>

                <div className="conn-status-card-endpoint">
                  <Globe className="h-3.5 w-3.5 text-slate-400" />
                  <span>{endpoint}</span>
                </div>

                <div className="conn-status-card-status">
                  {result ? (
                    <div className="conn-status-indicator">
                      <span
                        className={`conn-status-dot ${
                          result.reachable
                            ? "conn-status-dot--online"
                            : "conn-status-dot--offline"
                        }`}
                      />
                      <span
                        className={
                          result.reachable
                            ? "text-emerald-700 font-semibold text-sm"
                            : "text-red-700 font-semibold text-sm"
                        }
                      >
                        {result.reachable ? "Connected" : "Unreachable"}
                      </span>
                    </div>
                  ) : (
                    <div className="conn-status-indicator">
                      <span className="conn-status-dot conn-status-dot--unknown" />
                      <span className="text-slate-400 text-sm">
                        Not checked
                      </span>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => checkConnection(conn.id)}
                    disabled={isChecking}
                    className="conn-status-test-btn"
                  >
                    <Activity
                      className={`mr-1 h-3 w-3 ${
                        isChecking ? "animate-pulse" : ""
                      }`}
                    />
                    {isChecking ? "Testing..." : "Test"}
                  </Button>
                </div>

                {/* Result Details */}
                {result && (
                  <div className="conn-status-details">
                    <div className="conn-status-detail-row">
                      <span>Latency</span>
                      <span className="conn-status-detail-value">
                        <Zap className="h-3 w-3 text-amber-500" />
                        {result.latency} ms
                      </span>
                    </div>
                    <div className="conn-status-detail-row">
                      <span>Status</span>
                      <span className="conn-status-detail-value">
                        {result.detail}
                      </span>
                    </div>
                    <div className="conn-status-detail-row">
                      <span>Checked</span>
                      <span className="conn-status-detail-value">
                        {new Date(result.checkedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
CONNSTATUS_EOF
echo "  [9/17] connections/status/page.tsx updated"

# 10. connections/page.tsx
cat > "$APP_DIR/src/app/(dashboard)/connections/page.tsx" << 'CONNECTIONS_EOF'
"use client";

import { useState } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
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
import { Plus, Pencil, Trash2 } from "lucide-react";

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
  status: "active" as "active" | "inactive" | "error",
};

export default function ConnectionsPage() {
  const { data, mutate } = useSWR("/api/connections", fetcher);
  const { data: companiesData } = useSWR("/api/companies", fetcher);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
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
          status: form.status,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(editId ? "Connection updated" : "Connection created");
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

  async function handleDelete(id: number) {
    if (!confirm("Delete this connection?")) return;
    try {
      const res = await fetch(`/api/connections/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        toast.success("Connection deleted");
        mutate();
      } else {
        toast.error(result.error || "Delete failed");
      }
    } catch {
      toast.error("Failed to delete connection");
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

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: "bg-green-100 text-green-700 border-green-200",
      inactive: "bg-gray-100 text-gray-600 border-gray-200",
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
        <div className="page-header">
          <p className="page-subtitle">
            Manage SMPP and HTTP vendor connections
          </p>
          <Button onClick={openCreate} className="btn-primary-action">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Connection
          </Button>
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
                <TableHead>Status</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-slate-400 py-8">
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
                  <TableCell className="text-xs text-slate-500 max-w-[200px] truncate">
                    {conn.type === "SMPP"
                      ? conn.host && conn.port
                        ? `${conn.host}:${conn.port}`
                        : "-"
                      : conn.apiUrl || "-"}
                  </TableCell>
                  <TableCell>{conn.maxTps}</TableCell>
                  <TableCell>{statusBadge(conn.status)}</TableCell>
                  <TableCell className="text-xs text-slate-400">
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
                        onClick={() => handleDelete(conn.id)}
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

        {/* Create / Edit Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editId ? "Edit Connection" : "Add Connection"}
              </DialogTitle>
              <DialogDescription>
                {editId
                  ? "Update vendor connection settings."
                  : "Configure a new SMPP or HTTP vendor connection."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              {/* Name */}
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input
                  placeholder="e.g. Vendor MT Primary"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              {/* Company (vendor only) */}
              <div className="grid gap-1.5">
                <Label>Company (Vendor)</Label>
                <Select
                  value={form.companyId}
                  onValueChange={(val) =>
                    setForm({ ...form, companyId: val as string })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type + Direction row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(val) =>
                      setForm({ ...form, type: val as "SMPP" | "HTTP" })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SMPP">SMPP</SelectItem>
                      <SelectItem value="HTTP">HTTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Direction</Label>
                  <Select
                    value={form.direction}
                    onValueChange={(val) =>
                      setForm({ ...form, direction: val as "MT" | "MO" | "BOTH" })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MT">MT</SelectItem>
                      <SelectItem value="MO">MO</SelectItem>
                      <SelectItem value="BOTH">BOTH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dynamic fields based on type */}
              {form.type === "SMPP" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Host</Label>
                      <Input
                        placeholder="smpp.vendor.com"
                        value={form.host}
                        onChange={(e) =>
                          setForm({ ...form, host: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Port</Label>
                      <Input
                        type="number"
                        placeholder="2775"
                        value={form.port}
                        onChange={(e) =>
                          setForm({ ...form, port: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Username</Label>
                      <Input
                        placeholder="smpp_user"
                        value={form.username}
                        onChange={(e) =>
                          setForm({ ...form, username: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        placeholder={editId ? "Leave blank to keep" : "Password"}
                        value={form.password}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-1.5">
                    <Label>API URL</Label>
                    <Input
                      placeholder="https://api.vendor.com/sms/send"
                      value={form.apiUrl}
                      onChange={(e) =>
                        setForm({ ...form, apiUrl: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      placeholder={editId ? "Leave blank to keep" : "API key"}
                      value={form.apiKey}
                      onChange={(e) =>
                        setForm({ ...form, apiKey: e.target.value })
                      }
                    />
                  </div>
                </>
              )}

              {/* Max TPS + Status row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Max TPS</Label>
                  <Input
                    type="number"
                    placeholder="10"
                    value={form.maxTps}
                    onChange={(e) =>
                      setForm({ ...form, maxTps: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(val) =>
                      setForm({
                        ...form,
                        status: val as "active" | "inactive" | "error",
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
CONNECTIONS_EOF
echo "  [10/17] connections/page.tsx updated"

# 11. customers/live-status/page.tsx
mkdir -p "$APP_DIR/src/app/(dashboard)/customers/live-status"
cat > "$APP_DIR/src/app/(dashboard)/customers/live-status/page.tsx" << 'CUSTLIVE_EOF'
"use client";

import { useState } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Server,
  Wifi,
  Activity,
  Clock,
  User,
  Zap,
  Shield,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface AccountStatus {
  id: number;
  systemId: string;
  accountName: string | null;
  companyName: string;
  companyId: number;
  status: string;
  maxTps: number;
  maxConnections: number;
  lastBindAt: string | null;
  lastBindIp: string | null;
}

interface BindLog {
  id: number;
  systemId: string | null;
  accountName: string;
  clientIp: string | null;
  action: string;
  reason: string | null;
  createdAt: string;
}

interface ServerStatus {
  running?: boolean;
  uptime?: number;
  connections?: number;
  port?: number;
}

export default function CustomerLiveStatusPage() {
  const [period, setPeriod] = useState("60");

  const { data: statusData } = useSWR(
    `/api/customer-status?period=${period}`,
    fetcher,
    { refreshInterval: 10000 }
  );

  const serverStatus: ServerStatus | null = statusData?.serverStatus || null;
  const accounts: AccountStatus[] = statusData?.accounts || [];
  const trafficMap: Record<
    number,
    { total: number; delivered: number; failed: number; queued: number }
  > = statusData?.trafficMap || {};
  const bindLogs: BindLog[] = statusData?.bindLogs || [];

  const companySummary = new Map<
    number,
    {
      name: string;
      accounts: number;
      traffic: { total: number; delivered: number; failed: number; queued: number };
    }
  >();
  accounts.forEach((a) => {
    if (!companySummary.has(a.companyId)) {
      companySummary.set(a.companyId, {
        name: a.companyName,
        accounts: 0,
        traffic: trafficMap[a.companyId] || {
          total: 0,
          delivered: 0,
          failed: 0,
          queued: 0,
        },
      });
    }
    const entry = companySummary.get(a.companyId)!;
    entry.accounts += 1;
  });

  const bindActionStyle = (action: string) => {
    switch (action) {
      case "bind":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "unbind":
        return "bg-slate-100 text-slate-600 border-slate-200";
      case "rejected":
        return "bg-red-100 text-red-700 border-red-200";
      case "error":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  return (
    <>
      <TopBar title="Customer Live Status" />
      <div className="page-content">
        {/* Server Status Cards */}
        <div className="server-status-grid">
          <div
            className={`server-status-card ${
              serverStatus?.running
                ? "server-status-card--online"
                : "server-status-card--offline"
            }`}
          >
            <div className="server-status-icon-wrap">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <p className="server-status-label">SMPP Server</p>
              <p className="server-status-value">
                {serverStatus
                  ? serverStatus.running
                    ? "Running"
                    : "Stopped"
                  : "Unknown"}
              </p>
              {serverStatus?.port && (
                <p className="server-status-hint">Port {serverStatus.port}</p>
              )}
            </div>
          </div>

          <div className="server-status-card">
            <div className="server-status-icon-wrap server-status-icon-wrap--blue">
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <p className="server-status-label">Active Connections</p>
              <p className="server-status-value-lg">
                {serverStatus?.connections ?? "-"}
              </p>
            </div>
          </div>

          <div className="server-status-card">
            <div className="server-status-icon-wrap server-status-icon-wrap--purple">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="server-status-label">Active Accounts</p>
              <p className="server-status-value-lg">
                {accounts.filter((a) => a.status === "active").length}
              </p>
            </div>
          </div>

          <div className="server-status-card">
            <div className="server-status-icon-wrap server-status-icon-wrap--amber">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="server-status-label">Total Accounts</p>
              <p className="server-status-value-lg">{accounts.length}</p>
            </div>
          </div>
        </div>

        {/* Period Selector + Account Cards */}
        <div className="section-block">
          <div className="section-header">
            <h3 className="section-title">
              <User className="h-4 w-4" />
              Account Connections
            </h3>
            <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
              <SelectTrigger className="filter-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">Last 15 min</SelectItem>
                <SelectItem value="30">Last 30 min</SelectItem>
                <SelectItem value="60">Last 1 hour</SelectItem>
                <SelectItem value="360">Last 6 hours</SelectItem>
                <SelectItem value="1440">Last 24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="account-cards-grid">
            {accounts.length === 0 && (
              <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
                <Shield className="h-10 w-10 text-slate-300" />
                <p className="empty-state-text">No SMPP accounts found</p>
              </div>
            )}
            {accounts.map((a) => (
              <div key={a.id} className="account-card">
                <div className="account-card-header">
                  <div>
                    <p className="account-card-name">
                      {a.accountName || a.systemId}
                    </p>
                    <p className="account-card-company">{a.companyName}</p>
                  </div>
                  <Badge
                    className={
                      a.status === "active"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : "bg-red-100 text-red-700 border-red-200"
                    }
                  >
                    {a.status}
                  </Badge>
                </div>
                <div className="account-card-details">
                  <div className="account-card-detail">
                    <span className="account-card-detail-label">System ID</span>
                    <span className="account-card-detail-value font-mono">
                      {a.systemId}
                    </span>
                  </div>
                  <div className="account-card-detail">
                    <span className="account-card-detail-label">Max TPS</span>
                    <span className="account-card-detail-value">{a.maxTps}</span>
                  </div>
                  <div className="account-card-detail">
                    <span className="account-card-detail-label">Last Bind</span>
                    <span className="account-card-detail-value">
                      {a.lastBindAt
                        ? new Date(a.lastBindAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })
                        : "Never"}
                    </span>
                  </div>
                  <div className="account-card-detail">
                    <span className="account-card-detail-label">IP</span>
                    <span className="account-card-detail-value font-mono">
                      {a.lastBindIp || "-"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Company Traffic Summary */}
        <div className="section-block">
          <div className="section-header">
            <h3 className="section-title">
              <Activity className="h-4 w-4" />
              Company Traffic Summary
            </h3>
          </div>
          <div className="tt-container">
            <table className="tt-table">
              <thead>
                <tr className="tt-head-row">
                  <th className="tt-head-cell">Company</th>
                  <th className="tt-head-cell">Accounts</th>
                  <th className="tt-head-cell">Total</th>
                  <th className="tt-head-cell">Delivered</th>
                  <th className="tt-head-cell">Failed</th>
                  <th className="tt-head-cell">Queued</th>
                  <th className="tt-head-cell">DLR%</th>
                </tr>
              </thead>
              <tbody>
                {companySummary.size === 0 && (
                  <tr className="tt-row">
                    <td colSpan={7} className="tt-cell tt-cell--empty">
                      No traffic data
                    </td>
                  </tr>
                )}
                {Array.from(companySummary.entries()).map(
                  ([companyId, info]) => (
                    <tr key={companyId} className="tt-row tt-row--data">
                      <td className="tt-cell tt-cell--name font-semibold">
                        {info.name}
                      </td>
                      <td className="tt-cell tt-cell--num">{info.accounts}</td>
                      <td className="tt-cell tt-cell--num">
                        {info.traffic.total.toLocaleString()}
                      </td>
                      <td className="tt-cell tt-cell--num tt-cell--success">
                        {info.traffic.delivered.toLocaleString()}
                      </td>
                      <td className="tt-cell tt-cell--num tt-cell--danger">
                        {info.traffic.failed.toLocaleString()}
                      </td>
                      <td className="tt-cell tt-cell--num" style={{ color: "#d97706" }}>
                        {info.traffic.queued.toLocaleString()}
                      </td>
                      <td className="tt-cell tt-cell--num">
                        {info.traffic.total > 0
                          ? (
                              (info.traffic.delivered / info.traffic.total) *
                              100
                            ).toFixed(1) + "%"
                          : "-"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bind Logs */}
        <div className="section-block">
          <div className="section-header">
            <h3 className="section-title">
              <Clock className="h-4 w-4" />
              Recent Bind Activity
            </h3>
            <span className="section-badge">Last 20</span>
          </div>
          <div className="tt-container">
            <table className="tt-table">
              <thead>
                <tr className="tt-head-row">
                  <th className="tt-head-cell">Time</th>
                  <th className="tt-head-cell">System ID</th>
                  <th className="tt-head-cell">Account</th>
                  <th className="tt-head-cell">Client IP</th>
                  <th className="tt-head-cell">Action</th>
                  <th className="tt-head-cell">Reason</th>
                </tr>
              </thead>
              <tbody>
                {bindLogs.length === 0 && (
                  <tr className="tt-row">
                    <td colSpan={6} className="tt-cell tt-cell--empty">
                      No bind logs
                    </td>
                  </tr>
                )}
                {bindLogs.map((b) => (
                  <tr key={b.id} className="tt-row tt-row--data">
                    <td className="tt-cell text-xs whitespace-nowrap">
                      {new Date(b.createdAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                      })}
                    </td>
                    <td className="tt-cell font-mono text-xs">
                      {b.systemId || "-"}
                    </td>
                    <td className="tt-cell text-sm">{b.accountName}</td>
                    <td className="tt-cell font-mono text-xs">
                      {b.clientIp || "-"}
                    </td>
                    <td className="tt-cell">
                      <Badge className={`${bindActionStyle(b.action)} text-xs`}>
                        {b.action}
                      </Badge>
                    </td>
                    <td className="tt-cell text-xs text-slate-500">
                      {b.reason || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
CUSTLIVE_EOF
echo "  [11/17] customers/live-status/page.tsx updated"

# 12. customers/page.tsx
cat > "$APP_DIR/src/app/(dashboard)/customers/page.tsx" << 'CUSTOMERS_EOF'
"use client";

import { useState } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
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

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this account?")) return;
    try {
      const res = await fetch(`/api/customer-accounts/${id}`, {
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
                    className="text-center text-slate-500"
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
                  <TableCell className="text-xs text-slate-500">
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
                        onClick={() => handleDelete(a.id)}
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
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {credentials
                  ? "Account Created - Save Credentials"
                  : editId
                  ? "Edit SMPP Account"
                  : "Add SMPP Account"}
              </DialogTitle>
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
                      <span className="text-slate-600">System ID:</span>
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
                      <span className="text-slate-600">Password:</span>
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
                      <span className="text-slate-600">SMPP Host:</span>
                      <code className="font-mono">
                        {credentials.smppHost}
                      </code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">SMPP Port:</span>
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
                <div className="grid gap-4 py-2">
                  <div className="grid gap-1.5">
                    <Label>Company</Label>
                    <Select
                      value={form.companyId}
                      onValueChange={(v) =>
                        v && setForm({ ...form, companyId: v })
                      }
                    >
                      <SelectTrigger className="w-full">
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

                  <div className="grid gap-1.5">
                    <Label>Account Name</Label>
                    <Input
                      value={form.accountName}
                      onChange={(e) =>
                        setForm({ ...form, accountName: e.target.value })
                      }
                      placeholder="e.g. Main Production"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>System ID</Label>
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
                    <div className="grid gap-1.5">
                      <Label>Password</Label>
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

                  <div className="grid gap-1.5">
                    <Label>Allowed IPs</Label>
                    <Input
                      value={form.allowedIps}
                      onChange={(e) =>
                        setForm({ ...form, allowedIps: e.target.value })
                      }
                      placeholder="* for all, or comma-separated IPs"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Max Connections</Label>
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
                    <div className="grid gap-1.5">
                      <Label>Max TPS</Label>
                      <Input
                        type="number"
                        value={form.maxTps}
                        onChange={(e) =>
                          setForm({ ...form, maxTps: e.target.value })
                        }
                        min="1"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Speed Limit</Label>
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Bind Mode</Label>
                      <Select
                        value={form.bindMode}
                        onValueChange={(v) =>
                          v && setForm({ ...form, bindMode: v })
                        }
                      >
                        <SelectTrigger className="w-full">
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
                    <div className="grid gap-1.5">
                      <Label>Charging Model</Label>
                      <Select
                        value={form.chargingModel}
                        onValueChange={(v) =>
                          v && setForm({ ...form, chargingModel: v })
                        }
                      >
                        <SelectTrigger className="w-full">
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

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.enableDelivery}
                      onCheckedChange={(checked) =>
                        setForm({ ...form, enableDelivery: !!checked })
                      }
                    />
                    <Label>Enable Delivery Reports</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
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
      </div>
    </>
  );
}
CUSTOMERS_EOF
echo "  [12/17] customers/page.tsx updated"

# 13. Dashboard page.tsx
cat > "$APP_DIR/src/app/(dashboard)/page.tsx" << 'DASHPAGE_EOF'
"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import SummaryCards from "@/components/dashboard/SummaryCards";
import FilterBar from "@/components/dashboard/FilterBar";
import TrafficTable from "@/components/dashboard/TrafficTable";
import TrafficChart from "@/components/dashboard/TrafficChart";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function DashboardPage() {
  const [period, setPeriod] = useState("15");
  const [sortBy, setSortBy] = useState("submitted");
  const [filterType, setFilterType] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(30);

  const params = new URLSearchParams({ period, sortBy, filterType });

  const { data: summary, mutate: mutateSummary } = useSWR(
    `/api/traffic/summary?${params}`,
    fetcher,
    { refreshInterval: autoRefresh ? 30000 : 0 }
  );

  const { data: totals, mutate: mutateTotals } = useSWR(
    `/api/traffic/totals?${params}`,
    fetcher,
    { refreshInterval: autoRefresh ? 30000 : 0 }
  );

  const refresh = useCallback(() => {
    mutateSummary();
    mutateTotals();
    setCountdown(30);
  }, [mutateSummary, mutateTotals]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          return 30;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  return (
    <>
      <TopBar title="Live SMS Traffic Dashboard" />
      <div className="page-content">
        <SummaryCards data={totals?.data} />
        <FilterBar
          period={period}
          setPeriod={setPeriod}
          sortBy={sortBy}
          setSortBy={setSortBy}
          filterType={filterType}
          setFilterType={setFilterType}
          autoRefresh={autoRefresh}
          setAutoRefresh={setAutoRefresh}
          countdown={countdown}
          onRefresh={refresh}
        />
        <TrafficChart data={summary?.data || []} />
        <TrafficTable data={summary?.data || []} period={period} />
      </div>
    </>
  );
}
DASHPAGE_EOF
echo "  [13/17] page.tsx (dashboard) updated"

# 14. companies/page.tsx
mkdir -p "$APP_DIR/src/app/(dashboard)/companies"
cat > "$APP_DIR/src/app/(dashboard)/companies/page.tsx" << 'COMPANIES_EOF'
"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import TopBar from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
}

const emptyForm: FormData = {
  name: "",
  code: "",
  type: "customer",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  isActive: true,
};

export default function CompaniesPage() {
  const { data, mutate } = useSWR("/api/companies", fetcher);
  const companies: Company[] = data?.data || [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
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
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Name and code are required");
      return;
    }
    setSaving(true);
    try {
      const url = editingId
        ? `/api/companies/${editingId}`
        : "/api/companies";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Operation failed");
        return;
      }
      toast.success(editingId ? "Company updated" : "Company created");
      setDialogOpen(false);
      mutate();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
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
      <TopBar title="Companies" />
      <div className="page-content">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Manage customers and vendors
          </p>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Company
          </Button>
        </div>

        <div className="rounded-lg border bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Code</TableHead>
                <TableHead className="text-xs font-semibold">Type</TableHead>
                <TableHead className="text-xs font-semibold">Contact</TableHead>
                <TableHead className="text-xs font-semibold text-center">Connections</TableHead>
                <TableHead className="text-xs font-semibold text-center">24h Traffic</TableHead>
                <TableHead className="text-xs font-semibold text-center">Active</TableHead>
                <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No companies found
                  </TableCell>
                </TableRow>
              )}
              {companies.map((c) => (
                <TableRow key={c.id} className="hover:bg-slate-50/50">
                  <TableCell className="text-sm font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {c.code}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        c.type === "customer"
                          ? "border-blue-200 text-blue-600"
                          : "border-orange-200 text-orange-600"
                      }
                    >
                      {c.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.contactName && (
                      <div>{c.contactName}</div>
                    )}
                    {c.contactEmail && (
                      <div className="text-xs text-muted-foreground">
                        {c.contactEmail}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-sm">
                    {c.connectionCount}
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-sm">
                    {c.traffic24h.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        c.isActive ? "bg-emerald-500" : "bg-red-400"
                      }`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDeleteId(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Company" : "Add Company"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update company details below."
                : "Fill in the details to create a new company."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Company name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="ACME"
                  className="uppercase"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Type *</Label>
                <Select
                  value={form.type}
                  onValueChange={(val) =>
                    setForm((f) => ({
                      ...f,
                      type: val as "customer" | "vendor",
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                value={form.contactName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactName: e.target.value }))
                }
                placeholder="John Doe"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="contactEmail">Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contactEmail: e.target.value }))
                  }
                  placeholder="john@example.com"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="contactPhone">Phone</Label>
                <Input
                  id="contactPhone"
                  value={form.contactPhone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contactPhone: e.target.value }))
                  }
                  placeholder="+1234567890"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isActive: !!checked }))
                }
              />
              <Label>Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
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
    </>
  );
}
COMPANIES_EOF
echo "  [14/17] companies/page.tsx updated"

# 15. routes/page.tsx
mkdir -p "$APP_DIR/src/app/(dashboard)/routes"
cat > "$APP_DIR/src/app/(dashboard)/routes/page.tsx" << 'ROUTES_EOF'
"use client";

import { useState } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
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
import { Plus, Pencil, Trash2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Route {
  id: number;
  name: string;
  customerId: number;
  customerName: string;
  vendorId: number;
  vendorName: string;
  countryCode: string;
  numberPrefix: string;
  sellingRate: number;
  buyingRate: number;
  margin: number;
  priority: number;
  isActive: boolean;
}

interface Company {
  id: number;
  name: string;
  type: string;
}

const emptyForm = {
  name: "",
  customerId: "",
  vendorId: "",
  countryCode: "91",
  numberPrefix: "",
  sellingRate: "0",
  buyingRate: "0",
  priority: "1",
  isActive: true,
};

export default function RoutesPage() {
  const { data: routesData, mutate } = useSWR("/api/routes", fetcher);
  const { data: companiesData } = useSWR("/api/companies", fetcher);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const routes: Route[] = routesData?.data || [];
  const companies: Company[] = companiesData?.data || [];
  const customers = companies.filter((c) => c.type === "customer");
  const vendors = companies.filter((c) => c.type === "vendor");

  function openAdd() {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(r: Route) {
    setEditId(r.id);
    setForm({
      name: r.name,
      customerId: String(r.customerId),
      vendorId: String(r.vendorId),
      countryCode: r.countryCode,
      numberPrefix: r.numberPrefix,
      sellingRate: String(r.sellingRate),
      buyingRate: String(r.buyingRate),
      priority: String(r.priority),
      isActive: r.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        customerId: parseInt(form.customerId, 10),
        vendorId: parseInt(form.vendorId, 10),
        sellingRate: parseFloat(form.sellingRate),
        buyingRate: parseFloat(form.buyingRate),
        priority: parseInt(form.priority, 10),
      };

      const url = editId ? `/api/routes/${editId}` : "/api/routes";
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this route?")) return;
    try {
      const res = await fetch(`/api/routes/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!result.success) {
        toast.error(result.error || "Failed to delete");
        return;
      }
      toast.success("Route deleted");
      mutate();
    } catch {
      toast.error("An error occurred");
    }
  }

  return (
    <>
      <TopBar title="Routes Management" />
      <div className="page-content">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">
            Routes ({routes.length})
          </h3>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Route
          </Button>
        </div>

        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead className="text-right">Selling Rate</TableHead>
                <TableHead className="text-right">Buying Rate</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-center">Priority</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-slate-500">
                    No routes configured
                  </TableCell>
                </TableRow>
              )}
              {routes.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.customerName}</TableCell>
                  <TableCell>{r.vendorName}</TableCell>
                  <TableCell>{r.countryCode}</TableCell>
                  <TableCell>{r.numberPrefix || "-"}</TableCell>
                  <TableCell className="text-right">
                    {r.sellingRate.toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.buyingRate.toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        r.margin > 0
                          ? "text-emerald-600"
                          : r.margin < 0
                          ? "text-red-600"
                          : ""
                      }
                    >
                      {r.margin.toFixed(4)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">{r.priority}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={r.isActive ? "default" : "secondary"}>
                      {r.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(r.id)}
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Route" : "Add Route"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <Label>Route Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. India Premium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Customer</Label>
                  <Select
                    value={form.customerId}
                    onValueChange={(v) => v && setForm({ ...form, customerId: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Vendor</Label>
                  <Select
                    value={form.vendorId}
                    onValueChange={(v) => v && setForm({ ...form, vendorId: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label>Country Code</Label>
                  <Input
                    value={form.countryCode}
                    onChange={(e) =>
                      setForm({ ...form, countryCode: e.target.value })
                    }
                    placeholder="91"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Number Prefix</Label>
                  <Input
                    value={form.numberPrefix}
                    onChange={(e) =>
                      setForm({ ...form, numberPrefix: e.target.value })
                    }
                    placeholder="e.g. 98"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: e.target.value })
                    }
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Selling Rate</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={form.sellingRate}
                    onChange={(e) =>
                      setForm({ ...form, sellingRate: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Buying Rate</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={form.buyingRate}
                    onChange={(e) =>
                      setForm({ ...form, buyingRate: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, isActive: !!checked })
                  }
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
ROUTES_EOF
echo "  [15/17] routes/page.tsx updated"

# 16. send-sms/page.tsx
mkdir -p "$APP_DIR/src/app/(dashboard)/send-sms"
cat > "$APP_DIR/src/app/(dashboard)/send-sms/page.tsx" << 'SENDSMS_EOF'
"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Send, MessageSquare } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function detectEncoding(text: string) {
  const totalChars = text.length;
  const isUCS2 = [...text].some((ch) => ch.charCodeAt(0) > 127);
  if (isUCS2) {
    const parts = totalChars <= 70 ? 1 : Math.ceil(totalChars / 67);
    return { encoding: "UCS-2", parts, charsPerPart: totalChars <= 70 ? 70 : 67, totalChars };
  }
  const parts = totalChars <= 160 ? 1 : Math.ceil(totalChars / 153);
  return { encoding: "GSM-7", parts, charsPerPart: totalChars <= 160 ? 160 : 153, totalChars };
}

interface SendResult {
  destination: string;
  messageId?: string;
  status: string;
  error?: string;
}

interface RecentMessage {
  id: string;
  messageId: string;
  customerName: string;
  routeName: string;
  senderId: string;
  destination: string;
  encoding: string;
  parts: number;
  status: string;
  submittedAt: string;
}

export default function SendSmsPage() {
  const [companyId, setCompanyId] = useState("");
  const [senderId, setSenderId] = useState("SMSLCL");
  const [routeId, setRouteId] = useState("");
  const [phones, setPhones] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);

  const { data: companiesData } = useSWR(
    "/api/companies?type=customer",
    fetcher
  );
  const { data: routesData } = useSWR(
    companyId ? `/api/routes?customerId=${companyId}` : null,
    fetcher
  );
  const { data: recentData, mutate: mutateRecent } = useSWR(
    "/api/messages/recent",
    fetcher,
    { refreshInterval: 10000 }
  );

  const companies = (companiesData?.data || []).filter(
    (c: { type: string }) => c.type === "customer"
  );
  const routes = routesData?.data || [];
  const recent: RecentMessage[] = recentData?.data || [];

  const enc = detectEncoding(message);

  const handleSend = useCallback(async () => {
    if (!companyId || !message) {
      toast.error("Select a customer and enter a message");
      return;
    }

    const numbers = phones
      .split(/[,\n\r]+/)
      .map((n) => n.trim())
      .filter(Boolean);

    if (numbers.length === 0) {
      toast.error("Enter at least one phone number");
      return;
    }

    setSending(true);
    setResults([]);

    try {
      if (numbers.length === 1) {
        const res = await fetch("/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: parseInt(companyId, 10),
            senderId,
            destination: numbers[0],
            message,
            routeId: routeId || undefined,
          }),
        });
        const result = await res.json();
        if (result.success) {
          setResults([
            {
              destination: result.destination,
              messageId: result.messageId,
              status: "queued",
            },
          ]);
          toast.success("SMS queued successfully");
        } else {
          setResults([
            {
              destination: numbers[0],
              status: "failed",
              error: result.error,
            },
          ]);
          toast.error(result.error || "Failed to send");
        }
      } else {
        const res = await fetch("/api/sms/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: parseInt(companyId, 10),
            senderId,
            destinations: numbers,
            message,
            routeId: routeId || undefined,
          }),
        });
        const result = await res.json();
        if (result.success) {
          setResults(result.results || []);
          toast.success(
            `Bulk send: ${result.queued} queued, ${result.failed} failed`
          );
        } else {
          toast.error(result.error || "Bulk send failed");
        }
      }
      mutateRecent();
    } catch {
      toast.error("An error occurred");
    } finally {
      setSending(false);
    }
  }, [companyId, senderId, routeId, phones, message, mutateRecent]);

  return (
    <>
      <TopBar title="Send SMS" />
      <div className="page-content">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Compose */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                Compose Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-1.5">
                <Label>Customer</Label>
                <Select
                  value={companyId}
                  onValueChange={(v) => {
                    if (v !== null) setCompanyId(v);
                    setRouteId("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c: { id: number; name: string }) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Sender ID</Label>
                  <Input
                    value={senderId}
                    onChange={(e) =>
                      setSenderId(e.target.value.slice(0, 11))
                    }
                    placeholder="SMSLCL"
                    maxLength={11}
                  />
                  <span className="text-xs text-slate-400">
                    Max 11 characters
                  </span>
                </div>
                <div className="grid gap-1.5">
                  <Label>Route</Label>
                  <Select value={routeId} onValueChange={(v) => v !== null && setRouteId(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Auto-select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Auto-select</SelectItem>
                      {routes.map(
                        (r: { id: number; name: string; sellingRate: number }) => (
                          <SelectItem key={r.id} value={String(r.id)}>
                            {r.name} ({r.sellingRate.toFixed(4)})
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>Phone Numbers</Label>
                <Textarea
                  value={phones}
                  onChange={(e) => setPhones(e.target.value)}
                  placeholder="Enter numbers separated by commas or new lines&#10;e.g. 9876543210, 8765432109"
                  rows={3}
                />
                <span className="text-xs text-slate-400">
                  {phones
                    .split(/[,\n\r]+/)
                    .filter((n) => n.trim()).length}{" "}
                  number(s) entered
                </span>
              </div>

              <div className="grid gap-1.5">
                <Label>Message</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={4}
                />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {enc.totalChars} chars | {enc.encoding} | {enc.parts}{" "}
                    part(s)
                  </span>
                  <span>
                    {enc.charsPerPart - (enc.totalChars % enc.charsPerPart || enc.charsPerPart)}{" "}
                    chars remaining in part
                  </span>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleSend}
                disabled={sending}
              >
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Sending..." : "Send SMS"}
              </Button>
            </CardContent>
          </Card>

          {/* Right: Results */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Send Results</CardTitle>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  Send results will appear here
                </p>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Destination</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Message ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">
                            {r.destination}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                r.status === "queued"
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              {r.status}
                            </Badge>
                            {r.error && (
                              <span className="ml-1 text-xs text-red-500">
                                {r.error}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.messageId
                              ? r.messageId.slice(0, 12) + "..."
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom: Recent Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Recent Messages (Last 50)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Sender</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Enc</TableHead>
                    <TableHead>Parts</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-slate-500"
                      >
                        No recent messages
                      </TableCell>
                    </TableRow>
                  )}
                  {recent.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">
                        {new Date(m.submittedAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })}
                      </TableCell>
                      <TableCell className="text-xs">
                        {m.customerName}
                      </TableCell>
                      <TableCell className="text-xs">{m.routeName}</TableCell>
                      <TableCell className="text-xs">{m.senderId}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {m.destination}
                      </TableCell>
                      <TableCell className="text-xs">{m.encoding}</TableCell>
                      <TableCell className="text-xs">{m.parts}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            m.status === "delivered"
                              ? "default"
                              : m.status === "failed"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {m.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
SENDSMS_EOF
echo "  [16/17] send-sms/page.tsx updated"

# 17. customers/reports/page.tsx
mkdir -p "$APP_DIR/src/app/(dashboard)/customers/reports"
cat > "$APP_DIR/src/app/(dashboard)/customers/reports/page.tsx" << 'CUSTREPORTS_EOF'
"use client";

import { useState } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ReportMessage {
  id: string;
  messageId: string;
  customerName: string;
  accountName: string;
  systemId: string;
  routeName: string;
  senderId: string;
  destination: string;
  messageText: string;
  encoding: string;
  parts: number;
  status: string;
  errorCode: string | null;
  submittedAt: string;
  deliveredAt: string | null;
}

export default function CustomerReportsPage() {
  const [accountId, setAccountId] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: accountsData } = useSWR("/api/customer-accounts", fetcher);
  const accounts = accountsData?.data || [];

  const params = new URLSearchParams({ page: String(page), limit: "50" });
  if (accountId) params.set("accountId", accountId);
  if (status) params.set("status", status);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (search) params.set("search", search);

  const { data: reportData } = useSWR(
    `/api/reports/messages?${params}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const messages: ReportMessage[] = reportData?.data || [];
  const stats = reportData?.stats || {};
  const pagination = reportData?.pagination || {
    page: 1,
    totalPages: 1,
    total: 0,
  };

  async function exportCSV() {
    try {
      const allParams = new URLSearchParams({
        page: "1",
        limit: "10000",
      });
      if (accountId) allParams.set("accountId", accountId);
      if (status) allParams.set("status", status);
      if (dateFrom) allParams.set("dateFrom", dateFrom);
      if (dateTo) allParams.set("dateTo", dateTo);
      if (search) allParams.set("search", search);

      const res = await fetch(`/api/reports/messages?${allParams}`);
      const result = await res.json();
      if (!result.success || !result.data?.length) {
        toast.error("No data to export");
        return;
      }

      const headers = [
        "Message ID",
        "Customer",
        "Account",
        "System ID",
        "Route",
        "Sender",
        "Destination",
        "Encoding",
        "Parts",
        "Status",
        "Error Code",
        "Submitted At",
        "Delivered At",
      ];
      const rows = result.data.map((m: ReportMessage) => [
        m.messageId,
        m.customerName,
        m.accountName,
        m.systemId,
        m.routeName,
        m.senderId,
        m.destination,
        m.encoding,
        m.parts,
        m.status,
        m.errorCode || "",
        m.submittedAt,
        m.deliveredAt || "",
      ]);

      const csv = [headers, ...rows]
        .map((row) =>
          row.map((cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sms-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch {
      toast.error("Export failed");
    }
  }

  const statusColor = (s: string) => {
    switch (s) {
      case "delivered":
        return "default";
      case "failed":
        return "destructive";
      case "queued":
      case "sending":
        return "secondary";
      default:
        return "outline" as "default";
    }
  };

  return (
    <>
      <TopBar title="Customer Reports" />
      <div className="page-content">
        {/* Filter Bar */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <span className="text-xs text-slate-500">Account</span>
            <Select
              value={accountId}
              onValueChange={(v) => {
                if (v !== null) setAccountId(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All accounts</SelectItem>
                {accounts.map(
                  (a: { id: number; systemId: string; accountName: string | null }) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.accountName || a.systemId}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <span className="text-xs text-slate-500">Status</span>
            <Select
              value={status}
              onValueChange={(v) => {
                if (v !== null) setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="sending">Sending</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <span className="text-xs text-slate-500">From</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-[150px]"
            />
          </div>

          <div className="grid gap-1">
            <span className="text-xs text-slate-500">To</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-[150px]"
            />
          </div>

          <div className="grid gap-1">
            <span className="text-xs text-slate-500">Search</span>
            <div className="flex gap-1">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Number or Message ID"
                className="w-[200px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") setPage(1);
                }}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(1)}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {[
            { label: "Total", value: stats.total || 0, color: "text-slate-800" },
            { label: "Queued", value: stats.queued || 0, color: "text-amber-600" },
            { label: "Sending", value: stats.sending || 0, color: "text-blue-600" },
            { label: "Sent", value: stats.sent || 0, color: "text-indigo-600" },
            { label: "Delivered", value: stats.delivered || 0, color: "text-emerald-600" },
            { label: "Failed", value: stats.failed || 0, color: "text-red-600" },
            {
              label: "DLR%",
              value: stats.dlrPercent != null ? `${stats.dlrPercent}%` : "-",
              color: "text-purple-600",
            },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="flex flex-col items-center py-3">
                <span className="text-xs text-slate-500">{s.label}</span>
                <span className={`text-lg font-bold tabular-nums ${s.color}`}>
                  {typeof s.value === "number"
                    ? s.value.toLocaleString()
                    : s.value}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Messages Table */}
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Parts</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-slate-500"
                  >
                    <div className="flex flex-col items-center gap-2 py-8">
                      <BarChart3 className="h-8 w-8 text-slate-300" />
                      No messages found
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {messages.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(m.submittedAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false,
                    })}
                  </TableCell>
                  <TableCell className="text-xs">
                    {m.accountName}
                    <br />
                    <span className="text-slate-400">{m.systemId}</span>
                  </TableCell>
                  <TableCell className="text-xs">{m.senderId}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {m.destination}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">
                    {m.messageText}
                  </TableCell>
                  <TableCell className="text-xs">{m.parts}</TableCell>
                  <TableCell>
                    <Badge variant={statusColor(m.status)} className="text-xs">
                      {m.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-red-500">
                    {m.errorCode || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Page {pagination.page} of {pagination.totalPages} (
            {pagination.total} total)
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
CUSTREPORTS_EOF
echo "  [17/17] customers/reports/page.tsx updated"

echo ""
echo "All files updated. Run: cd $APP_DIR && npm run build && pm2 restart smslocal-bss-web"
