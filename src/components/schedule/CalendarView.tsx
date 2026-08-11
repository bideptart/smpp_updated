"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Users, MessageSquare, Calendar as CalIcon } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface Campaign {
  id: number;
  senderId: string;
  messageText: string;
  recipientsCount: number;
  scheduledAt: string;
  nextRunAt: string | null;
  repeatFreq: string;
  status: string;
}

export type ViewMode = "month" | "week" | "day";

export interface PreviewEvent {
  scheduledAt: Date;
  recipientsCount: number;
  messageText: string;
  senderId: string;
  repeat: string;
}

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay();
  out.setDate(out.getDate() - day);
  out.setHours(0, 0, 0, 0);
  return out;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function fmtDate(d: Date, opts?: Intl.DateTimeFormatOptions) {
  return d.toLocaleDateString("en-GB", opts);
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function CalendarView({
  customerId,
  previewEvent,
  statusFilter,
}: {
  customerId: number | null;
  previewEvent?: PreviewEvent | null;
  statusFilter?: string;
}) {
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(new Date());

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === "month") {
      const start = startOfMonth(cursor);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
      return { rangeStart: start, rangeEnd: end };
    }
    if (view === "week") {
      const start = startOfWeek(cursor);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59);
      return { rangeStart: start, rangeEnd: end };
    }
    const start = new Date(cursor);
    start.setHours(0, 0, 0, 0);
    const end = new Date(cursor);
    end.setHours(23, 59, 59);
    return { rangeStart: start, rangeEnd: end };
  }, [view, cursor]);

  const params = new URLSearchParams();
  if (customerId) params.set("customerId", String(customerId));
  params.set("from", rangeStart.toISOString());
  params.set("to", rangeEnd.toISOString());
  if (statusFilter) params.set("status", statusFilter);

  const { data } = useSWR(customerId ? `/api/schedule?${params}` : null, fetcher);
  const campaigns: Campaign[] = data?.data || [];

  const allCampaigns: Array<Campaign & { _preview?: boolean }> = useMemo(() => {
    const base: Array<Campaign & { _preview?: boolean }> = campaigns.map((c) => ({ ...c }));
    if (previewEvent) {
      base.push({
        id: -1,
        senderId: previewEvent.senderId,
        messageText: previewEvent.messageText,
        recipientsCount: previewEvent.recipientsCount,
        scheduledAt: previewEvent.scheduledAt.toISOString(),
        nextRunAt: previewEvent.scheduledAt.toISOString(),
        repeatFreq: previewEvent.repeat,
        status: "pending",
        _preview: true,
      });
    }
    return base;
  }, [campaigns, previewEvent]);

  const byDay = useMemo(() => {
    const m = new Map<string, Array<Campaign & { _preview?: boolean }>>();
    for (const c of allCampaigns) {
      const d = new Date(c.nextRunAt || c.scheduledAt);
      const key = d.toISOString().slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(c);
    }
    return m;
  }, [allCampaigns]);

  function navigate(delta: number) {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + delta);
    else if (view === "week") d.setDate(d.getDate() + delta * 7);
    else d.setDate(d.getDate() + delta);
    setCursor(d);
  }

  function title() {
    if (view === "month")
      return cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    if (view === "week") {
      const s = startOfWeek(cursor);
      const e = new Date(s);
      e.setDate(s.getDate() + 6);
      return `${fmtDate(s, { day: "numeric", month: "short" })} – ${fmtDate(e, { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return fmtDate(cursor, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  return (
    <div className="cal-body">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="cal-title">{title()}</span>
          <Button variant="outline" size="sm" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
        </div>
        <div className="cal-view-toggle">
          {(["month", "week", "day"] as const).map((m) => (
            <button
              key={m}
              className={`cal-view-btn ${view === m ? "cal-view-btn--active" : ""}`}
              onClick={() => setView(m)}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {view === "month" && (
        <MonthView
          cursor={cursor}
          byDay={byDay}
          onDayClick={(d) => {
            setCursor(d);
            setView("day");
          }}
        />
      )}
      {view === "week" && <WeekView cursor={cursor} byDay={byDay} />}
      {view === "day" && (
        <DayView cursor={cursor} campaigns={byDay.get(cursor.toISOString().slice(0, 10)) || []} />
      )}
    </div>
  );
}

function MonthView({
  cursor,
  byDay,
  onDayClick,
}: {
  cursor: Date;
  byDay: Map<string, Array<Campaign & { _preview?: boolean }>>;
  onDayClick: (d: Date) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const firstCellDate = startOfWeek(monthStart);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(firstCellDate);
    d.setDate(firstCellDate.getDate() + i);
    cells.push(d);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="cal-month">
      <div className="cal-month-head">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="cal-month-dow">{d}</div>
        ))}
      </div>
      <div className="cal-month-grid">
        {cells.map((d, i) => {
          const key = d.toISOString().slice(0, 10);
          const events = byDay.get(key) || [];
          const isOutside = d.getMonth() !== cursor.getMonth();
          const isToday = d.getTime() === today.getTime();
          const totalRecipients = events.reduce((s, e) => s + e.recipientsCount, 0);
          return (
            <button
              key={i}
              className={`cal-day-cell ${isOutside ? "cal-day-cell--out" : ""} ${isToday ? "cal-day-cell--today" : ""}`}
              onClick={() => onDayClick(d)}
            >
              <div className="cal-day-num">{d.getDate()}</div>
              {events.length > 0 && (
                <div className="cal-day-events">
                  <div className={`cal-day-event ${events.some((e) => e._preview) ? "cal-day-event--preview" : ""}`}>
                    {events.length} campaign{events.length > 1 ? "s" : ""}
                  </div>
                  <div className="cal-day-count">
                    <Users className="h-3 w-3" />
                    {totalRecipients.toLocaleString()}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  cursor,
  byDay,
}: {
  cursor: Date;
  byDay: Map<string, Array<Campaign & { _preview?: boolean }>>;
}) {
  const start = startOfWeek(cursor);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return (
    <div className="cal-week">
      {days.map((d) => {
        const key = d.toISOString().slice(0, 10);
        const events = byDay.get(key) || [];
        return (
          <div key={key} className="cal-week-col">
            <div className="cal-week-head">
              <span className="cal-week-dow">{d.toLocaleDateString("en-GB", { weekday: "short" })}</span>
              <span className="cal-week-num">{d.getDate()}</span>
            </div>
            <div className="cal-week-events">
              {events.length === 0 && <div className="cal-week-empty">—</div>}
              {events.map((e, i) => <EventCard key={i} event={e} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({
  cursor,
  campaigns,
}: {
  cursor: Date;
  campaigns: Array<Campaign & { _preview?: boolean }>;
}) {
  void cursor;
  const sorted = [...campaigns].sort((a, b) => {
    const aT = new Date(a.nextRunAt || a.scheduledAt).getTime();
    const bT = new Date(b.nextRunAt || b.scheduledAt).getTime();
    return aT - bT;
  });
  return (
    <div className="cal-day-list">
      {sorted.length === 0 && (
        <div className="cal-day-empty">
          <CalIcon className="h-10 w-10 text-slate-300" />
          <p>No scheduled messages for this day</p>
        </div>
      )}
      {sorted.map((e, i) => <EventCard key={i} event={e} expanded />)}
    </div>
  );
}

function EventCard({ event, expanded = false }: { event: Campaign & { _preview?: boolean }; expanded?: boolean }) {
  const [open, setOpen] = useState(expanded);
  const time = new Date(event.nextRunAt || event.scheduledAt);
  const msg = event.messageText || "";
  const longMsg = msg.length > 120;
  const visibleMsg = !longMsg || open ? msg : msg.slice(0, 120) + "…";
  const isPreview = !!event._preview;

  return (
    <div className={`cal-event-card ${isPreview ? "cal-event-card--preview" : ""}`}>
      <div className="cal-event-time">{fmtTime(time)}</div>
      <div className="cal-event-main">
        <div className="cal-event-top">
          <span className="cal-event-sender">{event.senderId || "SMSLCL"}</span>
          {isPreview && <span className="cal-event-preview-badge">Preview</span>}
          {event.repeatFreq !== "none" && (
            <span className="cal-event-repeat">⟲ {event.repeatFreq}</span>
          )}
        </div>
        <div className="cal-event-meta">
          <Users className="h-3.5 w-3.5" />
          <span>{event.recipientsCount.toLocaleString()} recipients</span>
        </div>
        <div className="cal-event-msg">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{visibleMsg}</span>
        </div>
        {longMsg && (
          <button type="button" className="cal-event-readmore" onClick={() => setOpen(!open)}>
            {open ? "Show less" : "Read more"}
          </button>
        )}
      </div>
    </div>
  );
}
