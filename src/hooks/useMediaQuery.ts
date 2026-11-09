"use client";

import { useSyncExternalStore } from "react";

/**
 * Media query match. Returns `null` during SSR/hydration so callers can render a
 * CSS-only fallback first and switch to JS-driven rendering after mount.
 */
export function useMediaQuery(query: string): boolean | null {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => null,
  );
}

export const DESKTOP_QUERY = "(min-width: 1024px)";
