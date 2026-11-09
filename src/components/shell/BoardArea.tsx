"use client";

import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, FlipVertical2, Cpu } from "lucide-react";
import { useCallback, useMemo } from "react";
import { CLASS_META } from "@/core/analysis/classify";
import { uciLineToSan } from "@/core/chess/tree";
import { playSound } from "@/core/sound/sounds";
import { Board, type BoardMove } from "@/components/board/Board";
import type { BoardArrow } from "@/components/board/Arrows";
import { EvalBar } from "@/components/board/EvalBar";
import { material } from "@/components/board/material";
import { IconButton, cx } from "@/components/ui/primitives";
import { useCurrentNode, useCurrentStatus } from "@/hooks/useGameSelectors";
import { strengthLabel } from "@/modules/board/PlayController";
import { useEngine } from "@/stores/engine";
import { useGame } from "@/stores/game";
import { useReview } from "@/stores/review";
import { useSettings } from "@/stores/settings";
import { pieceUrl } from "@/themes/pieces";

const ARROW_STYLE = [
  { opacity: 0.9, width: 1 },
  { opacity: 0.55, width: 0.8 },
  { opacity: 0.4, width: 0.7 },
  { opacity: 0.3, width: 0.6 },
  { opacity: 0.25, width: 0.55 },
];

export function useBoardEvaluation() {
  const node = useCurrentNode();
  const snapshot = useEngine((s) => s.snapshot);
  const enabled = useEngine((s) => s.enabled);
  const status = useEngine((s) => s.status);
  const reviewEval = useReview((s) => s.evals[node.id]);
  const st = useCurrentStatus();
  const live = enabled && snapshot && snapshot.fen === node.fen ? (snapshot.lines[0]?.eval ?? null) : null;
  const terminal =
    st.kind === "checkmate"
      ? ({ kind: "mate", moves: 0, winner: st.turn === "w" ? "b" : "w" } as const)
      : st.kind !== "playing"
        ? ({ kind: "cp", cp: 0 } as const)
        : null;
  return {
    evaluation: terminal ?? live ?? reviewEval?.eval ?? null,
    loading: enabled && (status === "loading" || (status === "ready" && !live)),
  };
}

