"use client";

import { useSyncExternalStore } from "react";

/**
 * A ticking clock exposed as an external store.
 *
 * Calling `Date.now()` directly in a component body is an impure render (and
 * the project's lint rules reject it). Reading the time through
 * useSyncExternalStore keeps render pure and makes anything derived from
 * "now" — relative timestamps, age buckets — refresh on its own.
 *
 * The snapshot is module-level and only changes on a tick, which is what
 * useSyncExternalStore requires: returning a fresh Date.now() per call would
 * make React loop forever.
 */
const TICK_MS = 30_000;

let clockNow = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    clockNow = Date.now();
    timer = setInterval(() => {
      clockNow = Date.now();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

// 0 on the server: these screens render their rows from client-side SWR data,
// so nothing time-dependent is emitted during SSR anyway.
const getSnapshot = () => clockNow;
const getServerSnapshot = () => 0;

/** Milliseconds since epoch, updated every 30s. Returns 0 before hydration. */
export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
