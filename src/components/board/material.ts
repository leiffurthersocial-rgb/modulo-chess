const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const ORDER = ["q", "r", "b", "n", "p"] as const;

export interface MaterialSide {
  /** Net material imbalance in this side's favour, as opponent piece types (most valuable first). */
  captured: string[];
  /** Material advantage in pawns (0 when not ahead). */
  advantage: number;
}

/** Net material imbalance per side (lichess style): only the difference is shown. */
export function material(fen: string): { w: MaterialSide; b: MaterialSide } {
  const counts: Record<"w" | "b", Record<string, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };
  for (const ch of fen.split(" ")[0]) {
    const t = ch.toLowerCase();
    if (!(t in VALUES)) continue;
    counts[ch === t ? "b" : "w"][t]++;
  }
  const w: string[] = [];
  const b: string[] = [];
  let score = 0;
  for (const t of ORDER) {
    const d = counts.w[t] - counts.b[t];
    score += d * VALUES[t];
    for (let i = 0; i < Math.abs(d); i++) (d > 0 ? w : b).push(t);
  }
  return {
    w: { captured: w, advantage: Math.max(0, score) },
    b: { captured: b, advantage: Math.max(0, -score) },
  };
}