export function BoardArea({ compact = false }: { compact?: boolean }) {
  const s = useSettings();
  const node = useCurrentNode();
  const status = useCurrentStatus();
  const orientation = useGame((g) => g.orientation);
  const mode = useGame((g) => g.mode);
  const play = useGame((g) => g.play);
  const thinking = useGame((g) => g.thinking);
  const result = useGame((g) => g.result);
  const preview = useGame((g) => g.preview);
  const playMove = useGame((g) => g.playMove);
  const isLeaf = useGame((g) => g.tree.nodes[g.currentId].children.length === 0);
  const headers = useGame((g) => g.headers);
  const engineEnabled = useEngine((e) => e.enabled);
  const snapshot = useEngine((e) => e.snapshot);
  const review = useReview((r) => r.moves[node.id]);
  const { evaluation, loading } = useBoardEvaluation();

  const fen = preview?.fen ?? node.fen;
  const lastMove = preview
    ? preview.lastMove
    : node.from && node.to
      ? { from: node.from, to: node.to }
      : null;

  const interactive =
    !preview &&
    status.kind === "playing" &&
    (mode === "analysis" || (isLeaf && result === "*" && !thinking && status.turn === play.userColor));

  const arrows = useMemo<BoardArrow[]>(() => {
    if (
      preview ||
      mode === "play" ||
      !s.showArrows ||
      !engineEnabled ||
      !snapshot ||
      snapshot.fen !== node.fen
    )
      return [];
    const seen = new Set<string>();
    return snapshot.lines.flatMap((l, i) => {
      const uci = l.pv[0];
      if (!uci || seen.has(uci)) return [];
      seen.add(uci);
      return [{ from: uci.slice(0, 2), to: uci.slice(2, 4), color: "var(--accent)", ...ARROW_STYLE[i] }];
    });
  }, [preview, mode, s.showArrows, engineEnabled, snapshot, node.fen]);

  const badge = useMemo(() => {
    if (preview || !review || !node.to) return null;
    const meta = CLASS_META[review.class];
    return { square: node.to, label: meta.symbol, color: `var(--c-${review.class})`, title: meta.label };
  }, [preview, review, node.to]);

  const onMove = useCallback(
    (m: BoardMove) => {
      const ok = playMove(m);
      if (!ok && s.sound) playSound("illegal", s.volume);
      return ok;
    },
    [playMove, s.sound, s.volume],
  );

  const top = orientation === "w" ? "b" : "w";
  const bottom = orientation;
  const showEval = s.showEvalBar && mode === "analysis";

  return (
    <div className={cx("flex w-full flex-col", compact ? "gap-1.5" : "gap-2.5")}>
      <PlayerStrip side={top} fen={fen} headers={headers} compact={compact} />
      <div className="flex w-full items-stretch gap-2.5">
        {/* The eval column always reserves its width so the board never shifts. */}
        <div className={cx("shrink-0", compact ? "w-3" : "w-4 sm:w-6")} aria-hidden={!showEval}>
          {showEval ? <EvalBar evaluation={evaluation} orientation={orientation} loading={loading} /> : null}
        </div>
        <div className="relative min-w-0 flex-1">
          <Board
            fen={fen}
            orientation={orientation}
            interactive={interactive}
            movableColor={mode === "play" ? play.userColor : undefined}
            lastMove={lastMove}
            arrows={arrows}
            badge={badge}
            pieceSet={s.pieceSet}
            theme={s.boardTheme}
            showCoordinates={s.showCoordinates}
            showLegalMoves={s.showLegalMoves}
            onMove={onMove}
            onIllegal={() => s.sound && playSound("illegal", s.volume)}
          />
          {preview ? (
            <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
              <span className="bg-surface/90 text-muted ring-border-strong rounded-full px-3 py-1 text-xs font-medium shadow-lg ring-1 backdrop-blur">
                Preview{preview.label ? ` · ${preview.label}` : ""}
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <PlayerStrip side={bottom} fen={fen} headers={headers} compact={compact} />
      <BoardControls compact={compact} />
      {mode === "play" ? (
        <p className="sr-only" aria-live="polite">
          {thinking ? `Stockfish (${strengthLabel(play.strength)}) is thinking` : status.text}
        </p>
      ) : null}
    </div>
  );
}

function PlayerStrip({
  side,
  fen,
  headers,
  compact,
}: {
  side: "w" | "b";
  fen: string;
  headers: Record<string, string>;
  compact: boolean;
}) {
  const mode = useGame((g) => g.mode);
  const play = useGame((g) => g.play);
  const thinking = useGame((g) => g.thinking);
  const pieceSetId = useSettings((s) => s.pieceSet);
  const mat = useMemo(() => material(fen), [fen]);
  const turn = fen.split(" ")[1] === "b" ? "b" : "w";

  let name = side === "w" ? headers.White : headers.Black;
  const elo = side === "w" ? headers.WhiteElo : headers.BlackElo;
  if (mode === "play") name = side === play.userColor ? "You" : `Stockfish · ${strengthLabel(play.strength)}`;
  if (!name || name === "?") name = side === "w" ? "White" : "Black";
  const isEngineTurn = mode === "play" && side !== play.userColor && thinking;
  const m = mat[side];

  return (
    <div className={cx("flex items-center gap-2.5 px-1", compact ? "h-7" : "h-8")}>
      <span
        aria-hidden
        className={cx(
          "ring-border-strong size-3 shrink-0 rounded-[4px] ring-1",
          side === "w" ? "bg-[var(--eval-white)]" : "bg-[var(--eval-black)]",
          turn === side && "ring-2 ring-[var(--accent)]",
        )}
      />
      <span className="text-text truncate text-sm font-medium">{name}</span>
      {elo && elo !== "?" ? <span className="tabular text-faint font-mono text-xs">{elo}</span> : null}
      {isEngineTurn ? (
        <span className="text-muted flex items-center gap-1 text-xs" aria-hidden>
          <span className="pulse-dot bg-accent size-1.5 rounded-full" />
          thinking
        </span>
      ) : null}
      <span
        className="ml-auto flex min-w-0 items-center"
        aria-label={`${side === "w" ? "White" : "Black"} captured ${m.captured.length} pieces`}
      >
        <span className="flex items-center -space-x-1.5 overflow-hidden">
          {m.captured.map((t, i) => (
            <span
              key={`${t}${i}`}
              aria-hidden
              className="size-4 shrink-0 bg-contain bg-no-repeat opacity-80"
              style={{ backgroundImage: `url(${pieceUrl(pieceSetId, side === "w" ? "b" : "w", t)})` }}
            />
          ))}
        </span>
        {m.advantage > 0 ? (
          <span className="tabular text-muted ml-1.5 font-mono text-xs">+{m.advantage}</span>
        ) : null}
      </span>
    </div>
  );
}

function BoardControls({ compact }: { compact: boolean }) {
  const { first, prev, next, last, flip } = useGame.getState();
  const hasPrev = useGame((g) => g.tree.nodes[g.currentId].parentId !== null);
  const hasNext = useGame((g) => g.tree.nodes[g.currentId].children.length > 0);
  const mode = useGame((g) => g.mode);
  const enabled = useEngine((e) => e.enabled);
  const toggle = useEngine((e) => e.toggle);
  const status = useEngine((e) => e.status);
  const snapshot = useEngine((e) => e.snapshot);
  const node = useCurrentNode();
  const top = enabled && snapshot?.fen === node.fen ? snapshot.lines[0] : undefined;
  const topSan = useMemo(
    () => (top ? uciLineToSan(node.fen, top.pv.slice(0, 1))[0]?.san : undefined),
    [top, node.fen],
  );

  return (
    <div className={cx("flex items-center gap-1", compact ? "px-0" : "px-0.5")}>
      {mode === "analysis" ? (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={enabled}
          className={cx(
            "group mr-1 flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-medium transition-colors duration-[var(--dur-fast)]",
            enabled ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-3 hover:text-text",
          )}
          title="Toggle engine analysis"
        >
          <Cpu className="size-4" aria-hidden />
          <span className="hidden sm:inline">
            {enabled ? (status === "loading" ? "Loading…" : "Stockfish") : "Engine off"}
          </span>
          {enabled && topSan ? <span className="tabular font-mono text-xs opacity-80">{topSan}</span> : null}
        </button>
      ) : null}
      <div className="ml-auto flex items-center gap-0.5" role="toolbar" aria-label="Move navigation">
        <IconButton label="First move (↑)" onClick={first} disabled={!hasPrev}>
          <ChevronFirst className="size-[18px]" />
        </IconButton>
        <IconButton label="Previous move (←)" onClick={prev} disabled={!hasPrev}>
          <ChevronLeft className="size-[18px]" />
        </IconButton>
        <IconButton label="Next move (→)" onClick={next} disabled={!hasNext}>
          <ChevronRight className="size-[18px]" />
        </IconButton>
        <IconButton label="Last move (↓)" onClick={last} disabled={!hasNext}>
          <ChevronLast className="size-[18px]" />
        </IconButton>
        <span className="bg-border mx-1 h-5 w-px" aria-hidden />
        <IconButton label="Flip board (F)" onClick={flip}>
          <FlipVertical2 className="size-[18px]" />
        </IconButton>
      </div>
    </div>
  );
}
