import { winPercentFor } from "./evaluation";
import type { EngineLine } from "./types";

/** Lowest Elo offered when playing Stockfish. */
export const MIN_ELO = 250;
/** Highest Elo Stockfish's UCI_Elo supports. */
export const MAX_ELO = 3190;
/** Stockfish's own UCI_Elo floor; below this we weaken it ourselves. */
export const NATIVE_MIN_ELO = 1320;

export const ELO_PRESETS = [
  { elo: 400, label: "Beginner" },
  { elo: 800, label: "Novice" },
  { elo: 1200, label: "Casual" },
  { elo: 1600, label: "Club" },
  { elo: 2000, label: "Expert" },
  { elo: 2400, label: "Master" },
  { elo: 3190, label: "Maximum" },
] as const;

export function strengthName(elo: number): string {
  if (elo < 600) return "Beginner";
  if (elo < 1000) return "Novice";
  if (elo < 1400) return "Casual";
  if (elo < 1800) return "Club player";
  if (elo < 2200) return "Expert";
  if (elo < 2600) return "Master";
  if (elo < 3000) return "Grandmaster";
  return "Full strength";
}

export type StrengthPlan =
  | {
      kind: "native";
      elo: number;
      options: Record<string, string | number | boolean>;
      movetime: number;
    }
  | {
      kind: "weakened";
      elo: number;
      options: Record<string, string | number | boolean>;
      depth: number;
      multiPv: number;
      /** Softmax temperature in win-percentage points: higher = more willing to pick worse moves. */
      temperature: number;
      /** Probability of playing a uniformly random legal move (beginner-style oversights). */
      randomMoveChance: number;
    };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * How to make Stockfish play at a given Elo.
 *  - ≥ 1320: Stockfish's built-in UCI_LimitStrength/UCI_Elo.
 *  - < 1320: a shallow MultiPV search, then a move is *sampled* with probability
 *    ∝ exp(−winLoss / T), plus an occasional random move. Lower Elo → shallower
 *    search, higher temperature and more random moves.
 */
export function strengthPlan(eloInput: number): StrengthPlan {
  const elo = Math.round(clamp(eloInput, MIN_ELO, MAX_ELO));
  if (elo >= NATIVE_MIN_ELO) {
    const t = (elo - NATIVE_MIN_ELO) / (MAX_ELO - NATIVE_MIN_ELO);
    return {
      kind: "native",
      elo,
      options: { UCI_LimitStrength: true, UCI_Elo: elo, "Skill Level": 20, MultiPV: 1 },
      movetime: Math.round(400 + t * 1600),
    };
  }
  // 0 at the native floor, 1 at MIN_ELO.
  const t = (NATIVE_MIN_ELO - elo) / (NATIVE_MIN_ELO - MIN_ELO);
  return {
    kind: "weakened",
    elo,
    options: { UCI_LimitStrength: false, "Skill Level": 20 },
    depth: Math.round(9 - 7 * t),
    multiPv: 8,
    temperature: 2.5 + 22.5 * t * t,
    randomMoveChance: 0.28 * Math.pow(t, 1.6),
  };
}

export interface Candidate {
  uci: string;
  /** Win percentage for the side to move after playing this move (0–100). */
  winPct: number;
}

/** Turns MultiPV lines into candidates from the mover's point of view. */
export function candidatesFromLines(lines: EngineLine[], mover: "w" | "b"): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const l of lines) {
    const uci = l.pv[0];
    if (!uci || seen.has(uci)) continue;
    seen.add(uci);
    out.push({ uci, winPct: winPercentFor(l.eval, mover) });
  }
  return out;
}

/**
 * Samples a move for a weakened plan. `rng` returns [0, 1) (injectable for tests).
 * Falls back to a random legal move when there are no candidates.
 */
export function pickWeakMove(
  candidates: Candidate[],
  legalMoves: string[],
  plan: Extract<StrengthPlan, { kind: "weakened" }>,
  rng: () => number = Math.random,
): string | null {
  if (legalMoves.length === 0) return null;
  if (!candidates.length || rng() < plan.randomMoveChance) {
    return legalMoves[Math.floor(rng() * legalMoves.length)] ?? legalMoves[0];
  }
  const best = Math.max(...candidates.map((c) => c.winPct));
  const weights = candidates.map((c) => Math.exp(-(best - c.winPct) / plan.temperature));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i].uci;
  }
  return candidates[candidates.length - 1].uci;
}

/** Deterministic PRNG (mulberry32) for reproducible tests. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
