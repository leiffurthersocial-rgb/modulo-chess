import { Chess, type Square } from "chess.js";

export interface PlacedPiece {
  id: string;
  color: "w" | "b";
  type: "p" | "n" | "b" | "r" | "q" | "k";
  square: Square;
}

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export function squareToXY(square: string, orientation: "w" | "b"): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return orientation === "w" ? { x: file, y: 7 - rank } : { x: 7 - file, y: rank };
}

export function xyToSquare(x: number, y: number, orientation: "w" | "b"): Square | null {
  if (x < 0 || x > 7 || y < 0 || y > 7) return null;
  const file = orientation === "w" ? x : 7 - x;
  const rank = orientation === "w" ? 7 - y : y;
  return `${FILES[file]}${rank + 1}` as Square;
}

export function piecesFromFen(fen: string): Omit<PlacedPiece, "id">[] {
  const out: Omit<PlacedPiece, "id">[] = [];
  const rows = fen.split(" ")[0].split("/");
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        out.push({
          color: ch === ch.toUpperCase() ? "w" : "b",
          type: ch.toLowerCase() as PlacedPiece["type"],
          square: `${FILES[f]}${8 - r}` as Square,
        });
        f++;
      }
    }
  });
  return out;
}

let pieceSeq = 0;

/**
 * Assigns stable ids to pieces of the next position so that moved pieces keep their
 * id (and therefore animate via CSS transforms) instead of being re-created.
 */
export function matchPieces(prev: PlacedPiece[], fen: string): PlacedPiece[] {
  const next = piecesFromFen(fen);
  const used = new Set<string>();
  const result: (PlacedPiece | null)[] = next.map(() => null);
  // 1. Unchanged pieces keep their id.
  next.forEach((p, i) => {
    const same = prev.find(
      (q) => !used.has(q.id) && q.square === p.square && q.type === p.type && q.color === p.color,
    );
    if (same) {
      used.add(same.id);
      result[i] = { ...p, id: same.id };
    }
  });
  // 2. Moved pieces: nearest unmatched previous piece of the same kind.
  next.forEach((p, i) => {
    if (result[i]) return;
    let best: PlacedPiece | null = null;
    let bestDist = Infinity;
    for (const q of prev) {
      if (used.has(q.id) || q.type !== p.type || q.color !== p.color) continue;
      const a = squareToXY(q.square, "w");
      const b = squareToXY(p.square, "w");
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < bestDist) {
        bestDist = d;
        best = q;
      }
    }
    if (best) {
      used.add(best.id);
      result[i] = { ...p, id: best.id };
    } else {
      result[i] = { ...p, id: `p${++pieceSeq}` };
    }
  });
  return result as PlacedPiece[];
}

export type DestMap = Map<Square, { to: Square; promotion: boolean }[]>;

export function legalDests(fen: string): DestMap {
  const map: DestMap = new Map();
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return map;
  }
  for (const m of chess.moves({ verbose: true })) {
    const list = map.get(m.from) ?? [];
    if (!list.some((d) => d.to === m.to)) list.push({ to: m.to, promotion: Boolean(m.promotion) });
    map.set(m.from, list);
  }
  return map;
}

const NAMES: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};
export const pieceName = (type: string) => NAMES[type] ?? type;
