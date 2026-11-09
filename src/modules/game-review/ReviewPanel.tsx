"use client";

import { LineChart, Microscope, Square } from "lucide-react";
import { useEffect, useMemo } from "react";
import { CLASS_META, type MoveClass } from "@/core/analysis/classify";
import { formatEval } from "@/core/engine/evaluation";
import { fullMoveNumber, mainline, sideToMove } from "@/core/chess/tree";
import { Button, EmptyState, Section, Slider, cx } from "@/components/ui/primitives";
import { useGame } from "@/stores/game";
import { useReview } from "@/stores/review";
import { useSettings } from "@/stores/settings";
import { EvalGraph } from "./EvalGraph";
import { cancelReview, runReview } from "./runReview";

const SUMMARY_CLASSES: MoveClass[] = [
  "best",
  "excellent",
  "good",
  "book",
  "inaccuracy",
  "mistake",
  "blunder",
];

export function ReviewPanel() {
  const tree = useGame((s) => s.tree);
  const gameKey = useGame((s) => s.gameKey);
  const currentId = useGame((s) => s.currentId);
  const goTo = useGame((s) => s.goTo);
  const headers = useGame((s) => s.headers);
  const mode = useGame((s) => s.mode);
  const review = useReview();
  const depth = useSettings((s) => s.reviewDepth);
  const setSettings = useSettings((s) => s.set);
  const line = useMemo(() => mainline(tree), [tree]);
  const stale = review.gameKey !== null && review.gameKey !== gameKey;

  // Drop results when a different game is loaded.
  useEffect(() => {
    if (stale) {
      cancelReview();
      useReview.getState().reset();
    }
  }, [stale]);

  const running = review.status === "running";
  const hasResults = !stale && Object.keys(review.evals).length > 0;
  const moveCount = line.length - 1;
  const current = review.moves[currentId];
  const currentNode = tree.nodes[currentId];

  const keyMoments = useMemo(
    () =>
      line
        .filter((n) => ["mistake", "blunder"].includes(review.moves[n.id]?.class ?? ""))
        .map((n) => ({ node: n, review: review.moves[n.id] })),
    [line, review.moves],
  );

  if (moveCount < 1) {
    return (
      <EmptyState icon={<LineChart className="size-5" />} title="Nothing to review yet">
        Play some moves, finish a game against Stockfish, or import a PGN. The review evaluates every move
        locally and classifies it from <i>best</i> to <i>blunder</i>.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Section title="Game review">
        {headers.White || headers.Black ? (
          <p className="text-muted mb-3 truncate text-sm">
            {headers.White ?? "?"} <span className="text-faint">vs</span> {headers.Black ?? "?"}
            {headers.Event && headers.Event !== "?" ? (
              <span className="text-faint"> · {headers.Event}</span>
            ) : null}
          </p>
        ) : null}
        {mode === "play" ? (
          <p className="text-muted text-sm">Finish or leave the game to review it.</p>
        ) : running ? (
          <div className="flex flex-col gap-3" aria-live="polite">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text">
                Analysing move {Math.max(0, review.done - 1)} of {moveCount}
              </span>
              <span className="tabular text-faint font-mono text-xs">depth {review.depth}</span>
            </div>
            <div
              className="bg-surface-3 h-1.5 overflow-hidden rounded-full"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={review.total}
              aria-valuenow={review.done}
              aria-label="Review progress"
            >
              <div
                className="bg-accent h-full rounded-full transition-[width] duration-[var(--dur)] ease-[var(--ease-out)]"
                style={{ width: `${(review.done / Math.max(1, review.total)) * 100}%` }}
              />
            </div>
            <Button size="sm" onClick={cancelReview} className="self-start">
              <Square className="size-3.5" aria-hidden /> Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Slider
              label="Depth per move"
              value={depth}
              min={8}
              max={22}
              onChange={(v) => setSettings({ reviewDepth: v })}
              description={`${moveCount} moves · higher depth is more accurate but slower (each move is capped at 3 s).`}
            />
            <Button variant="primary" onClick={() => void runReview()}>
              <Microscope className="size-4" aria-hidden /> {hasResults ? "Re-run review" : "Review game"}
            </Button>
            {review.status === "error" ? (
              <p role="alert" className="text-danger text-xs">
                {review.error}
              </p>
            ) : null}
            {review.status === "cancelled" ? (
              <p className="text-faint text-xs">Review cancelled — partial results shown.</p>
            ) : null}
          </div>
        )}
      </Section>

      {hasResults ? (
        <>
          <Section title="Evaluation">
            <EvalGraph
              line={line}
              evals={review.evals}
              moves={review.moves}
              currentId={currentId}
              onSelect={goTo}
            />
          </Section>

          {review.summary ? <Summary /> : null}

          {current && currentNode.san ? (
            <Section title="This move">
              <div className="animate-in flex items-start gap-3" key={currentId}>
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
                  style={{ background: `var(--c-${current.class})` }}
                  aria-hidden
                >
                  {CLASS_META[current.class].symbol}
                </span>
                <div className="min-w-0 text-sm">
                  <p className="text-text">
                    <span className="font-mono">
                      {moveLabel(tree.nodes[currentNode.parentId!].fen, currentNode.san)}
                    </span>{" "}
                    is{" "}
                    <b style={{ color: `var(--c-${current.class})` }}>
                      {CLASS_META[current.class].label.toLowerCase()}
                    </b>
                    {review.evals[currentId] ? (
                      <span className="text-muted"> · {formatEval(review.evals[currentId].eval)}</span>
                    ) : null}
                  </p>
                  {current.bestSan && current.bestUci !== currentNode.uci && current.class !== "book" ? (
                    <p className="text-muted mt-1">
                      Best was <span className="text-text font-mono">{current.bestSan}</span>
                      {current.winLoss >= 0.5 ? <> · −{current.winLoss.toFixed(1)}% win chance</> : null}
                    </p>
                  ) : null}
                </div>
              </div>
            </Section>
          ) : null}

          {keyMoments.length ? (
            <Section title="Key moments">
              <ul className="flex flex-col gap-1">
                {keyMoments.map(({ node, review: r }) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => goTo(node.id)}
                      className={cx(
                        "hover:bg-surface-3 flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm transition-colors",
                        node.id === currentId && "bg-surface-3",
                      )}
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: `var(--c-${r.class})` }}
                        aria-hidden
                      />
                      <span className="text-text font-mono">
                        {moveLabel(tree.nodes[node.parentId!].fen, node.san!)}
                      </span>
                      <span className="text-muted">{CLASS_META[r.class].label}</span>
                      {r.bestSan ? (
                        <span className="text-faint ml-auto truncate font-mono text-xs">
                          best {r.bestSan}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function moveLabel(parentFen: string, san: string): string {
  const n = fullMoveNumber(parentFen);
  return sideToMove(parentFen) === "w" ? `${n}. ${san}` : `${n}… ${san}`;
}

function Summary() {
  const summary = useReview((s) => s.summary)!;
  const headers = useGame((s) => s.headers);
  const names = {
    w: headers.White && headers.White !== "?" ? headers.White : "White",
    b: headers.Black && headers.Black !== "?" ? headers.Black : "Black",
  };
  return (
    <Section title="Accuracy">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-1.5 text-sm">
        <span />
        <span className="text-faint w-16 truncate text-right text-xs">{names.w}</span>
        <span className="text-faint w-16 truncate text-right text-xs">{names.b}</span>
        <span className="text-text font-medium">Accuracy</span>
        {(["w", "b"] as const).map((side) => (
          <span key={side} className="tabular text-text text-right font-mono text-lg font-semibold">
            {summary[side].accuracy === null ? "—" : summary[side].accuracy!.toFixed(1)}
          </span>
        ))}
        {SUMMARY_CLASSES.map((c) => (
          <div key={c} className="contents">
            <span className="text-muted flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: `var(--c-${c})` }} aria-hidden />
              {CLASS_META[c].label}
            </span>
            {(["w", "b"] as const).map((side) => (
              <span
                key={side}
                className={cx(
                  "tabular text-right font-mono",
                  summary[side].counts[c] ? "text-text" : "text-faint",
                )}
              >
                {summary[side].counts[c]}
              </span>
            ))}
          </div>
        ))}
      </div>
    </Section>
  );
}
