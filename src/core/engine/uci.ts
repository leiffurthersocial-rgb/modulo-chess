import type { RelativeScore, UciBestMove, UciInfo, UciOption } from "./types";

const INT_FIELDS = new Set([
  "depth",
  "seldepth",
  "multipv",
  "nodes",
  "nps",
  "time",
  "hashfull",
  "tbhits",
  "currmovenumber",
]);

/** Parses a UCI `info ...` line. Returns null for anything that is not an info line. */
export function parseInfo(line: string): UciInfo | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== "info") return null;
  const info: UciInfo = {};
  let i = 1;
  while (i < tokens.length) {
    const key = tokens[i];
    if (INT_FIELDS.has(key)) {
      const n = Number.parseInt(tokens[i + 1] ?? "", 10);
      if (Number.isFinite(n)) (info as Record<string, number>)[key] = n;
      i += 2;
    } else if (key === "score") {
      const kind = tokens[i + 1];
      const value = Number.parseInt(tokens[i + 2] ?? "", 10);
      if ((kind === "cp" || kind === "mate") && Number.isFinite(value)) {
        info.score = { kind, value } as RelativeScore;
      }
      i += 3;
      // Optional bound flag directly after the score.
      if (tokens[i] === "lowerbound" || tokens[i] === "upperbound") {
        info.bound = tokens[i] === "lowerbound" ? "lower" : "upper";
        i += 1;
      }
    } else if (key === "wdl") {
      const w = Number.parseInt(tokens[i + 1] ?? "", 10);
      const d = Number.parseInt(tokens[i + 2] ?? "", 10);
      const l = Number.parseInt(tokens[i + 3] ?? "", 10);
      if ([w, d, l].every(Number.isFinite)) info.wdl = [w, d, l];
      i += 4;
    } else if (key === "currmove") {
      info.currmove = tokens[i + 1];
      i += 2;
    } else if (key === "pv") {
      info.pv = tokens.slice(i + 1).filter((t) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(t));
      break; // pv is always last
    } else if (key === "string") {
      info.string = tokens.slice(i + 1).join(" ");
      break;
    } else {
      // Unknown token (e.g. "refutation", "currline", "cpuload"): skip it and its value.
      i += 2;
    }
  }
  return info;
}

/** Parses `bestmove e2e4 [ponder e7e5]`. `(none)` (no legal moves) maps to null. */
export function parseBestMove(line: string): UciBestMove | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== "bestmove") return null;
  const move = tokens[1];
  const result: UciBestMove = {
    bestmove: move && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move) ? move : null,
  };
  if (tokens[2] === "ponder" && tokens[3]) result.ponder = tokens[3];
  return result;
}

/** Parses `option name <name...> type <t> [default <v>] [min <n>] [max <n>] [var <v>]*`. */
export function parseOption(line: string): UciOption | null {
  const m = /^option name (.+?) type (\w+)(.*)$/.exec(line.trim());
  if (!m) return null;
  const [, name, type, rest] = m;
  const opt: UciOption = { name, type: type as UciOption["type"] };
  const def = /\bdefault ?(.*?)(?= min | max | var |$)/.exec(rest);
  if (def) opt.default = def[1];
  const min = /\bmin (-?\d+)/.exec(rest);
  if (min) opt.min = Number(min[1]);
  const max = /\bmax (-?\d+)/.exec(rest);
  if (max) opt.max = Number(max[1]);
  const vars = [...rest.matchAll(/\bvar (\S+)/g)].map((v) => v[1]);
  if (vars.length) opt.vars = vars;
  return opt;
}

export interface GoParams {
  depth?: number;
  movetime?: number;
  nodes?: number;
  infinite?: boolean;
}

/** Builds a `go` command. With no limits it searches infinitely (must be stopped). */
export function buildGo({ depth, movetime, nodes, infinite }: GoParams): string {
  const parts = ["go"];
  if (depth && depth > 0) parts.push("depth", String(Math.floor(depth)));
  if (movetime && movetime > 0) parts.push("movetime", String(Math.floor(movetime)));
  if (nodes && nodes > 0) parts.push("nodes", String(Math.floor(nodes)));
  if (infinite || parts.length === 1) parts.push("infinite");
  return parts.join(" ");
}

export function buildPosition(fen: string, moves: string[] = []): string {
  const base = `position fen ${fen}`;
  return moves.length ? `${base} moves ${moves.join(" ")}` : base;
}

export function buildSetOption(name: string, value?: string | number | boolean): string {
  return value === undefined ? `setoption name ${name}` : `setoption name ${name} value ${String(value)}`;
}
