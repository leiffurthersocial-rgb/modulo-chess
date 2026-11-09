"use client";

import { BookOpen } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useCurrentPath } from "@/hooks/useGameSelectors";
import { useOpeningDb } from "@/stores/openings";
import { identifyOpening } from "./lookup";

/** One-line opening name for the current position (used inline by other panels). */
export function OpeningSummary() {
  const path = useCurrentPath();
  const db = useOpeningDb((s) => s.db);
  const load = useOpeningDb((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  const opening = useMemo(() => (db ? identifyOpening(db, path) : null), [db, path]);
  return (
    <div className="bg-surface-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm">
      <BookOpen className="size-4 shrink-0 text-[var(--c-book)]" aria-hidden />
      {opening ? (
        <span className="text-text min-w-0 truncate" title={`${opening.eco} ${opening.name}`}>
          <span className="text-faint font-mono text-xs">{opening.eco}</span> {opening.name}
        </span>
      ) : (
        <span className="text-faint">
          {path.length > 1 ? "Out of the opening book" : "Starting position"}
        </span>
      )}
    </div>
  );
}
