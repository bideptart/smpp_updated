"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wraps the app in next-themes using the `class` strategy, which is what
 * `@custom-variant dark (&:is(.dark *))` in globals.css expects.
 *
 * enableSystem is OFF and there are exactly two themes, light and dark.
 * With system enabled, `theme` could hold a third value that the two-state
 * toggle has no way to represent.
 *
 * disableTransitionOnChange is deliberately ON: next-themes freezes CSS
 * transitions for the duration of the swap so the whole page flips at once
 * instead of every element easing at its own rate.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      themes={["light", "dark"]}
      disableTransitionOnChange
      storageKey="smslocal-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
