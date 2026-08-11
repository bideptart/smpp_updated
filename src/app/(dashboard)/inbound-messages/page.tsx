"use client";

import { useState } from "react";
import useSWR from "swr";
import TopBar from "@/components/layout/TopBar";
import StatCard from "@/components/common/StatCard";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/button";
import {
  Inbox, Search, X, RefreshCw, MessageSquare, UserCheck, UserX, Clock,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface InboundMessageRow {
  id: number;
  fromAddr: string;
  toAddr: string;
  messageText: string | null;
  customerId: number | null;
  customerName: string | null;
  receivedAt: string;
}

/** "3m ago" / "2h ago" / "5d ago" — falls back to a date past a week.
 *  `now` is passed in (see useNow) so render stays pure. */
function relativeTime(iso: string, now: number) {
  const then = new Date(iso).getTime();
  if (!now) return new Date(iso).toLocaleDateString();
  const mins = Math.floor((now - then) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return "—";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function InboundMessagesPage() {
  const { data, mutate } = useSWR("/api/inbound-messages", fetcher, { refreshInterval: 10000 });
  const messages: InboundMessageRow[] = data?.data || [];

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "matched" | "unmatched">("all");

  const now = useNow();
  // Before hydration `now` is 0; treat the 24h bucket as empty rather than
  // counting every message as recent.
  const dayAgo = now ? now - 24 * 60 * 60 * 1000 : Infinity;
  const stats = {
    total: messages.length,
    matched: messages.filter((m) => m.customerId !== null).length,
    unmatched: messages.filter((m) => m.customerId === null).length,
    last24h: messages.filter((m) => new Date(m.receivedAt).getTime() >= dayAgo).length,
  };

  const q = query.trim().toLowerCase();
  const visible = messages.filter((m) => {
    if (scope === "matched" && m.customerId === null) return false;
    if (scope === "unmatched" && m.customerId !== null) return false;
    if (!q) return true;
    return (
      m.fromAddr.toLowerCase().includes(q) ||
      m.toAddr.toLowerCase().includes(q) ||
      (m.messageText || "").toLowerCase().includes(q) ||
      (m.customerName || "").toLowerCase().includes(q)
    );
  });

  return (
    <>
      <TopBar
        title="Inbound Messages"
        subtitle="Two-way SMS (MO) replies pushed in by Jasmin"
        actions={
          <Button variant="outline" size="sm" onClick={() => mutate()} title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <div className="page-content">
        <div className="dp-stats">
          <StatCard icon={MessageSquare} label="Total Received" value={stats.total} color="var(--t-text-4)" bg="var(--t-bg-muted)" />
          <StatCard icon={Clock} label="Last 24h" value={stats.last24h} color="var(--t-indigo-fg)" bg="var(--t-indigo-bg)" />
          <StatCard icon={UserCheck} label="Matched" value={stats.matched} color="var(--t-green-fg)" bg="var(--t-green-bg)" />
          <StatCard icon={UserX} label="Unmatched" value={stats.unmatched} color="var(--t-amber-fg)" bg="var(--t-amber-bg)" />
        </div>

        <div className="help-card">
          <div className="help-card-title">How matching works</div>
          <p className="help-card-text">
            Inbound messages are matched to a customer by comparing the receiving number against
            each customer&apos;s SMPP account source address. Unmatched messages still appear here
            with no customer attached, so nothing is silently dropped.
          </p>
        </div>

        <div className="dp-toolbar">
          <div className="dp-search">
            <Search className="dp-search-icon" />
            <input
              className="dp-search-input"
              placeholder="Search number, text or customer…"
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
            {(["all", "matched", "unmatched"] as const).map((s) => (
              <button
                key={s}
                className={`dp-seg-btn${scope === s ? " dp-seg-btn--active" : ""}`}
                onClick={() => setScope(s)}
              >
                {s === "all" ? "All" : s === "matched" ? "Matched" : "Unmatched"}
              </button>
            ))}
          </div>
          <span className="dp-count">
            {visible.length} of {messages.length} message{messages.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="dp-card">
          {visible.length === 0 ? (
            <div className="dp-empty">
              <div className="dp-empty-icon"><Inbox className="h-5 w-5" /></div>
              <div className="dp-empty-title">
                {messages.length === 0 ? "No inbound messages received yet" : "No messages match your search"}
              </div>
              <div className="dp-empty-hint">
                {messages.length === 0
                  ? "Replies from your customers' recipients will appear here automatically."
                  : "Try a different term or clear the filters."}
              </div>
            </div>
          ) : (
            <div className="dp-scroll">
              <table className="dp-table">
                <thead>
                  <tr>
                    <th className="dp-th">From</th>
                    <th className="dp-th">To</th>
                    <th className="dp-th">Message</th>
                    <th className="dp-th">Customer</th>
                    <th className="dp-th dp-th--right">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((m) => (
                    <tr key={m.id} className="dp-tr">
                      <td className="dp-td dp-td--strong dp-td--mono">{m.fromAddr}</td>
                      <td className="dp-td dp-td--mono dp-td--muted">{m.toAddr}</td>
                      <td className="dp-td">
                        <div className="dp-msg" title={m.messageText || undefined}>
                          {m.messageText || <span className="dp-td--muted">—</span>}
                        </div>
                      </td>
                      <td className="dp-td">
                        {m.customerName ? (
                          m.customerName
                        ) : (
                          <span className="dp-pill dp-pill--amber">Unmatched</span>
                        )}
                      </td>
                      <td className="dp-td dp-td--right">
                        {relativeTime(m.receivedAt, now)}
                        <span className="dp-sub">
                          {new Date(m.receivedAt).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
