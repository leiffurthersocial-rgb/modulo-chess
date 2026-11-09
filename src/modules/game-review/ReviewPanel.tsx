"use client";

import {
  Check,
  ChevronDown,
  ClipboardCopy,
  Download,
  Eye,
  Microscope,
  RotateCcw,
  Square,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CLASS_META, MOVE_CLASSES, type MoveClass } from "@/core/analysis/classify";
import { strengthName } from "@/core/engine/strength";
import { formatEval } from "@/core/engine/evaluation";
import { serializePgn } from "@/core/chess/pgn";
import { fullMoveNumber, mainline, sideToMove, uciLineToSan, type MoveNode } from "@/core/chess/tree";
import { ClassIcon } from "@/components/analysis/ClassIcon";
import { Button, Section, Segmented, cx } from "@/components/ui/primitives";
import { useGame } from "@/stores/game";
import { useReview, type MoveReview, type SideSummary } from "@/stores/review";
import { useSettings } from "@/stores/settings";
import { useToasts } from "@/stores/toasts";
import { EvalGraph } from "./EvalGraph";
import { GameLoader } from "./GameLoader";
import { cancelReview, reviewWorkerCount, runReview } from "./runReview";

const DEPTHS = [
  { value: "12", label: "Fast", depth: 12 },
  { value: "16", label: "Standard", depth: 16 },
  { value: "20", label: "Deep", depth: 20 },
] as const;

/** One-line, coach-style explanation for each class. */
const EXPLAIN: Record<MoveClass, string> = {
  brilliant: "A sound sacrifice — material given up for a lasting advantage.",
  great: "The only move that keeps the position — everything else was clearly worse.",
  best: "Exactly what the engine would play.",
  excellent: "Almost as good as the best move.",
  good: "A decent move, but there was something stronger.",
  book: "A known opening move.",
  forced: "The only legal move.",
  inaccuracy: "Not a serious error, but a better move was available.",
  mistake: "This gives away a significant part of the advantage.",
  miss: "The opponent erred — this misses the chance to punish it.",
  blunder: "A serious error that changes the evaluation drastically.",
};

export function ReviewPanel() {
  const tree = useGame((s) => s.tree);
  const gameKey = useGame((s) => s.gameKey);
  const mode = useGame((s) => s.mode);
  const status = useReview((s) => s.status);
  const reviewKey = useReview((s) => s.gameKey);
  const autoStart = useReview((s) => s.autoStart);
  const hasResults = useReview((s) => Object.keys(s.moves).length > 0);
  const line = useMemo(() => mainline(tree), [tree]);
  const hasMoves = line.length > 1;
  const stale = reviewKey !== null && reviewKey !== gameKey;

  // Drop results when a different game is loaded.
  useEffect(() => {
    if (stale) {
      cancelReview();
      useReview.getState().reset();
    }
  }, [stale]);

  // "Analyse" from the loader / "Review game" buttons start the review right away.
  useEffect(() => {
    if (autoStart && hasMoves && mode === "analysis" && !stale && status !== "running") void runReview();
  }, [autoStart, hasMoves, mode, stale, status]);

  if (!hasMoves) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted text-sm leading-relaxed">
          Load a game and every move is classified — from{" "}
          <b className="text-[var(--c-brilliant)]">brilliant</b> to{" "}
          <b className="text-[var(--c-blunder)]">blunder</b> — with accuracy and an{" "}
          <b className="text-text">Elo estimate for both players</b>. Everything runs on your device.
        </p>
        <GameLoader />
      </div>
    );
  }
  if (mode === "play") {
    return (
      <p className="bg-surface-2 text-muted rounded-xl p-4 text-sm">Finish or leave the game to review it.</p>
    );
  }
  if (status === "running") return <Running />;
  if (hasResults && !stale && (status === "done" || status === "cancelled")) return <Report />;
  return <Ready />;
}

// ── Before analysis ───────────────────────────────────────────────────────

function Players({ compact }: { compact?: boolean }) {
  const headers = useGame((s) => s.headers);
  const name = (n?: string, fallback = "?") => (n && n !== "?" ? n : fallback);
  return (
    <p className={cx("text-muted truncate", compact ? "text-xs" : "text-sm")}>
      <b className="text-text">{name(headers.White, "White")}</b> vs{" "}
      <b className="text-text">{name(headers.Black, "Black")}</b>
      {headers.Event && headers.Event !== "?" ? <span className="text-faint"> · {headers.Event}</span> : null}
    </p>
  );
}

