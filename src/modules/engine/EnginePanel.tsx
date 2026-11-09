"use client";

import { AlertTriangle, ChevronDown, Play, RotateCcw } from "lucide-react";
import { memo, useMemo } from "react";
import { formatEval, whiteWinPercent } from "@/core/engine/evaluation";
import type { EngineLine } from "@/core/engine/types";
import { uciLineToSan, fullMoveNumber, sideToMove } from "@/core/chess/tree";
import { Button, IconButton, Section, Segmented, cx } from "@/components/ui/primitives";
import { useCurrentNode, useCurrentStatus } from "@/hooks/useGameSelectors";
import { useEngine } from "@/stores/engine";
import { useGame } from "@/stores/game";
import { useReview } from "@/stores/review";
import { useSettings } from "@/stores/settings";
import { OpeningSummary } from "@/modules/openings/OpeningSummary";

/** "Stockfish 19 Lite Multithreaded WASM" → "Stockfish 19 Lite · multi-threaded" */
function engineLabel(name: string, flavor: "multi" | "single" | null): string {
  const base = name
    .replace(/\s*WASM\s*/i, "")
    .replace(/\s*Multithreaded/i, "")
    .trim();
  return `${base} · ${flavor === "multi" ? "multi-threaded" : "single-threaded"}`;
}

