import type { ComponentType } from "react";

/**
 * KPI tile used across the data pages. Extracted from the dashboard so the
 * markup and `campaign-stat-*` classes live in exactly one place.
 *
 * `color` / `bg` should be theme tokens (e.g. "var(--t-green-fg)"), not raw
 * hex, or the tile will not follow the light/dark switch.
 */
export default function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
  bg: string;
}) {
  return (
    <div className="campaign-stat-card">
      <div className="campaign-stat-icon" style={{ background: bg, color }}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="campaign-stat-info">
        <span className="campaign-stat-label">{label}</span>
        <span className="campaign-stat-value" style={{ color }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
      </div>
    </div>
  );
}
