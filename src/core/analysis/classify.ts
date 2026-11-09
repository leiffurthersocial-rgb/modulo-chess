import { winPercentFor, type Side } from "../engine/evaluation";
import type { Evaluation } from "../engine/types";

export type MoveClass =
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "book"
  | "forced"
  | "inaccuracy"
  | "mistake"
  | "miss"
  | "blunder";

/** Display order (best to worst). */
export const MOVE_CLASSES: MoveClass[] = [
  "brilliant",
  "great",
  "best",
  "excellent",
  "good",
  "book",
  "forced",
  "inaccuracy",
  "mistake",
  "miss",
  "blunder",
];

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

export interface ReviewClassifyInput {
  /** The played move (UCI) and the engine's best move in the position before it. */
  played: string;
  best: string | null;
  /** Mover's win% with best play before the move. */
  bestWin: number;
  /** Mover's win% after the played move (from the same search when available). */
  playedWin: number;
  /** Mover's win% after the second-best move, if known. */
  secondWin?: number | null;
  /** Legal moves available to the mover. */
  legalMoves: number;
  isBook?: boolean;
  /** The move leaves material en prise beyond what it captured. */
  sacrifice?: boolean;
  /** The move recaptures on the square of the opponent's last capture. */
  recapture?: boolean;
  /** Win% the opponent gave away with their previous move (0 if none). */
  opponentErrorLoss?: number;
  /** The mover was in check (escaping check is never "great" or "brilliant"). */
  inCheck?: boolean;
  /** The best line is a forced mate for the mover. */
  bestIsMate?: boolean;
}

/** Thresholds for the special classes (win-percentage points, mover's POV). */
export const SPECIAL_THRESHOLDS = {
  /** A sacrifice may lose at most this much and still be brilliant. */
  brilliantMaxLoss: 2,
  /**
   * Above this the game is "already won": a sacrifice then only counts as brilliant
   * when it is the engine's move and either forces mate or beats the alternatives
   * by brilliantKeyGap (i.e. it is the key to the win, not a flourish).
   */
  brilliantMaxBefore: 90,
  brilliantKeyGap: 10,
  brilliantMinAfter: 40,
  /** Best move is "great" when the second-best is this much worse… */
  greatGap: 20,
  /** …the mover isn't losing, and the alternative really changes the outcome. */
  greatMinBest: 40,
  greatMaxSecond: 75,
  /** Opponent error size that creates a chance you can "miss". */
  missOpponentError: 10,
  /** A miss still leaves you at least this well off (otherwise it's a blunder). */
  missMinAfter: 35,
} as const;

/**
 * chess.com-style classification for game review: brilliant, great, best,
 * excellent, good, book, forced, inaccuracy, mistake, miss, blunder.
 */
export function classifyReviewMove(input: ReviewClassifyInput): Classification {
  const T = SPECIAL_THRESHOLDS;
  const winLoss = Math.max(0, input.bestWin - input.playedWin);
  const accuracy = accuracyFromWins(input.bestWin, input.playedWin);
  const result = (c: MoveClass): Classification => ({ class: c, winLoss, accuracy });

  if (input.isBook) return result("book");
  if (input.legalMoves === 1) return result("forced");

  // "Best" means the engine's own choice; equally good alternatives grade as excellent.
  const isBest = input.best !== null && input.played === input.best;

  if (
    !input.inCheck &&
    input.sacrifice &&
    winLoss < T.brilliantMaxLoss &&
    input.playedWin >= T.brilliantMinAfter
  ) {
    const alreadyWon = input.bestWin > T.brilliantMaxBefore;
    const isKey =
      isBest &&
      (input.bestIsMate ||
        (input.secondWin !== undefined &&
          input.secondWin !== null &&
          input.bestWin - input.secondWin >= T.brilliantKeyGap));
    if (!alreadyWon || isKey) return result("brilliant");
  }
  if (
    isBest &&
    !input.inCheck &&
    !input.recapture &&
    input.secondWin !== undefined &&
    input.secondWin !== null &&
    input.bestWin - input.secondWin >= T.greatGap &&
    input.bestWin >= T.greatMinBest &&
    input.secondWin <= T.greatMaxSecond
  ) {
    return result("great");
  }
  if (isBest) return result("best");

  const base = classifyByLoss(winLoss);
  if (
    (base === "mistake" || base === "blunder") &&
    (input.opponentErrorLoss ?? 0) >= T.missOpponentError &&
    input.playedWin >= T.missMinAfter
  ) {
    return result("miss");
  }
  return result(base);
}

function accuracyFromWins(before: number, after: number): number {
  return after >= before ? 100 : moveAccuracy(before - after);
}

export const CLASS_META: Record<MoveClass, { label: string; symbol: string; describe: string }> = {
  brilliant: { label: "Brilliant", symbol: "!!", describe: "a brilliant sacrifice" },
  great: { label: "Great", symbol: "!", describe: "the only good move" },
  best: { label: "Best", symbol: "★", describe: "the best move" },
  excellent: { label: "Excellent", symbol: "👍", describe: "an excellent move" },
  good: { label: "Good", symbol: "✓", describe: "a good move" },
  book: { label: "Book", symbol: "📖", describe: "a book move" },
  forced: { label: "Forced", symbol: "→", describe: "the only legal move" },
  inaccuracy: { label: "Inaccuracy", symbol: "?!", describe: "an inaccuracy" },
  mistake: { label: "Mistake", symbol: "?", describe: "a mistake" },
  miss: { label: "Miss", symbol: "✕", describe: "a missed chance" },
  blunder: { label: "Blunder", symbol: "??", describe: "a blunder" },
};