function DepthPicker() {
  const depth = useSettings((s) => s.reviewDepth);
  const set = useSettings((s) => s.set);
  const value = DEPTHS.find((d) => d.depth === depth)?.value ?? "16";
  return (
    <Segmented
      label="Analysis depth"
      size="sm"
      value={value}
      onChange={(v) => set({ reviewDepth: Number(v) })}
      options={DEPTHS.map((d) => ({ value: d.value, label: `${d.label} · ${d.depth}` }))}
    />
  );
}

function Ready() {
  const status = useReview((s) => s.status);
  const error = useReview((s) => s.error);
  const moves = useGame((s) => mainline(s.tree).length - 1);
  const [showLoader, setShowLoader] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-surface-2 rounded-xl p-4">
        <Players />
        <p className="text-faint mt-1 text-xs">
          {moves} half-moves · {reviewWorkerCount()} engine workers in parallel
        </p>
        <div className="mt-3">
          <DepthPicker />
        </div>
        <Button variant="primary" className="mt-3 w-full" onClick={() => void runReview()}>
          <Microscope className="size-4" aria-hidden /> Analyse game
        </Button>
        {status === "error" ? (
          <p role="alert" className="text-danger mt-2 text-xs">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setShowLoader((v) => !v)}
        aria-expanded={showLoader}
        className="text-muted hover:text-text flex items-center gap-1.5 self-start text-sm font-semibold"
      >
        <ChevronDown className={cx("size-4 transition-transform", showLoader && "rotate-180")} aria-hidden />
        Load a different game
      </button>
      {showLoader ? <GameLoader compact /> : null}
    </div>
  );
}

function Running() {
  const done = useReview((s) => s.done);
  const total = useReview((s) => s.total);
  const depth = useReview((s) => s.depth);
  const workers = useReview((s) => s.workers);
  const startedAt = useReview((s) => s.startedAt);
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const t = setInterval(() => setNow(performance.now()), 500);
    return () => clearInterval(t);
  }, []);
  const elapsed = startedAt ? (now - startedAt) / 1000 : 0;
  const eta = done > 2 ? Math.max(0, Math.round((elapsed / done) * (total - done))) : null;
  const tree = useGame((s) => s.tree);
  const line = useMemo(() => mainline(tree), [tree]);
  const evals = useReview((s) => s.evals);
  const moves = useReview((s) => s.moves);
  const currentId = useGame((s) => s.currentId);
  const goTo = useGame((s) => s.goTo);
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <div className="bg-surface-2 rounded-xl p-4">
        <Players />
        <div className="mt-3 flex items-baseline justify-between">
          <span className="font-display text-text text-lg font-extrabold">Analysing…</span>
          <span className="tabular text-faint text-xs">
            {done}/{total} · depth {depth} · {workers}×{eta !== null ? ` · ~${eta}s left` : ""}
          </span>
        </div>
        <div
          className="bg-surface-hover mt-2 h-2.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Review progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <div
            className="bg-accent h-full rounded-full transition-[width] duration-[var(--dur)] ease-[var(--ease-out)]"
            style={{ width: `${(done / Math.max(1, total)) * 100}%` }}
          />
        </div>
        <Button size="sm" variant="ghost" className="mt-2 -ml-2" onClick={cancelReview}>
          <Square className="size-3.5" aria-hidden /> Cancel
        </Button>
      </div>
      <EvalGraph line={line} evals={evals} moves={moves} currentId={currentId} onSelect={goTo} />
    </div>
  );
}

// ── Report ────────────────────────────────────────────────────────────────

function Report() {
  const tree = useGame((s) => s.tree);
  const currentId = useGame((s) => s.currentId);
  const goTo = useGame((s) => s.goTo);
  const review = useReview();
  const line = useMemo(() => mainline(tree), [tree]);

  return (
    <div className="flex flex-col gap-3" data-report-done={review.status === "done" || undefined}>
      {review.summary ? <PlayerCards w={review.summary.w} b={review.summary.b} /> : null}
      <EvalGraph
        line={line}
        evals={review.evals}
        moves={review.moves}
        currentId={currentId}
        onSelect={goTo}
      />
      <CurrentMove />
      {review.summary ? <ClassTable w={review.summary.w} b={review.summary.b} /> : null}
      <KeyMoments line={line} moves={review.moves} currentId={currentId} onSelect={goTo} />
      <ReportFooter />
    </div>
  );
}

