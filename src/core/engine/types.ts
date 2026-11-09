/** Score as reported by UCI: always relative to the side to move. */
export type RelativeScore = { kind: "cp"; value: number } | { kind: "mate"; value: number }; // > 0: side to move mates in N; <= 0: side to move is mated in |N|

/** Score normalised to White's point of view. */
export type Evaluation = { kind: "cp"; cp: number } | { kind: "mate"; moves: number; winner: "w" | "b" }; // moves: plies-to-mate in full moves (0 = already mate)

export interface UciInfo {
  depth?: number;
  seldepth?: number;
  multipv?: number;
  score?: RelativeScore;
  bound?: "lower" | "upper";
  wdl?: [number, number, number];
  nodes?: number;
  nps?: number;
  time?: number;
  hashfull?: number;
  tbhits?: number;
  pv?: string[];
  currmove?: string;
  currmovenumber?: number;
  string?: string;
}

export interface UciBestMove {
  bestmove: string | null;
  ponder?: string;
}

export interface UciOption {
  name: string;
  type: "check" | "spin" | "combo" | "button" | "string";
  default?: string;
  min?: number;
  max?: number;
  vars?: string[];
}

/** One principal variation from a search, normalised. */
export interface EngineLine {
  multipv: number;
  depth: number;
  seldepth?: number;
  eval: Evaluation;
  /** Score relative to side to move, as sent by the engine. */
  score: RelativeScore;
  bound?: "lower" | "upper";
  pv: string[];
  wdl?: [number, number, number];
}

export interface SearchStats {
  depth: number;
  seldepth?: number;
  nodes: number;
  nps: number;
  time: number;
  hashfull?: number;
}

export interface SearchSnapshot {
  fen: string;
  lines: EngineLine[];
  stats: SearchStats;
}

export interface SearchResult extends SearchSnapshot {
  bestMove: string | null;
  ponder?: string;
  /** True when the search was superseded or cancelled before it finished naturally. */
  cancelled: boolean;
}
