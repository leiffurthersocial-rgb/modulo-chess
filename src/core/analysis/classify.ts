import { winPercentFor, type Side } from "../engine/evaluation";
import type { Evaluation } from "../engine/types";

export type MoveClass =
  | "book"
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder";

/**
 * Thresholds on win-percentage loss (0–100 scale) from the mover's point of view.
 * These follow chess.com's published "expected points" bands
 * (excellent < 2%, good < 5%, inaccuracy < 10%, mistake < 20%, blunder ≥ 20%).
 */
export const CLASS_THRESHOLDS = {
  excellent: 2,
  good: 5,
  inaccuracy: 10,
  mistake: 20,
} as const;

export interface ClassifyInput {
  /** Side that made the move. */
  mover: Side;
  /** Best-play evaluation of the position before the move (White POV). */
  before: Evaluation;
  /** Evaluation of the position after the move (White POV). */
  after: Evaluation;
  /** The played move in UCI. */
  played: string;
  /** The engine's best move in the position before the move, in UCI. */
  best?: string | null;
  /** Whether the resulting position is a known opening (book) position. */
  isBook?: boolean;
}

export interface Classification {
  class: MoveClass;
  /** Win percentage lost by the move, from the mover's POV (>= 0). */
  winLoss: number;
  /** Per-move accuracy (0–100). */
  accuracy: number;
}

export function winPercentLoss(mover: Side, before: Evaluation, after: Evaluation): number {
  return Math.max(0, winPercentFor(before, mover) - winPercentFor(after, mover));
}

export function classifyByLoss(winLoss: number): Exclude<MoveClass, "book" | "best"> {
  if (winLoss < CLASS_THRESHOLDS.excellent) return "excellent";
  if (winLoss < CLASS_THRESHOLDS.good) return "good";
  if (winLoss < CLASS_THRESHOLDS.inaccuracy) return "inaccuracy";
  if (winLoss < CLASS_THRESHOLDS.mistake) return "mistake";
  return "blunder";
}

/**
 * Per-move accuracy from win-percentage loss (lichess formula):
 * 103.1668 · e^(−0.04354 · loss) − 3.1669, plus lichess' +1 "uncertainty bonus",
 * clamped to [0, 100].
 */
export function moveAccuracy(winLoss: number): number {
  const raw = 103.1668 * Math.exp(-0.04354 * winLoss) - 3.1669 + 1; // +1 uncertainty bonus, as lichess
  return Math.max(0, Math.min(100, raw));
}

export function classifyMove(input: ClassifyInput): Classification {
  const winLoss = winPercentLoss(input.mover, input.before, input.after);
  const accuracy = moveAccuracy(winLoss);
  if (input.isBook) return { class: "book", winLoss, accuracy };
  if (input.best && input.best === input.played) return { class: "best", winLoss, accuracy: 100 };
  return { class: classifyByLoss(winLoss), winLoss, accuracy };
}

/** Mean accuracy for a list of per-move accuracies (empty → null). */
export function gameAccuracy(accuracies: number[]): number | null {
  if (!accuracies.length) return null;
  return accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
}

export const CLASS_META: Record<MoveClass, { label: string; symbol: string; tone: string }> = {
  book: { label: "Book", symbol: "≡", tone: "book" },
  best: { label: "Best", symbol: "★", tone: "best" },
  excellent: { label: "Excellent", symbol: "!", tone: "excellent" },
  good: { label: "Good", symbol: "✓", tone: "good" },
  inaccuracy: { label: "Inaccuracy", symbol: "?!", tone: "inaccuracy" },
  mistake: { label: "Mistake", symbol: "?", tone: "mistake" },
  blunder: { label: "Blunder", symbol: "??", tone: "blunder" },
};