function PlayerCards({ w, b }: { w: SideSummary; b: SideSummary }) {
  const headers = useGame((s) => s.headers);
  const card = (side: "w" | "b", s: SideSummary) => {
    const name = (side === "w" ? headers.White : headers.Black) || (side === "w" ? "White" : "Black");
    const rated = side === "w" ? headers.WhiteElo : headers.BlackElo;
    const light = side === "w";
    return (
      <div
        className={cx(
          "flex min-w-0 flex-col gap-1 rounded-xl p-3",
          light
            ? "bg-[var(--eval-white)] text-[#1b1d22]"
            : "ring-border-strong bg-[var(--eval-black)] text-[#f2f2f2] ring-1",
        )}
      >
        <span className="font-display truncate text-sm font-bold opacity-80">
          {name === "?" ? (light ? "White" : "Black") : name}
        </span>
        <span
          className="tabular font-display text-[34px] leading-none font-black"
          aria-label={`Accuracy ${s.accuracy?.toFixed(1)}`}
        >
          {s.accuracy === null ? "—" : s.accuracy.toFixed(1)}
        </span>
        <span className="text-[11px] font-semibold opacity-70">accuracy</span>
        <div className={cx("mt-1 rounded-lg px-2 py-1.5", light ? "bg-black/6" : "bg-white/8")}>
          <span className="block text-[11px] font-semibold opacity-70">Estimated Elo</span>
          <span className="tabular font-display text-lg font-black">{s.rating ?? "—"}</span>
          {s.rating !== null ? (
            <span className="ml-1.5 text-[11px] opacity-70">{strengthName(s.rating)}</span>
          ) : null}
          {rated && rated !== "?" ? (
            <span className="block text-[11px] opacity-60">rated {rated}</span>
          ) : null}
        </div>
      </div>
    );
  };
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {card("w", w)}
        {card("b", b)}
      </div>
      <p className="text-faint mt-1.5 text-[11px] leading-snug">
        Elo is estimated from move accuracy and average centipawn loss in this game alone — a rough guide, not
        a rating.
      </p>
    </div>
  );
}

function evalChip(moveEval: MoveReview["playedEval"]) {
  const white = moveEval.kind === "mate" ? moveEval.winner === "w" : moveEval.cp >= 0;
  return (
    <span
      className={cx(
        "tabular rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold",
        white
          ? "bg-[var(--eval-white)] text-[#1b1d22]"
          : "ring-border-strong bg-[var(--eval-black)] text-[#f2f2f2] ring-1",
      )}
    >
      {formatEval(moveEval)}
    </span>
  );
}

function moveLabel(parentFen: string, san: string): string {
  const n = fullMoveNumber(parentFen);
  return sideToMove(parentFen) === "w" ? `${n}. ${san}` : `${n}… ${san}`;
}

