import { Chess, type Color, type Square } from "chess.js";

export const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * Largest material `color` stands to lose immediately in `fen` (the opponent to move):
 * an attacked piece that is undefended loses its full value, a defended piece
 * attacked by something cheaper loses the difference. Pawns and the king are ignored.
 */
export function hangingValue(chess: Chess, color: Color): number {
  const opp: Color = color === "w" ? "b" : "w";
  let worst = 0;
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== color || p.type === "k" || p.type === "p") continue;
      const attackers = chess.attackers(p.square as Square, opp);
      if (!attackers.length) continue;
      const cheapest = Math.min(...attackers.map((sq) => PIECE_VALUE[chess.get(sq)!.type] || 100));
      const defended = chess.attackers(p.square as Square, color).length > 0;
      const loss = defended ? Math.max(0, PIECE_VALUE[p.type] - cheapest) : PIECE_VALUE[p.type];
      worst = Math.max(worst, loss);
    }
  }
  return worst;
}

/**
 * Material a move newly leaves en prise beyond what it captured: the defining
 * feature of a sacrifice (≥ 2 pawns counts). Returns 0 for illegal moves, and when
 * the hanging material was already hanging before the move.
 */
export function sacrificedMaterial(fenBefore: string, uci: string): number {
  let chess: Chess;
  let captured = 0;
  let alreadyHanging = 0;
  try {
    chess = new Chess(fenBefore);
    alreadyHanging = hangingValue(chess, chess.turn());
    const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    captured = m.captured ? PIECE_VALUE[m.captured] : 0;
    if (m.promotion) captured += PIECE_VALUE[m.promotion] - 1;
  } catch {
    return 0;
  }
  const mover: Color = chess.turn() === "w" ? "b" : "w";
  const hanging = hangingValue(chess, mover);
  // Leaving an already-attacked piece where it was isn't a sacrifice made by this move.
  if (hanging <= alreadyHanging) return 0;
  return Math.max(0, hanging - captured);
}

export function isSacrifice(fenBefore: string, uci: string): boolean {
  return sacrificedMaterial(fenBefore, uci) >= 2;
}

/** A recapture on the square where the opponent just captured (never "great"). */
export function isRecapture(prevMoveUci: string | undefined, prevWasCapture: boolean, uci: string): boolean {
  return Boolean(prevMoveUci && prevWasCapture && prevMoveUci.slice(2, 4) === uci.slice(2, 4));
}
