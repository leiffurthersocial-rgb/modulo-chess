import type { Evaluation, RelativeScore } from "./types";

export type Side = "w" | "b";

/** Converts a side-to-move relative UCI score into a White-POV evaluation. */
export function normalizeScore(score: RelativeScore, turn: Side): Evaluation {
  if (score.kind === "cp") {
    const cp = turn === "w" ? score.value : -score.value;
    return { kind: "cp", cp: cp === 0 ? 0 : cp }; // avoid -0
  }
  // mate > 0: side to move delivers mate; mate <= 0: side to move is getting mated.
  const stmWins = score.value > 0;
  const winner: Side = stmWins ? turn : turn === "w" ? "b" : "w";
  return { kind: "mate", moves: Math.abs(score.value), winner };
}

const WIN_K = 0.00368208; // lichess / Stockfish-calibrated logistic constant
const CP_CLAMP = 1000;

/** Win chances for White in [-1, 1]. */
export function winningChances(ev: Evaluation): number {
  if (ev.kind === "mate") return ev.winner === "w" ? 1 : -1;
  const cp = Math.max(-CP_CLAMP, Math.min(CP_CLAMP, ev.cp));
  return 2 / (1 + Math.exp(-WIN_K * cp)) - 1;
}

/** White's win percentage in [0, 100]. */
export function whiteWinPercent(ev: Evaluation): number {
  return 50 + 50 * winningChances(ev);
}

/** Win percentage from the given side's point of view. */
export function winPercentFor(ev: Evaluation, side: Side): number {
  const w = whiteWinPercent(ev);
  return side === "w" ? w : 100 - w;
}

/** Formats an evaluation: "+0.35", "−1.20", "#3", "#−2", "0.00". */
export function formatEval(ev: Evaluation, { sign = true }: { sign?: boolean } = {}): string {
  if (ev.kind === "mate") {
    if (ev.moves === 0) return ev.winner === "w" ? "1-0" : "0-1";
    return ev.winner === "w" ? `#${ev.moves}` : `#−${ev.moves}`;
  }
  const pawns = ev.cp / 100;
  if (Math.abs(pawns) < 0.005) return "0.00";
  const abs = Math.abs(pawns).toFixed(2);
  if (pawns > 0) return sign ? `+${abs}` : abs;
  return `−${abs}`;
}

/** Compact label for the eval bar: "0.4", "12", "M3", "1-0". Always unsigned. */
export function formatEvalShort(ev: Evaluation): string {
  if (ev.kind === "mate") return ev.moves === 0 ? (ev.winner === "w" ? "1-0" : "0-1") : `M${ev.moves}`;
  const p = Math.abs(ev.cp / 100);
  return p >= 9.95 ? String(Math.round(p)) : p.toFixed(1);
}

/** Orders evaluations from White's point of view (higher is better for White). */
export function evalToComparable(ev: Evaluation): number {
  if (ev.kind === "mate") {
    // Faster mates are better; keep mates outside any cp range.
    return ev.winner === "w" ? 100000 - ev.moves : -100000 + ev.moves;
  }
  return ev.cp;
}

/** Clamp to a cp value for graphing. */
export function evalToGraphCp(ev: Evaluation, clamp = 1000): number {
  if (ev.kind === "mate") return ev.winner === "w" ? clamp : -clamp;
  return Math.max(-clamp, Math.min(clamp, ev.cp));
}