function CurrentMove() {
  const tree = useGame((s) => s.tree);
  const currentId = useGame((s) => s.currentId);
  const setPreview = useGame((s) => s.setPreview);
  const preview = useGame((s) => s.preview);
  const playMove = useGame((s) => s.playMove);
  const goTo = useGame((s) => s.goTo);
  const m = useReview((s) => s.moves[currentId]);
  const node = tree.nodes[currentId];
  if (!m || !node.parentId || !node.san) {
    return (
      <div className="bg-surface-2 text-muted rounded-xl p-3 text-sm">
        Step through the game with the arrows to see each move explained.
      </div>
    );
  }
  const parent = tree.nodes[node.parentId];
  const meta = CLASS_META[m.class];
  const showBest = m.bestUci && m.bestUci !== node.uci && !["book", "forced"].includes(m.class);
  const bestFen = showBest ? uciLineToSan(parent.fen, [m.bestUci!])[0]?.fen : undefined;
  const previewing = Boolean(bestFen && preview?.fen === bestFen);

  return (
    <div className="bg-surface-2 animate-in flex flex-col gap-2 rounded-xl p-3" key={currentId}>
      <div className="flex items-center gap-2.5">
        <ClassIcon cls={m.class} size={30} />
        <p className="font-display text-text min-w-0 flex-1 text-[16px] leading-tight font-extrabold">
          <span className="font-mono">{moveLabel(parent.fen, node.san)}</span> is {meta.describe}
        </p>
        {evalChip(m.playedEval)}
      </div>
      <p className="text-muted text-xs leading-relaxed">{EXPLAIN[m.class]}</p>
      {showBest ? (
        <div className="bg-surface-3 flex items-center gap-2 rounded-lg px-2.5 py-2">
          <ClassIcon cls="best" size={18} />
          <p className="text-muted min-w-0 flex-1 truncate text-sm">
            Best was <b className="text-text font-mono">{m.bestSan}</b>
            {m.bestLine && m.bestLine.length > 1 ? (
              <span className="text-faint ml-1 font-mono text-xs">{m.bestLine.slice(1, 6).join(" ")}</span>
            ) : null}
          </p>
          <button
            type="button"
            title="Show the best move on the board"
            aria-pressed={previewing}
            onClick={() =>
              setPreview(
                previewing
                  ? null
                  : {
                      fen: bestFen!,
                      lastMove: { from: m.bestUci!.slice(0, 2), to: m.bestUci!.slice(2, 4) },
                      label: `Best: ${m.bestSan}`,
                    },
              )
            }
            className={cx(
              "grid size-8 place-items-center rounded-lg",
              previewing ? "bg-accent text-white" : "text-muted hover:bg-surface-hover",
            )}
          >
            <Eye className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            title="Play the best move as a variation"
            onClick={() => {
              goTo(parent.id);
              playMove(m.bestUci!);
            }}
            className="text-muted hover:bg-surface-hover grid size-8 place-items-center rounded-lg"
          >
            <Check className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ClassTable({ w, b }: { w: SideSummary; b: SideSummary }) {
  return (
    <Section title="Move quality">
      <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-y-1 text-sm">
        {MOVE_CLASSES.filter((c) => c !== "forced").map((c) => {
          const any = w.counts[c] + b.counts[c] > 0;
          return (
            <div key={c} className={cx("contents", !any && "opacity-40")}>
              <span className="tabular text-text text-center font-mono font-bold">{w.counts[c]}</span>
              <span
                className="font-display flex items-center justify-center gap-2 font-bold"
                style={{ color: `var(--c-${c})` }}
              >
                <ClassIcon cls={c} size={18} />
                {CLASS_META[c].label}
              </span>
              <span className="tabular text-text text-center font-mono font-bold">{b.counts[c]}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

const KEY: MoveClass[] = ["brilliant", "great", "miss", "mistake", "blunder"];

function KeyMoments({
  line,
  moves,
  currentId,
  onSelect,
}: {
  line: MoveNode[];
  moves: Record<string, MoveReview>;
  currentId: string;
  onSelect: (id: string) => void;
}) {
  const items = line.filter((n) => KEY.includes(moves[n.id]?.class));
  if (!items.length) return null;
  return (
    <Section title="Key moments">
      <ul className="flex flex-col gap-0.5">
        {items.map((n) => {
          const r = moves[n.id];
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onSelect(n.id)}
                className={cx(
                  "hover:bg-surface-3 flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm",
                  n.id === currentId && "bg-surface-3",
                )}
              >
                <ClassIcon cls={r.class} size={18} />
                <span className="text-text font-mono">
                  {moveLabel(line[line.indexOf(n) - 1].fen, n.san!)}
                </span>
                <span className="text-muted">{CLASS_META[r.class].label}</span>
                {r.bestSan && r.class !== "brilliant" && r.class !== "great" ? (
                  <span className="text-faint ml-auto truncate font-mono text-xs">best {r.bestSan}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function ReportFooter() {
  const review = useReview();
  const tree = useGame((s) => s.tree);
  const headers = useGame((s) => s.headers);
  const result = useGame((s) => s.result);
  const push = useToasts((s) => s.push);
  const [copied, setCopied] = useState(false);
  const pgn = () => serializePgn(tree, { headers: { Site: "Modulo: Chess", ...headers }, result });
  const secs =
    review.startedAt && review.finishedAt ? ((review.finishedAt - review.startedAt) / 1000).toFixed(1) : null;

  return (
    <div className="flex flex-col gap-2">
      {review.status === "cancelled" ? (
        <p className="text-faint text-xs">Analysis cancelled — partial results shown.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void runReview()}>
          <RotateCcw className="size-3.5" aria-hidden /> Re-analyse
        </Button>
        <Button
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(pgn());
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              push({ tone: "error", title: "Clipboard unavailable" });
            }
          }}
        >
          {copied ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <ClipboardCopy className="size-3.5" aria-hidden />
          )}{" "}
          PGN
        </Button>
        <Button
          size="sm"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([pgn()], { type: "application/x-chess-pgn" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = "modulo-game.pgn";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          <Download className="size-3.5" aria-hidden /> Download
        </Button>
      </div>
      <DepthPicker />
      <p className="text-faint text-[11px]">
        {review.total} positions · depth {review.depth}
        {secs ? ` · ${secs}s with ${review.workers} parallel engine${review.workers > 1 ? "s" : ""}` : ""}
      </p>
    </div>
  );
}
