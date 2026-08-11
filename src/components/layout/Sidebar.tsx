"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Send,
  Megaphone,
  Building2,
  Cable,
  Activity,
  Users,
  UserPlus,
  BarChart3,
  Route,
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  Gauge,
  Settings,
  Waypoints,
  ShieldAlert,
  Inbox,
  FileText,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";

interface NavChild {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavChild[];
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Send SMS", href: "/send-sms", icon: Send },
  { name: "Campaigns", href: "/campaigns", icon: Megaphone },
  {
    name: "Company",
    icon: Building2,
    children: [
      { name: "Customer Company", href: "/companies/customers", icon: Users },
      { name: "Vendor Company", href: "/companies/vendors", icon: Building2 },
    ],
  },
  {
    name: "Connections",
    icon: Cable,
    children: [
      { name: "Manage", href: "/connections", icon: Cable },
      { name: "Vendor Live", href: "/connections/vendor-live", icon: Activity },
    ],
  },
  { name: "Routes", href: "/routes", icon: Route },
  { name: "Gateway", href: "/gateway", icon: Waypoints },
  { name: "Content Filters", href: "/content-filters", icon: ShieldAlert },
  { name: "Inbound Messages", href: "/inbound-messages", icon: Inbox },
  { name: "Invoices", href: "/invoices", icon: FileText },
  {
    name: "Customers",
    icon: Users,
    children: [
      { name: "SMPP Accounts", href: "/customers", icon: UserPlus },
      { name: "Live Status", href: "/customers/live-status", icon: Gauge },
      { name: "Reports", href: "/customers/reports", icon: BarChart3 },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  const allHrefs = useMemo(() => {
    const hs: string[] = [];
    for (const it of navigation) {
      if (it.href) hs.push(it.href);
      it.children?.forEach((c) => hs.push(c.href));
    }
    return hs;
  }, []);

  // Lazy initializer, not useMemo: this only needs to run once (on mount,
  // using whatever pathname is current then) to seed which sections start
  // expanded -- a useMemo here doesn't do anything a plain lazy useState
  // initializer doesn't already do, and (with an intentionally-incomplete
  // dependency array) confused the React Compiler's memoization checks.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const result: Record<string, boolean> = {};
    for (const item of navigation) {
      if (item.children) {
        result[item.name] = item.children.some((c) =>
          c.href === "/" ? pathname === "/" : pathname.startsWith(c.href)
        );
      }
    }
    return result;
  });
  const [collapsed, setCollapsed] = useState(false);

  // localStorage isn't available during SSR, so the collapsed state has to
  // be corrected after mount rather than read synchronously up front --
  // this intentionally renders "not collapsed" on the server/first paint
  // and self-corrects immediately after, which is the standard way to
  // avoid a hydration mismatch for browser-only persisted UI state.
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sidebar-collapsed");
      const isCollapsed = stored === "true";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(isCollapsed);
      document.body.classList.toggle("sidebar-collapsed", isCollapsed);
    } catch {}
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("sidebar-collapsed", String(next));
      document.body.classList.toggle("sidebar-collapsed", next);
    } catch {}
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (pathname === href) return true;
    if (!pathname.startsWith(href + "/")) return false;
    return !allHrefs.some(
      (h) => h !== href && h.length > href.length && (pathname === h || pathname.startsWith(h + "/"))
    );
  };

  const toggleGroup = (name: string) => {
    if (collapsed) return;
    setExpanded((prev) => {
      const wasOpen = prev[name];
      const next: Record<string, boolean> = {};
      for (const key of Object.keys(prev)) next[key] = false;
      next[name] = !wasOpen;
      return next;
    });
  };

  return (
    <aside className={`sidebar-root ${collapsed ? "sidebar-root--collapsed" : ""}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <MessageSquare className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="sidebar-logo-text">
            <h1>SMSLocal</h1>
            <p>BSS Platform</p>
          </div>
        )}
        <button
          onClick={toggleCollapse}
          className="sidebar-collapse-btn"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <nav className="sidebar-nav">
        {!collapsed && <div className="sidebar-nav-label">MAIN MENU</div>}
        <ul className="sidebar-nav-list">
          {navigation.map((item) => {
            if (item.children) {
              const hasActiveChild = item.children.some((c) => isActive(c.href));
              const isOpen = expanded[item.name] ?? false;
              return (
                <li key={item.name}>
                  <button
                    onClick={() => toggleGroup(item.name)}
                    className={`sidebar-nav-item sidebar-nav-item--group ${
                      hasActiveChild ? "sidebar-nav-item--has-active" : ""
                    } ${isOpen && !collapsed ? "sidebar-nav-item--expanded" : ""}`}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon className="sidebar-nav-icon" />
                    {!collapsed && (
                      <>
                        <span className="sidebar-nav-label-text">{item.name}</span>
                        <ChevronRight
                          className={`sidebar-chevron ${isOpen ? "sidebar-chevron--open" : ""}`}
                        />
                      </>
                    )}
                  </button>
                  {!collapsed && (
                    <ul className={`sidebar-submenu ${isOpen ? "sidebar-submenu--open" : ""}`}>
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
                  )}
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
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon className="sidebar-nav-icon" />
                  {!collapsed && <span className="sidebar-nav-label-text">{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer sidebar-footer--settings">
        <Link
          href="/settings"
          className={`sidebar-nav-item ${isActive("/settings") ? "sidebar-nav-item--active" : ""}`}
          title={collapsed ? "Settings" : undefined}
        >
          <Settings className="sidebar-nav-icon" />
          {!collapsed && <span className="sidebar-nav-label-text">Settings</span>}
        </Link>
        {!collapsed && <p className="sidebar-footer-version">SMSLocal BSS v2.0</p>}
      </div>
    </aside>
  );
}
