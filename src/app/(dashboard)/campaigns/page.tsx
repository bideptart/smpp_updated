"use client";

import useSWR from "swr";
import { useState } from "react";
import TopBar from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pause, Play, Square, RefreshCw } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Camp {
  id: number;
  name: string | null;
  status: string;
  createdAt: string;
  customer: string;
  senderId: string | null;
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
}

const STATUSES = ["running", "paused", "cancelled", "completed", "draft"] as const;

/** Falls back to `draft` styling for any status not in the known set. */
function statusKey(s: string) {
  return (STATUSES as readonly string[]).includes(s) ? s : "draft";
}

function compact(n: number) {
  return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();
}

/** Donut showing how much of the campaign has been processed (everything but queued). */
function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(Math.max(pct, 0), 100) / 100) * c;
  return (
    <div className="camp-ring-wrap">
      <svg className="camp-ring" width="76" height="76" viewBox="0 0 76 76">
        <circle className="camp-ring-track" cx="38" cy="38" r={r} strokeWidth="7" />
        <circle
          className="camp-ring-fill"
          cx="38"
          cy="38"
          r={r}
          strokeWidth="7"
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="camp-ring-center">
        <span className="camp-ring-pct">{Math.round(pct)}%</span>
        <span className="camp-ring-cap">done</span>
      </div>
    </div>
  );
}

function CampaignCard({
  c,
  busy,
  onAct,
  onStop,
}: {
  c: Camp;
  busy: boolean;
  onAct: (id: number, action: "pause" | "resume") => void;
  onStop: (id: number) => void;
}) {
  const key = statusKey(c.status);
  // Guard against total=0 so a campaign with no messages yet renders as 0%, not NaN.
  const pct = c.total > 0 ? ((c.total - c.queued) / c.total) * 100 : 0;
  const deliveryRate = c.total > 0 ? (c.delivered / c.total) * 100 : 0;
  const ringColor = key === "cancelled" ? "var(--t-red-fg)" : key === "paused" ? "var(--t-amber-fg)" : "var(--t-green-fg)";
  const seg = (n: number) => (c.total > 0 ? `${(n / c.total) * 100}%` : "0%");

  return (
    <div className={`camp-card camp-card--${key}`}>
      <div className="camp-card-head">
        <div className="camp-card-heading">
          <div className="camp-card-title" title={c.name || `Campaign #${c.id}`}>
            {c.name || `Campaign #${c.id}`}
          </div>
          <div className="camp-card-sub">
            {c.customer}
            {" · "}
            {new Date(c.createdAt).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </div>
        </div>
        <span className={`camp-badge camp-badge--${key}`}>{c.status}</span>
      </div>

      <div className="camp-ring-row">
        <ProgressRing pct={pct} color={ringColor} />
        <div className="camp-ring-side">
          <div>
            <span className="camp-ring-primary">{c.delivered.toLocaleString()}</span>
            <span className="camp-ring-primary-sub"> / {c.total.toLocaleString()}</span>
          </div>
          <div className="camp-ring-cap">delivered</div>
          <div className="camp-ring-note">{deliveryRate.toFixed(1)}% delivery rate</div>
        </div>
      </div>

      <div className="camp-bar">
        <div className="camp-bar-seg camp-bar-seg--delivered" style={{ width: seg(c.delivered) }} />
        <div className="camp-bar-seg camp-bar-seg--sent" style={{ width: seg(c.sent) }} />
        <div className="camp-bar-seg camp-bar-seg--failed" style={{ width: seg(c.failed) }} />
        <div className="camp-bar-seg camp-bar-seg--queued" style={{ width: seg(c.queued) }} />
      </div>

      <div className="camp-legend">
        <div className="camp-legend-item">
          <span className="camp-legend-key">
            <i className="camp-legend-dot" style={{ background: "var(--t-green-fg)" }} />
            Deliv
          </span>
          <span className="camp-legend-val" style={{ color: "var(--t-green-fg)" }}>{compact(c.delivered)}</span>
        </div>
        <div className="camp-legend-item">
          <span className="camp-legend-key">
            <i className="camp-legend-dot" style={{ background: "var(--t-indigo-fg)" }} />
            Sent
          </span>
          <span className="camp-legend-val" style={{ color: "var(--t-indigo-fg)" }}>{compact(c.sent)}</span>
        </div>
        <div className="camp-legend-item">
          <span className="camp-legend-key">
            <i className="camp-legend-dot" style={{ background: "var(--t-red-fg)" }} />
            Failed
          </span>
          <span className="camp-legend-val" style={{ color: "var(--t-red-fg)" }}>{compact(c.failed)}</span>
        </div>
        <div className="camp-legend-item">
          <span className="camp-legend-key">
            <i className="camp-legend-dot" style={{ background: "var(--t-amber-fg)" }} />
            Queued
          </span>
          <span className="camp-legend-val" style={{ color: "var(--t-amber-fg)" }}>{compact(c.queued)}</span>
        </div>
      </div>

      <div className="camp-card-actions">
        {c.status === "running" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onAct(c.id, "pause")}>
            <Pause className="mr-1.5 h-3.5 w-3.5" />
            Pause
          </Button>
        )}
        {c.status === "paused" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onAct(c.id, "resume")}>
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Resume
          </Button>
        )}
        {(c.status === "running" || c.status === "paused") && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onStop(c.id)}
            className="text-red-600"
          >
            <Square className="mr-1.5 h-3.5 w-3.5" />
            Stop
          </Button>
        )}
        {(c.status === "cancelled" || c.status === "completed") && (
          <span className="camp-card-actions-done">No actions available</span>
        )}
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const { data, mutate } = useSWR("/api/campaigns", fetcher, { refreshInterval: 5000 });
  const camps: Camp[] = data?.data || [];
  const [busy, setBusy] = useState(0);
  const [stopId, setStopId] = useState<number | null>(null);

  async function act(id: number, action: "pause" | "resume" | "stop") {
    setBusy(id);
    try {
      const res = await fetch("/api/campaigns/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const j = await res.json();
      if (j.success) { toast.success(`Campaign ${action === "stop" ? "stopped" : action + "d"}`); mutate(); }
      else toast.error(j.error || "Failed");
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(0);
    }
  }

  return (
    <>
      <TopBar
        title="Campaigns"
        subtitle={
          camps.length > 0
            ? `Monitor and control ${camps.length} bulk SMS campaign${camps.length === 1 ? "" : "s"}`
            : "Monitor and control your bulk SMS campaigns"
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => mutate()} title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <div className="page-content">
        <div className="camp-grid">
          {camps.length === 0 ? (
            <div className="camp-empty">No campaigns yet — send a bulk SMS to create one.</div>
          ) : (
            camps.map((c) => (
              <CampaignCard
                key={c.id}
                c={c}
                busy={busy === c.id}
                onAct={act}
                onStop={setStopId}
              />
            ))
          )}
        </div>
      </div>

      <Dialog open={stopId !== null} onOpenChange={(open) => { if (!open) setStopId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Stop campaign</DialogTitle>
            <DialogDescription>
              Remaining queued messages for this campaign will be cancelled. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStopId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const id = stopId;
                setStopId(null);
                if (id !== null) act(id, "stop");
              }}
            >
              Stop campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
