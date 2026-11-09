"use client";

import { Bot, User } from "lucide-react";
import { useCallback, useMemo } from "react";
import { CLASS_META } from "@/core/analysis/classify";
import { playSound } from "@/core/sound/sounds";
import { Board, type BoardMove } from "@/components/board/Board";
import type { BoardArrow } from "@/components/board/Arrows";
import { EvalBar } from "@/components/board/EvalBar";
import { material } from "@/components/board/material";
import { cx } from "@/components/ui/primitives";
import { useCurrentNode, useCurrentStatus } from "@/hooks/useGameSelectors";
import { useEngine } from "@/stores/engine";
import { useGame } from "@/stores/game";
import { useReview } from "@/stores/review";
import { useSettings } from "@/stores/settings";
import { pieceUrl } from "@/themes/pieces";

const ARROW_STYLE = [
  { opacity: 0.85, width: 1 },
  { opacity: 0.5, width: 0.8 },
  { opacity: 0.38, width: 0.7 },
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

/** Board column: player cards, evaluation bar and the board. No controls live here. */
export function BoardArea() {
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
      return [{ from: uci.slice(0, 2), to: uci.slice(2, 4), color: "var(--arrow)", ...ARROW_STYLE[i] }];
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
    <div className="flex w-full flex-col gap-2">
      <PlayerCard side={top} fen={fen} headers={headers} />
      <div className="flex w-full items-stretch gap-2">
        {/* The eval column always reserves its width so the board never shifts. */}
        <div className="w-5 shrink-0 sm:w-7" aria-hidden={!showEval}>
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
              <span className="bg-surface/95 font-display text-muted rounded-full px-3 py-1 text-xs font-bold shadow-lg">
                Preview{preview.label ? ` · ${preview.label}` : ""}
              </span>
            </div>
          ) : null}
        </div>
      </div>
      <PlayerCard side={bottom} fen={fen} headers={headers} />
    </div>
  );
}

function PlayerCard({
  side,
  fen,
  headers,
}: {
  side: "w" | "b";
  fen: string;
  headers: Record<string, string>;
}) {
  const mode = useGame((g) => g.mode);
  const play = useGame((g) => g.play);
  const thinking = useGame((g) => g.thinking);
  const pieceSetId = useSettings((s) => s.pieceSet);
  const mat = useMemo(() => material(fen), [fen]);
  const turn = fen.split(" ")[1] === "b" ? "b" : "w";

  const isEngine = mode === "play" && side !== play.userColor;
  let name = side === "w" ? headers.White : headers.Black;
  let rating: string | undefined = side === "w" ? headers.WhiteElo : headers.BlackElo;
  if (mode === "play") {
    name = isEngine ? "Stockfish" : "You";
    rating = isEngine ? String(play.strength.elo) : undefined;
  }
  if (!name || name === "?") name = side === "w" ? "White" : "Black";
  const m = mat[side];
  const toMove = turn === side;

  return (
    <div className="flex h-10 items-center gap-2.5 pl-7 sm:pl-9">
      <span
        aria-hidden
        className={cx(
          "grid size-8 shrink-0 place-items-center rounded-lg",
          side === "w" ? "bg-[var(--eval-white)] text-[#2b2d33]" : "bg-[var(--eval-black)] text-[#f2f2f2]",
          toMove && "ring-accent ring-2",
        )}
      >
        {isEngine ? <Bot className="size-4" /> : <User className="size-4" />}
      </span>
      <span className="font-display text-text truncate text-[15px] font-bold">{name}</span>
      {rating && rating !== "?" ? (
        <span className="tabular bg-surface-3 text-muted rounded-md px-1.5 py-0.5 font-mono text-xs">
          {rating}
        </span>
      ) : null}
      {isEngine && thinking ? (
        <span className="text-muted flex items-center gap-1 text-xs" aria-hidden>
          <span className="pulse-dot bg-accent size-1.5 rounded-full" />
          thinking
        </span>
      ) : null}
      <span
        className="ml-auto flex min-w-0 items-center"
        aria-label={`${side === "w" ? "White" : "Black"} material ${m.advantage > 0 ? `+${m.advantage}` : "even or behind"}`}
      >
        <span className="flex items-center -space-x-1.5 overflow-hidden">
          {m.captured.map((t, i) => (
            <span
              key={`${t}${i}`}
              aria-hidden
              className="size-5 shrink-0 bg-contain bg-no-repeat"
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
