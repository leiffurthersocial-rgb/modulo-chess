import { MAX_ELO, MIN_ELO } from "../engine/strength";
import type { Evaluation } from "../engine/types";

/**
 * Heuristic mapping from game accuracy (lichess-style, 0–100, book moves excluded)
 * to a playing strength. Anchors approximate typical online accuracy by rating;
 * estimates are intentionally presented with a wide confidence range.
 */
export const ACCURACY_CURVE: readonly [number, number][] = [
  [35, 250],
  [50, 450],
  [60, 750],
  [70, 1100],
  [78, 1450],
  [84, 1800],
  [89, 2150],
  [93, 2500],
  [96, 2800],
  [98.5, 3100],
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function eloFromAccuracy(accuracy: number): number {
  const c = ACCURACY_CURVE;
  if (accuracy <= c[0][0]) return c[0][1];
  if (accuracy >= c[c.length - 1][0]) return c[c.length - 1][1];
  for (let i = 1; i < c.length; i++) {
    const [a1, e1] = c[i];
    const [a0, e0] = c[i - 1];
    if (accuracy <= a1) return e0 + ((accuracy - a0) / (a1 - a0)) * (e1 - e0);
  }
  return c[c.length - 1][1];
}

/**
 * Average centipawn loss → strength. ACPL keeps punishing blunders even when the
 * position is already decided, where win-percentage accuracy saturates.
 */
export const ACPL_CURVE: readonly [number, number][] = [
  [10, 2700],
  [20, 2400],
  [35, 2000],
  [50, 1700],
  [70, 1350],
  [100, 1000],
  [150, 650],
  [250, 350],
  [400, 250],
];

function interpolate(curve: readonly [number, number][], x: number): number {
  if (x <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i];
    const [x0, y0] = curve[i - 1];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return curve[curve.length - 1][1];
}

export function eloFromAcpl(acpl: number): number {
  return interpolate(ACPL_CURVE, acpl);
}

const CP_CAP = 1000;

/** Centipawns from the mover's point of view, mates mapped to ±1000. */
function moverCp(ev: Evaluation, mover: "w" | "b"): number {
  const white = ev.kind === "mate" ? (ev.winner === "w" ? CP_CAP : -CP_CAP) : clamp(ev.cp, -CP_CAP, CP_CAP);
  return mover === "w" ? white : -white;
}

/** Centipawn loss of a move (0–1000). */
export function centipawnLoss(mover: "w" | "b", before: Evaluation, after: Evaluation): number {
  return clamp(moverCp(before, mover) - moverCp(after, mover), 0, CP_CAP);
}

/** Harmonic mean of per-move accuracies: single bad moves pull it down, as in lichess. */
export function harmonicAccuracy(accuracies: number[]): number | null {
  if (!accuracies.length) return null;
  const inv = accuracies.reduce((a, x) => a + 1 / Math.max(1, x), 0);
  return accuracies.length / inv;
}

/** Strength implied by move quality alone. */
export function qualityElo(accuracies: number[], cpLosses: number[]): number | null {
  const parts: number[] = [];
  const h = harmonicAccuracy(accuracies);
  if (h !== null) parts.push(eloFromAccuracy(h));
  if (cpLosses.length) parts.push(eloFromAcpl(cpLosses.reduce((a, b) => a + b, 0) / cpLosses.length));
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
}

/** Linear performance rating: a win scores opponent + 400, a loss opponent − 400. */
export function performanceRating(opponentElo: number, score: number): number {
  return opponentElo + 400 * (2 * clamp(score, 0, 1) - 1);
}

export interface GameAssessment {
  /** Non-book moves the player made that were evaluated. */
  userMoves: number;
  /** Mean per-move accuracy of those moves (for display), or null if there were none. */
  accuracy: number | null;
  /** Strength implied by move quality (see qualityElo), or null if there were no moves. */
  quality: number | null;
  /** Average opponent Elo over the game. */
  opponentElo: number;
  /** 1 win, 0.5 draw, 0 loss. */
  score: number;
}

/** Blends move quality (dominant in longer games) with the result. */
export function estimateGame(g: GameAssessment): number {
  const perf = performanceRating(g.opponentElo, g.score);
  if (g.quality === null || g.userMoves === 0) return clamp(perf, MIN_ELO, MAX_ELO);
  const qualityWeight = clamp(0.3 + g.userMoves / 40, 0.3, 0.7);
  return clamp(qualityWeight * g.quality + (1 - qualityWeight) * perf, MIN_ELO, MAX_ELO);
}

export interface EloEstimate {
  elo: number;
  low: number;
  high: number;
}

export function roundElo(v: number, step = 25): number {
  return Math.round(v / step) * step;
}

/** Combines per-game estimates (weighted by moves played) into a rating with a range. */
export function combineEstimates(games: GameAssessment[]): EloEstimate | null {
  if (!games.length) return null;
  let wsum = 0;
  let acc = 0;
  let moves = 0;
  for (const g of games) {
    const w = Math.max(5, g.userMoves);
    acc += estimateGame(g) * w;
    wsum += w;
    moves += g.userMoves;
  }
  const elo = acc / wsum;
  const margin = clamp(450 / Math.sqrt(Math.max(1, moves) / 20), 100, 500);
  return {
    elo: roundElo(elo),
    low: roundElo(clamp(elo - margin, MIN_ELO, MAX_ELO)),
    high: roundElo(clamp(elo + margin, MIN_ELO, MAX_ELO)),
  };
}

/**
 * Adaptive opponent for the quick estimate: after a few evaluated moves, move the
 * opponent halfway towards the running estimate, at most 200 points per step.
 */
export function adaptOpponent(current: number, runningEstimate: number, userMovesSoFar: number): number {
  if (userMovesSoFar < 4) return current;
  const step = clamp((runningEstimate - current) * 0.5, -200, 200);
  return roundElo(clamp(current + step, MIN_ELO, MAX_ELO));
}

export const EXPERIENCE_LEVELS = [
  { id: "new", label: "New", elo: 400 },
  { id: "casual", label: "Casual", elo: 800 },
  { id: "regular", label: "Regular", elo: 1200 },
  { id: "club", label: "Club", elo: 1600 },
  { id: "strong", label: "Strong", elo: 2000 },
] as const;
