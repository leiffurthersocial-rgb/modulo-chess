import { Chess } from "chess.js";
import { toEpd, toUci, type MoveNode } from "@/core/chess/tree";

/** EPD → [ECO code, name, plies] (built by scripts/build-openings.mjs). */
export type OpeningDb = Record<string, [string, string, number]>;

export interface OpeningInfo {
  eco: string;
  name: string;
  /** Node in the current path where the opening was last identified. */
  nodeId?: string;
}

export interface ExplorerMove {
  san: string;
  uci: string;
  opening: OpeningInfo;
  /** Present for providers that know game statistics (e.g. a future Lichess provider). */
  stats?: { white: number; draws: number; black: number; games: number };
}

export interface ExplorerResult {
  opening: OpeningInfo | null;
  moves: ExplorerMove[];
}

/**
 * An opening explorer source. v1 ships a local ECO provider; a masters/Lichess/
 * personal-database provider can implement the same interface later.
 */
export interface OpeningExplorerProvider {
  id: string;
  name: string;
  /** Explore a position; `path` is the move history leading to it (root first). */
  explore(fen: string, path: MoveNode[]): Promise<ExplorerResult>;
}

let dbPromise: Promise<OpeningDb> | null = null;

/** Loads the bundled ECO data as a separate lazily-fetched chunk. */
export function loadOpeningDb(): Promise<OpeningDb> {
  dbPromise ??= import("./data/openings.json").then((m) => m.default as unknown as OpeningDb);
  return dbPromise;
}

/** Deepest named opening along a path. */
export function identifyOpening(db: OpeningDb, path: MoveNode[]): OpeningInfo | null {
  for (let i = path.length - 1; i >= 0; i--) {
    const hit = db[toEpd(path[i].fen)];
    if (hit) return { eco: hit[0], name: hit[1], nodeId: path[i].id };
  }
  return null;
}

export function isBookPosition(db: OpeningDb, fen: string): boolean {
  return toEpd(fen) in db;
}

/** Legal moves from `fen` that reach a named opening position. */
export function bookContinuations(db: OpeningDb, fen: string): ExplorerMove[] {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }
  const out: ExplorerMove[] = [];
  for (const m of chess.moves({ verbose: true })) {
    const hit = db[toEpd(m.after)];
    if (hit) out.push({ san: m.san, uci: toUci(m), opening: { eco: hit[0], name: hit[1] } });
  }
  return out.sort((a, b) => a.opening.eco.localeCompare(b.opening.eco) || a.san.localeCompare(b.san));
}

export const localEcoProvider: OpeningExplorerProvider = {
  id: "local-eco",
  name: "ECO names (offline)",
  async explore(fen, path) {
    const db = await loadOpeningDb();
    return { opening: identifyOpening(db, path), moves: bookContinuations(db, fen) };
  },
};