function formatNodes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}G`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return String(n);
}

export function EnginePanel() {
  const enabled = useEngine((s) => s.enabled);
  const setEnabled = useEngine((s) => s.setEnabled);
  const status = useEngine((s) => s.status);
  const error = useEngine((s) => s.error);
  const retry = useEngine((s) => s.retry);
  const flavor = useEngine((s) => s.flavor);
  const notice = useEngine((s) => s.notice);
  const engineName = useEngine((s) => s.engineName);
  const snapshot = useEngine((s) => s.snapshot);
  const searching = useEngine((s) => s.searching);
  const mode = useGame((s) => s.mode);
  const reviewRunning = useReview((s) => s.status === "running");
  const node = useCurrentNode();
  const st = useCurrentStatus();
  const engine = useSettings((s) => s.engine);
  const setEngine = useSettings((s) => s.setEngine);
  const threads = useSettings((s) => s.engine.threads);

  const current = snapshot && snapshot.fen === node.fen ? snapshot : null;
  const top = current?.lines[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-surface-2 flex items-center gap-3 rounded-xl p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <span
              className={cx(
                "tabular font-mono text-[28px] leading-none font-semibold tracking-tight",
                !top && "text-faint",
              )}
              aria-live="polite"
            >
              {st.kind === "checkmate"
                ? st.turn === "w"
                  ? "0-1"
                  : "1-0"
                : st.kind !== "playing"
                  ? "½-½"
                  : top
                    ? formatEval(top.eval)
                    : "—"}
            </span>
            {top ? (
              <span className="tabular text-faint font-mono text-xs">
                W {Math.round(whiteWinPercent(top.eval))}%
              </span>
            ) : null}
          </div>
          <p className="text-faint mt-1.5 truncate text-xs">
            {mode === "play"
              ? "Analysis is paused while you play."
              : reviewRunning
                ? "Paused during game review."
                : st.kind !== "playing"
                  ? st.text
                  : !enabled
                    ? "Engine is off — runs locally in your browser."
                    : status === "loading"
                      ? "Loading Stockfish…"
                      : current
                        ? `Depth ${current.stats.depth}${current.stats.seldepth ? `/${current.stats.seldepth}` : ""} · ${formatNodes(current.stats.nps)} n/s · ${formatNodes(current.stats.nodes)} nodes`
                        : "Thinking…"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            disabled={mode === "play"}
            className={cx(
              "press font-display flex h-11 items-center gap-2 rounded-xl px-4 text-[15px] font-bold disabled:opacity-40",
              enabled ? "bg-surface-3 text-text" : "press-accent bg-accent text-accent-ink",
            )}
          >
            {enabled ? (
              <>
                <span className={cx("bg-accent size-2 rounded-full", searching && "pulse-dot")} aria-hidden />
                Stop
              </>
            ) : (
              <>
                <Play className="size-3.5" aria-hidden />
                Analyze
              </>
            )}
          </button>
        </div>
      </div>

      {enabled && status === "error" ? (
        <div role="alert" className="bg-danger/10 ring-danger/30 animate-in rounded-2xl p-4 ring-1">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-danger mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-text text-sm font-medium">Stockfish couldn’t start</p>
              <p className="text-muted mt-1 text-xs leading-relaxed">
                {error ?? "Unknown error."} Your browser needs WebAssembly and Web Worker support. Try
                reloading, switching the engine build to “Single-threaded” in Settings, or using a recent
                Chrome, Firefox, Edge or Safari.
              </p>
              <Button size="sm" className="mt-3" onClick={retry}>
                <RotateCcw className="size-3.5" aria-hidden /> Retry
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {enabled && status !== "error" && mode === "analysis" && !reviewRunning && st.kind === "playing" ? (
        <Section
          title="Lines"
          action={
            <span className="text-faint text-[11px]">
              {engineName ? engineLabel(engineName, flavor) : ""}
            </span>
          }
        >
          {current && current.lines.length ? (
            <ol className="flex flex-col gap-1">
              {current.lines.map((line) => (
                <PvLine key={line.multipv} line={line} fen={node.fen} />
              ))}
            </ol>
          ) : (
            <div className="flex flex-col gap-2" aria-label="Loading lines">
              {Array.from({ length: Math.max(1, engine.multiPv) }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="skeleton h-6 w-14" />
                  <div className="skeleton h-6 flex-1" style={{ opacity: 1 - i * 0.18 }} />
                </div>
              ))}
            </div>
          )}
          {notice ? <p className="text-faint mt-3 text-[11px] leading-relaxed">{notice}</p> : null}
        </Section>
      ) : null}

      <OpeningSummary />

      {!enabled && mode === "analysis" ? (
        <p className="text-faint px-1 text-xs leading-relaxed">
          Stockfish 19 runs entirely on your device. Press <b className="text-muted">Analyze</b> (or E) for
          live lines.
        </p>
      ) : null}

      <details className="group bg-surface-2 rounded-xl p-3.5">
        <summary className="font-display text-faint flex cursor-pointer list-none items-center justify-between text-[13px] font-extrabold tracking-wide uppercase">
          Engine settings
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <p className="text-text mb-1.5 text-sm">Lines (MultiPV)</p>
            <Segmented
              label="Number of lines"
              size="sm"
              value={String(engine.multiPv)}
              onChange={(v) => setEngine({ multiPv: Number(v) })}
              options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
            />
          </div>
          <div>
            <p className="text-text mb-1.5 text-sm">Depth limit</p>
            <Segmented
              label="Depth limit"
              size="sm"
              value={String(engine.depthLimit)}
              onChange={(v) => setEngine({ depthLimit: Number(v) })}
              options={[
                { value: "0", label: "∞", title: "Unlimited" },
                { value: "16", label: "16" },
                { value: "20", label: "20" },
                { value: "24", label: "24" },
                { value: "30", label: "30" },
              ]}
            />
          </div>
          <ThreadsHash threads={threads} />
        </div>
      </details>
    </div>
  );
}

function ThreadsHash({ threads }: { threads: number }) {
  const hashMb = useSettings((s) => s.engine.hashMb);
  const setEngine = useSettings((s) => s.setEngine);
  const maxThreads = useEngine((s) => s.maxThreads);
  const flavor = useEngine((s) => s.flavor);
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="text-text flex flex-col gap-1.5 text-sm">
        Threads
        <select
          className="bg-surface-3 ring-border-strong h-9 rounded-xl px-2.5 text-sm ring-1"
          value={threads}
          onChange={(e) => setEngine({ threads: Number(e.target.value) })}
          disabled={flavor === "single"}
          title={
            flavor === "single" ? "Threads require cross-origin isolation (multi-threaded build)" : undefined
          }
        >
          <option value={0}>Auto</option>
          {Array.from({ length: Math.max(1, maxThreads) }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="text-text flex flex-col gap-1.5 text-sm">
        Hash
        <select
          className="bg-surface-3 ring-border-strong h-9 rounded-xl px-2.5 text-sm ring-1"
          value={hashMb}
          onChange={(e) => setEngine({ hashMb: Number(e.target.value) })}
        >
          {[16, 32, 64, 128, 256, 512].map((n) => (
            <option key={n} value={n}>
              {n} MB
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

const PvLine = memo(function PvLine({ line, fen }: { line: EngineLine; fen: string }) {
  const setPreview = useGame((s) => s.setPreview);
  const preview = useGame((s) => s.preview);
  const playMove = useGame((s) => s.playMove);
  const moves = useMemo(() => uciLineToSan(fen, line.pv.slice(0, 14)), [fen, line.pv]);
  const startNum = fullMoveNumber(fen);
  const startWhite = sideToMove(fen) === "w";

  const playUpTo = (idx: number) => {
    for (let i = 0; i <= idx; i++) if (!playMove(moves[i].uci)) break;
  };

  const winner = line.eval.kind === "mate" ? line.eval.winner : line.eval.cp >= 0 ? "w" : "b";
  return (
    <li className="group hover:bg-surface-3/60 flex items-start gap-2 rounded-xl px-1 py-1">
      <span
        className={cx(
          "tabular mt-0.5 w-[58px] shrink-0 rounded-lg px-1.5 py-0.5 text-center font-mono text-[12.5px] font-semibold",
          winner === "w"
            ? "bg-[var(--eval-white)] text-[#16191e]"
            : "ring-border-strong bg-[var(--eval-black)] text-[#f1f1ec] ring-1",
        )}
      >
        {formatEval(line.eval)}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-0.5 font-mono text-[13px] leading-6">
        {moves.map((m, i) => {
          const ply = i + (startWhite ? 0 : 1);
          const num = startNum + Math.floor(ply / 2);
          const white = ply % 2 === 0;
          const prefix = white ? `${num}.` : i === 0 ? `${num}…` : "";
          const isPreviewed = preview?.fen === m.fen;
          const label = `${prefix}${m.san}`;
          return (
            <button
              key={`${i}${m.uci}`}
              type="button"
              className={cx(
                "rounded-md px-1 transition-colors duration-[var(--dur-fast)]",
                isPreviewed
                  ? "bg-accent-soft text-accent"
                  : i === 0
                    ? "text-text hover:bg-surface-hover"
                    : "text-muted hover:bg-surface-hover hover:text-text",
              )}
              aria-label={`Preview ${label}`}
              aria-pressed={isPreviewed}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse")
                  setPreview({
                    fen: m.fen,
                    lastMove: { from: m.uci.slice(0, 2), to: m.uci.slice(2, 4) },
                    label,
                  });
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === "mouse" && useGame.getState().preview?.fen === m.fen) setPreview(null);
              }}
              onFocus={() =>
                setPreview({
                  fen: m.fen,
                  lastMove: { from: m.uci.slice(0, 2), to: m.uci.slice(2, 4) },
                  label,
                })
              }
              onBlur={() => setPreview(null)}
              onClick={() =>
                setPreview(
                  isPreviewed
                    ? null
                    : { fen: m.fen, lastMove: { from: m.uci.slice(0, 2), to: m.uci.slice(2, 4) }, label },
                )
              }
              onDoubleClick={() => playUpTo(i)}
            >
              {prefix ? <span className="text-faint">{prefix}</span> : null}
              {m.san}
            </button>
          );
        })}
      </div>
      <IconButton
        label={`Play ${moves[0]?.san ?? "move"}`}
        className="size-7 shrink-0 opacity-60 group-hover:opacity-100"
        onClick={() => moves[0] && playMove(moves[0].uci)}
      >
        <Play className="size-3.5" />
      </IconButton>
    </li>
  );
});
