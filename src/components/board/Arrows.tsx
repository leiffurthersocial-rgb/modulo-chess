import { squareToXY } from "./pieces";

export interface BoardArrow {
  from: string;
  to: string;
  /** CSS colour */
  color?: string;
  /** 0–1 */
  opacity?: number;
  /** Relative width multiplier */
  width?: number;
  label?: string;
}

export function Arrows({ arrows, orientation }: { arrows: BoardArrow[]; orientation: "w" | "b" }) {
  if (!arrows.length) return null;
  return (
    <svg className="board-arrows" viewBox="0 0 8 8" aria-hidden>
      {arrows.map((a, i) => {
        const f = squareToXY(a.from, orientation);
        const t = squareToXY(a.to, orientation);
        const x1 = f.x + 0.5;
        const y1 = f.y + 0.5;
        const x2 = t.x + 0.5;
        const y2 = t.y + 0.5;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (len === 0) return null;
        const ux = dx / len;
        const uy = dy / len;
        const w = 0.16 * (a.width ?? 1);
        const head = 0.36 * (a.width ?? 1) + 0.04;
        const start = 0.22;
        const sx = x1 + ux * start;
        const sy = y1 + uy * start;
        const ex = x2 - ux * head;
        const ey = y2 - uy * head;
        const px = -uy;
        const py = ux;
        const color = a.color ?? "var(--accent)";
        const tipX = x2 - ux * 0.05;
        const tipY = y2 - uy * 0.05;
        return (
          <g key={`${a.from}${a.to}${i}`} opacity={a.opacity ?? 0.8}>
            <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={color} strokeWidth={w} strokeLinecap="round" />
            <polygon
              points={`${tipX},${tipY} ${ex + px * head * 0.62},${ey + py * head * 0.62} ${ex - px * head * 0.62},${ey - py * head * 0.62}`}
              fill={color}
            />
            {a.label ? (
              <text
                x={ex - ux * 0.05}
                y={ey - uy * 0.05}
                fontSize={0.24}
                fontWeight={700}
                fill="#0b0e07"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {a.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
