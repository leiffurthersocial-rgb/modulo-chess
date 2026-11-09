/**
 * Game accuracy, following lichess' published algorithm (AccuracyPercent.scala):
 *  - per-move accuracy from the mover's win-percentage drop,
 *  - each move weighted by the volatility (std-dev of win%) of the surrounding window,
 *  - final = average of the volatility-weighted mean and the harmonic mean.
 * Calm positions count less; single bad moves pull the harmonic mean down.
 */

/** Per-move accuracy from win percentages (mover's POV) before/after the move. */
export function accuracyFromWinPercents(before: number, after: number): number {
  if (after >= before) return 100;
  const diff = before - after;
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * diff) - 3.166924740191411;
  return Math.max(0, Math.min(100, raw + 1)); // +1 uncertainty bonus
}

function stdDev(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
}

function harmonicMean(xs: number[]): number {
  return xs.length / xs.reduce((a, x) => a + 1 / Math.max(0.1, x), 0);
}

export interface SideAccuracy {
  w: number | null;
  b: number | null;
}

/**
 * @param whiteWinPercents White's win% for every position of the line, starting
 *   with the initial position (length = moves + 1).
 * @param firstMover side that played the first move.
 */
export function gameAccuracy(whiteWinPercents: number[], firstMover: "w" | "b" = "w"): SideAccuracy {
  const moves = whiteWinPercents.length - 1;
  if (moves < 1) return { w: null, b: null };
  const windowSize = Math.max(2, Math.min(8, Math.floor(moves / 10)));
  const windows: number[][] = [];
  const firstWindow = whiteWinPercents.slice(0, windowSize);
  for (let i = 0; i < Math.min(windowSize, whiteWinPercents.length) - 2; i++) windows.push(firstWindow);
  for (let i = 0; i + windowSize <= whiteWinPercents.length; i++)
    windows.push(whiteWinPercents.slice(i, i + windowSize));
  const weights = windows.map((w) => Math.max(0.5, Math.min(12, stdDev(w))));

  const per: Record<"w" | "b", { acc: number; weight: number }[]> = { w: [], b: [] };
  for (let i = 0; i < moves; i++) {
    const color: "w" | "b" = (i % 2 === 0) === (firstMover === "w") ? "w" : "b";
    const prev = whiteWinPercents[i];
    const next = whiteWinPercents[i + 1];
    const acc =
      color === "w" ? accuracyFromWinPercents(prev, next) : accuracyFromWinPercents(100 - prev, 100 - next);
    per[color].push({ acc, weight: weights[i] ?? 1 });
  }
  const side = (xs: { acc: number; weight: number }[]): number | null => {
    if (!xs.length) return null;
    const wsum = xs.reduce((a, x) => a + x.weight, 0);
    const weighted = xs.reduce((a, x) => a + x.acc * x.weight, 0) / wsum;
    return (weighted + harmonicMean(xs.map((x) => x.acc))) / 2;
  };
  return { w: side(per.w), b: side(per.b) };
}
