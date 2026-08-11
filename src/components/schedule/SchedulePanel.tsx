"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Calendar, Globe, Repeat } from "lucide-react";

export interface ScheduleSettings {
  date: string;
  hour: string;
  minute: string;
  timezone: string;
  repeat: string;
}

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

const REPEAT_OPTIONS = [
  { value: "none", label: "Doesn't repeat" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export default function SchedulePanel({
  value,
  onChange,
}: {
  value: ScheduleSettings;
  onChange: (v: ScheduleSettings) => void;
}) {
  const update = (patch: Partial<ScheduleSettings>) => onChange({ ...value, ...patch });
  const repeatLabel =
    REPEAT_OPTIONS.find((o) => o.value === value.repeat)?.label || "Doesn't repeat";

  return (
    <div className="schedule-panel">
      <div className="schedule-title">
        <Calendar className="h-4 w-4 text-blue-500" />
        <span>Schedule</span>
      </div>

      <div className="schedule-grid">
        {/* Row 1: Date + Time */}
        <div className="schedule-field">
          <Label className="schedule-label">First send date</Label>
          <Input
            type="date"
            value={value.date}
            onChange={(e) => update({ date: e.target.value })}
            className="schedule-input"
          />
        </div>

        <div className="schedule-field">
          <Label className="schedule-label">Time</Label>
          <div className="schedule-time-wrap">
            <Input
              type="number"
              min="0"
              max="23"
              value={value.hour}
              onChange={(e) => update({ hour: e.target.value.padStart(2, "0").slice(-2) })}
              className="schedule-time-digit"
            />
            <span className="schedule-time-colon">:</span>
            <Input
              type="number"
              min="0"
              max="59"
              value={value.minute}
              onChange={(e) => update({ minute: e.target.value.padStart(2, "0").slice(-2) })}
              className="schedule-time-digit"
            />
            <span className="schedule-time-hint">24-hour</span>
          </div>
        </div>

        {/* Row 2: Timezone */}
        <div className="schedule-field">
          <Label className="schedule-label">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            Timezone
          </Label>
          <Select value={value.timezone} onValueChange={(v) => v && update({ timezone: v })}>
            <SelectTrigger className="schedule-input">
              <span>{value.timezone}</span>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Row 2: Repeat */}
        <div className="schedule-field">
          <Label className="schedule-label">
            <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
            Repeat
          </Label>
          <Select value={value.repeat} onValueChange={(v) => v && update({ repeat: v })}>
            <SelectTrigger className="schedule-input">
              <span>{repeatLabel}</span>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {REPEAT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="schedule-footnote">
        Daylight saving time (DST) is automatically considered.
      </p>
    </div>
  );
}
