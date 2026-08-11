"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { LogOut, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/theme/ThemeToggle";

export default function TopBar({
  title,
  subtitle,
  actions,
}: {
  title?: string;
  /** Rendered under the title. Pass the page's description here instead of
   *  repeating it in a header block below the bar. */
  subtitle?: string;
  /** Page-level controls (refresh, primary action) shown left of the
   *  global icons, so pages don't need their own toolbar row. */
  actions?: React.ReactNode;
}) {
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
        <div className="topbar-heading">
          <h2 className="topbar-title">{title || "Dashboard"}</h2>
          {subtitle && <p className="topbar-subtitle">{subtitle}</p>}
        </div>
      </div>
      <div className="topbar-right">
        {actions && (
          <>
            <div className="topbar-actions">{actions}</div>
            <div className="topbar-divider" />
          </>
        )}

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

        {/* Theme — sits immediately left of the bell */}
        <ThemeToggle />

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
