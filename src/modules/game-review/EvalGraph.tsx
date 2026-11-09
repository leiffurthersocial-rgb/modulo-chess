"use client";

import { memo, useMemo, useRef, useState } from "react";
import { formatEval, whiteWinPercent } from "@/core/engine/evaluation";
import type { MoveNode } from "@/core/chess/tree";
import type { MoveReview, PositionEval } from "@/stores/review";

interface Props {
  line: MoveNode[];
  evals: Record<string, PositionEval>;
  moves: Record<string, MoveReview>;
  currentId: string;
  onSelect: (id: string) => void;
}

const W = 600;
const H = 140;
const MARK = new Set(["brilliant", "great", "inaccuracy", "mistake", "miss", "blunder"]);

/** Win-probability area chart (White above the midline). Click or arrow-key to jump. */
function EvalGraphImpl({ line, evals, moves, currentId, onSelect }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const n = line.length;
  const xs = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const ys = (wp: number) => H - (wp / 100) * H;

  const points = useMemo(
    () => line.map((node, i) => ({ i, node, ev: evals[node.id]?.eval })).filter((p) => p.ev),
    [line, evals],
  );

  const path = useMemo(() => {
    if (points.length < 2) return { area: "", stroke: "" };
    const pts = points.map((p) => `${xs(p.i).toFixed(1)},${ys(whiteWinPercent(p.ev!)).toFixed(1)}`);
    const stroke = `M${pts.join(" L")}`;
    const last = points[points.length - 1];
    const area = `M${xs(points[0].i)},${H} L${pts.join(" L")} L${xs(last.i)},${H} Z`;
    return { area, stroke };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, n]);

  const currentIdx = line.findIndex((l) => l.id === currentId);
  const pickIndex = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || n < 2) return null;
    return Math.max(0, Math.min(n - 1, Math.round(((clientX - r.left) / r.width) * (n - 1))));
  };
  const hovered = hover !== null ? line[hover] : null;
  const hoveredEval = hovered ? evals[hovered.id]?.eval : undefined;

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="ring-border-strong block h-[132px] w-full cursor-crosshair overflow-visible rounded-xl bg-[var(--eval-black)] ring-1"
        role="slider"
        tabIndex={0}
        aria-label="Evaluation graph. Use arrow keys to move through the game."
        aria-valuemin={0}
        aria-valuemax={Math.max(0, n - 1)}
        aria-valuenow={Math.max(0, currentIdx)}
        aria-valuetext={
          currentIdx >= 0 && evals[line[currentIdx].id]
            ? `Move ${currentIdx}, ${formatEval(evals[line[currentIdx].id].eval)}`
            : undefined
        }
        onPointerMove={(e) => setHover(pickIndex(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => {
          const i = pickIndex(e.clientX);
          if (i !== null) onSelect(line[i].id);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            e.stopPropagation();
            const i = Math.max(
              0,
              Math.min(n - 1, (currentIdx < 0 ? 0 : currentIdx) + (e.key === "ArrowLeft" ? -1 : 1)),
            );
            onSelect(line[i].id);
          }
        }}
      >
        <path d={path.area} fill="var(--eval-white)" opacity={0.92} />
        <line
          x1={0}
          x2={W}
          y1={H / 2}
          y2={H / 2}
          stroke="var(--accent)"
          strokeOpacity={0.35}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={path.stroke}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        {currentIdx >= 0 ? (
          <line
            x1={xs(currentIdx)}
            x2={xs(currentIdx)}
            y1={0}
            y2={H}
            stroke="var(--accent)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {hover !== null ? (
          <line
            x1={xs(hover)}
            x2={xs(hover)}
            y1={0}
            y2={H}
            stroke="var(--muted)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            opacity={0.6}
          />
        ) : null}
      </svg>
      {/* Markers rendered in HTML so they stay round regardless of the SVG's aspect ratio. */}
      <div className="pointer-events-none absolute inset-0">
        {points.map((p) => {
          const m = moves[p.node.id];
          if (!m || !MARK.has(m.class)) return null;
          return (
            <span
              key={p.node.id}
              className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--eval-black)]"
              style={{
                left: `${(xs(p.i) / W) * 100}%`,
                top: `${(ys(whiteWinPercent(p.ev!)) / H) * 100}%`,
                background: `var(--c-${m.class})`,
              }}
            />
          );
        })}
      </div>
      {hovered && hoveredEval ? (
        <div
          className="bg-surface text-text ring-border-strong pointer-events-none absolute -top-8 -translate-x-1/2 rounded-lg px-2 py-1 font-mono text-[11px] whitespace-nowrap shadow-lg ring-1"
          style={{ left: `${(xs(hover!) / W) * 100}%` }}
        >
          {hovered.san ?? "Start"} · {formatEval(hoveredEval)}
        </div>
      ) : null}
    </div>
  );
}

export const EvalGraph = memo(EvalGraphImpl);
