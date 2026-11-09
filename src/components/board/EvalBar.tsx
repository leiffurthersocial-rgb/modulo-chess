"use client";

import { formatEval, formatEvalShort, whiteWinPercent } from "@/core/engine/evaluation";
import type { Evaluation } from "@/core/engine/types";

interface Props {
  evaluation: Evaluation | null;
  orientation: "w" | "b";
  loading?: boolean;
  className?: string;
}

/** Vertical win-probability bar. White fills from White's side of the board. */
export function EvalBar({ evaluation, orientation, loading, className }: Props) {
  const white = evaluation ? whiteWinPercent(evaluation) : 50;
  const label = evaluation ? formatEvalShort(evaluation) : "";
  const whiteAhead = white >= 50;
  // Label sits at the end of the leading side.
  const labelAtBottom = whiteAhead === (orientation === "w");
  return (
    <div
      className={`ring-border-strong relative h-full w-full overflow-hidden rounded-[7px] bg-[var(--eval-black)] ring-1 ${className ?? ""}`}
      role="meter"
      aria-label="Evaluation"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(white)}
      aria-valuetext={
        evaluation ? `${formatEval(evaluation)} (White ${Math.round(white)}%)` : "No evaluation"
      }
    >
      <div
        className={`absolute inset-x-0 bg-[var(--eval-white)] transition-[height,opacity] duration-[var(--dur-slow)] ease-[var(--ease-out)] ${
          evaluation ? "" : "opacity-25"
        }`}
        style={{ height: `${white}%`, [orientation === "w" ? "bottom" : "top"]: 0 }}
      />
      <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--accent)] opacity-40" />
      {loading && !evaluation ? <div className="skeleton absolute inset-0 opacity-30" /> : null}
      {label ? (
        <span
          className={`tabular absolute inset-x-0 hidden text-center font-mono text-[9.5px] leading-none font-semibold tracking-tighter sm:block ${
            labelAtBottom ? "bottom-1.5" : "top-1.5"
          } ${whiteAhead ? "text-[var(--eval-black)]" : "text-[var(--eval-white)]"}`}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
