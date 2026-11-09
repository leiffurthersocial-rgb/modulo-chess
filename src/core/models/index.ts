/**
 * Domain models for roadmap features (accounts, saved games, online play,
 * puzzles, opening trainer, game database, cloud analysis, share links).
 *
 * v1 is fully client-side and does not persist games, but every feature is
 * written against these shapes so a backend can be introduced behind the
 * repository interfaces without touching modules or the board.
 */
import type { MoveClass } from "../analysis/classify";
import type { PgnHeaders } from "../chess/pgn";
import type { Evaluation } from "../engine/types";

export type Id = string;
export type IsoDate = string;

/** A signed-in user (accounts). Anonymous users have no profile. */
export interface UserProfile {
  id: Id;
  handle: string;
  displayName?: string;
  createdAt: IsoDate;
  ratings?: Partial<Record<"bullet" | "blitz" | "rapid" | "classical" | "puzzle", number>>;
}

export type GameSource =
  | { kind: "analysis" }
  | { kind: "engine"; strength: { elo: number } }
  | { kind: "elo-estimate"; opponentElo: number }
  | { kind: "import"; fileName?: string }
  | { kind: "online"; gameId: Id; timeControl: string }
  | { kind: "database"; databaseId: Id };

/**
 * A stored game. `pgn` is the canonical, portable representation (it carries
 * variations and comments); the in-memory GameTree is rebuilt from it.
 */
export interface SavedGame {
  id: Id;
  ownerId?: Id;
  headers: PgnHeaders;
  pgn: string;
  startFen: string;
  result: string;
  source: GameSource;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  tags?: string[];
}

/** Engine evaluation of one position (keyed by EPD so it can be shared across games). */
export interface PositionAnalysis {
  epd: string;
  eval: Evaluation;
  bestMove: string | null;
  pv: string[];
  depth: number;
  engine: string;
  /** Where the analysis ran: in this browser or on a cloud worker. */
  origin: "local" | "cloud";
}

/** Result of a full-game review, attachable to a SavedGame. */
export interface GameReviewRecord {
  gameId: Id;
  depth: number;
  engine: string;
  moves: { ply: number; uci: string; class: MoveClass; winLoss: number; accuracy: number }[];
  accuracy: { w: number | null; b: number | null };
  createdAt: IsoDate;
}

/** Puzzle / opening-trainer item: a position plus the expected continuation. */
export interface TrainingItem {
  id: Id;
  kind: "puzzle" | "opening";
  fen: string;
  solution: string[];
  themes?: string[];
  rating?: number;
}

/** State encoded in a shareable analysis link. */
export interface SharedAnalysis {
  version: 1;
  pgn: string;
  /** Ply index (along the main line) to open at. */
  ply?: number;
  orientation?: "w" | "b";
}

/** Persistence boundary for saved games (localStorage, IndexedDB or an API). */
export interface GameRepository {
  list(query?: {
    ownerId?: Id;
    limit?: number;
    cursor?: string;
  }): Promise<{ games: SavedGame[]; cursor?: string }>;
  get(id: Id): Promise<SavedGame | null>;
  save(game: Omit<SavedGame, "id" | "createdAt" | "updatedAt"> & { id?: Id }): Promise<SavedGame>;
  remove(id: Id): Promise<void>;
}

/** Analysis cache / cloud-analysis boundary. */
export interface AnalysisRepository {
  lookup(epd: string, minDepth: number): Promise<PositionAnalysis | null>;
  store(analysis: PositionAnalysis): Promise<void>;
}
