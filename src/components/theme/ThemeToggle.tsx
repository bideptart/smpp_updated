"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

// Effect-free "are we on the client yet" check. useSyncExternalStore returns
// the server snapshot (false) during SSR and the client snapshot (true) once
// hydrated, with no setState-in-effect and no extra render pass.
const neverChanges = () => () => {};
const useMounted = () => useSyncExternalStore(neverChanges, () => true, () => false);

/** Two-state theme switch: light <-> dark. There is no system option. */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // The server cannot know the stored theme, so the icon is only correct after
  // hydration. A fixed placeholder avoids a mismatch and an icon flicker.
  const mounted = useMounted();

  if (!mounted) {
    return (
      <button type="button" className="theme-toggle-btn" aria-label="Theme" disabled>
        <Sun className="h-[18px] w-[18px]" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";
  const next = isDark ? "light" : "dark";
  const label = `Switch to ${next} theme`;

  return (
    <button
      type="button"
      className="theme-toggle-btn"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      // Exposes the on/off state to screen readers and to any UI tests.
      role="switch"
      aria-checked={isDark}
    >
      {/* Icon shows the theme currently in effect. */}
      {isDark ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
    </button>
  );
}
