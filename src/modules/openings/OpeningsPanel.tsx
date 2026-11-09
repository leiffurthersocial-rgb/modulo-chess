"use client";

import { BookOpen, Database } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState, Section } from "@/components/ui/primitives";
import { useCurrentNode, useCurrentPath } from "@/hooks/useGameSelectors";
import { useGame } from "@/stores/game";
import { useOpeningDb } from "@/stores/openings";
import { localEcoProvider, type ExplorerResult } from "./lookup";

export function OpeningsPanel() {
  const node = useCurrentNode();
  const path = useCurrentPath();
  const playMove = useGame((s) => s.playMove);
  const mode = useGame((s) => s.mode);
  const error = useOpeningDb((s) => s.error);
  const [result, setResult] = useState<{ fen: string; data: ExplorerResult } | null>(null);

  useEffect(() => {
    let alive = true;
    localEcoProvider
      .explore(node.fen, path)
      .then((data) => alive && setResult({ fen: node.fen, data }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [node.fen, path]);

  const data = result?.fen === node.fen ? result.data : null;

  return (
    <div className="flex flex-col gap-3">
      <Section title="Opening">
        {error ? (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        ) : !data ? (
          <div className="flex flex-col gap-2">
            <div className="skeleton h-4 w-12" />
            <div className="skeleton h-6 w-3/4" />
          </div>
        ) : data.opening ? (
          <div className="animate-in" key={data.opening.name}>
            <p className="text-accent font-mono text-xs font-semibold">{data.opening.eco}</p>
            <p className="font-display text-text mt-1 text-2xl leading-tight">{data.opening.name}</p>
            {data.opening.nodeId && data.opening.nodeId !== node.id ? (
              <p className="text-faint mt-1 text-xs">Out of book — last named position shown.</p>
            ) : null}
          </div>
        ) : (
          <p className="text-muted text-sm">{path.length > 1 ? "Unnamed position" : "Starting position"}</p>
        )}
      </Section>

      <Section title="Book moves">
        {!data ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-8" />
            ))}
          </div>
        ) : data.moves.length ? (
          <ul className="flex flex-col gap-0.5">
            {data.moves.map((m) => (
              <li key={m.uci}>
                <button
                  type="button"
                  disabled={mode === "play"}
                  onClick={() => playMove(m.uci)}
                  className="hover:bg-surface-3 flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-50"
                >
                  <span className="text-text w-14 font-mono font-medium">{m.san}</span>
                  <span className="text-muted min-w-0 flex-1 truncate">{m.opening.name}</span>
                  <span className="text-faint font-mono text-[11px]">{m.opening.eco}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<BookOpen className="size-5" />} title="No named continuations">
            None of the legal moves here lead to a named ECO position.
          </EmptyState>
        )}
      </Section>

      <div className="text-faint ring-border ring-dashed flex items-start gap-3 rounded-2xl p-3 text-xs leading-relaxed ring-1">
        <Database className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Source: <b className="text-muted">{localEcoProvider.name}</b> — 3,800+ named lines from the CC0
          lichess-org/chess-openings dataset, bundled and fully offline. Move statistics from game databases
          will plug in as additional explorer providers.
        </p>
      </div>
    </div>
  );
}
