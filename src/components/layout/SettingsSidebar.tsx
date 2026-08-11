"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Settings as SettingsIcon,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    label: "ADMINISTRATION",
    items: [
      { name: "My account", href: "/settings/my-account", icon: UserCircle },
    ],
  },
];

export default function SettingsSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // localStorage isn't available during SSR, so this reads and corrects the
  // collapsed state after mount rather than up front -- standard way to
  // avoid a hydration mismatch for browser-only persisted UI state.
  useEffect(() => {
    try {
      const stored = localStorage.getItem("settings-sidebar-collapsed");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(stored === "true");
    } catch {}
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("settings-sidebar-collapsed", String(next));
    } catch {}
  }

  function isActive(href: string) {
    if (href === "/settings") return pathname === "/settings";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className={`settings-sidebar ${collapsed ? "settings-sidebar--collapsed" : ""}`}>
      <div className="settings-sidebar-header">
        {!collapsed && (
          <div className="settings-sidebar-title-row">
            <SettingsIcon className="h-4 w-4 text-muted-foreground" />
            <h2 className="settings-sidebar-title">Settings</h2>
          </div>
        )}
        <button
          type="button"
          className="settings-sidebar-collapse-btn"
          onClick={toggleCollapse}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      <nav className="settings-sidebar-nav">
        {SECTIONS.map((section) => (
          <div key={section.label} className="settings-sidebar-section">
            {!collapsed && <div className="settings-sidebar-section-label">{section.label}</div>}
            <ul className="settings-sidebar-list">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`settings-sidebar-item ${isActive(item.href) ? "settings-sidebar-item--active" : ""}`}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon className="settings-sidebar-item-icon" />
                    {!collapsed && <span className="settings-sidebar-item-text">{item.name}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
