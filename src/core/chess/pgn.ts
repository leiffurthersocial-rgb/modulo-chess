import { Chess, SEVEN_TAG_ROSTER, validateFen } from "chess.js";
import {
  START_FEN,
  addMove,
  createTree,
  fullMoveNumber,
  normalizeFen,
  sideToMove,
  updateNode,
  type GameTree,
  type MoveNode,
} from "./tree";

export type PgnHeaders = Record<string, string>;

export interface ParsedGame {
  headers: PgnHeaders;
  tree: GameTree;
  result: string;
}

export class PgnError extends Error {
  constructor(
    message: string,
    public readonly gameIndex = 0,
  ) {
    super(message);
    this.name = "PgnError";
  }
}

const RESULTS = new Set(["1-0", "0-1", "1/2-1/2", "*"]);
const SUFFIX_NAGS: Record<string, number> = { "!": 1, "?": 2, "!!": 3, "??": 4, "!?": 5, "?!": 6 };

type Token =
  | { t: "comment"; v: string }
  | { t: "open" }
  | { t: "close" }
  | { t: "nag"; v: number }
  | { t: "result"; v: string }
  | { t: "san"; v: string };

function tokenize(movetext: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = movetext;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
    } else if (c === "{") {
      const end = s.indexOf("}", i + 1);
      const stop = end === -1 ? s.length : end;
      tokens.push({ t: "comment", v: s.slice(i + 1, stop).trim() });
      i = stop + 1;
    } else if (c === ";") {
      const end = s.indexOf("\n", i + 1);
      const stop = end === -1 ? s.length : end;
      tokens.push({ t: "comment", v: s.slice(i + 1, stop).trim() });
      i = stop + 1;
    } else if (c === "(") {
      tokens.push({ t: "open" });
      i++;
    } else if (c === ")") {
      tokens.push({ t: "close" });
      i++;
    } else if (c === "$") {
      const m = /^\$(\d+)/.exec(s.slice(i));
      if (m) tokens.push({ t: "nag", v: Number(m[1]) });
      i += m ? m[0].length : 1;
    } else {
      const m = /^[^\s{}();$]+/.exec(s.slice(i));
      const word = m ? m[0] : c;
      i += word.length;
      if (RESULTS.has(word)) {
        tokens.push({ t: "result", v: word });
        continue;
      }
      // Strip move numbers ("12.", "12...", "12.e4").
      const rest = word.replace(/^\d+\.*/, "");
      if (!rest) continue;
      const suffix = /([!?]{1,2})$/.exec(rest);
      const san = suffix ? rest.slice(0, -suffix[1].length) : rest;
      if (san) tokens.push({ t: "san", v: san });
      if (suffix && SUFFIX_NAGS[suffix[1]]) tokens.push({ t: "nag", v: SUFFIX_NAGS[suffix[1]] });
    }
  }
  return tokens;
}

function normalizeSan(san: string): string {
  return san
    .replace(/0-0-0/g, "O-O-O")
    .replace(/0-0/g, "O-O")
    .replace(/[+#]+$/, "")
    .replace(/^P(?=[a-h])/, "");
}

/** Splits a PGN database into individual game texts. */
export function splitGames(text: string): string[] {
  const clean = text.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
  const games: string[] = [];
  let current: string[] = [];
  let inMoves = false;
  for (const line of clean.split("\n")) {
    if (line.startsWith("%")) continue; // escape mechanism
    const isHeader = /^\s*\[\w+\s+".*"\]\s*$/.test(line);
    if (isHeader && inMoves) {
      games.push(current.join("\n"));
      current = [];
      inMoves = false;
    }
    if (!isHeader && line.trim()) inMoves = true;
    current.push(line);
  }
  if (current.join("").trim()) games.push(current.join("\n"));
  return games;
}

export function parseGame(text: string, gameIndex = 0): ParsedGame {
  const headers: PgnHeaders = {};
  const headerRe = /^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/;
  const moveLines: string[] = [];
  for (const line of text.split("\n")) {
    const m = headerRe.exec(line);
    if (m) headers[m[1]] = m[2].replace(/\\(["\\])/g, "$1");
    else moveLines.push(line);
  }

  let startFen = START_FEN;
  if (headers.FEN) {
    const fen = normalizeFen(headers.FEN);
    const v = validateFen(fen);
    if (!v.ok) throw new PgnError(`Invalid FEN header: ${v.error}`, gameIndex);
    startFen = fen;
  }

  let tree = createTree(startFen);
  let result = headers.Result && RESULTS.has(headers.Result) ? headers.Result : "*";
  // cur: node after which the next move is played. last: last move node at this depth.
  let cur = tree.rootId;
  let last: string | null = null;
  const stack: { cur: string; last: string | null }[] = [];

  for (const tok of tokenize(moveLines.join("\n"))) {
    switch (tok.t) {
      case "san": {
        const res = addMove(tree, cur, normalizeSan(tok.v));
        if (!res) {
          const n = tree.nodes[cur];
          const num = fullMoveNumber(n.fen);
          const dots = sideToMove(n.fen) === "w" ? "." : "...";
          throw new PgnError(`Illegal move "${tok.v}" at ${num}${dots}`, gameIndex);
        }
        tree = res.tree;
        last = res.nodeId;
        cur = res.nodeId;
        break;
      }
      case "comment": {
        const target = last ?? tree.rootId;
        const prev = tree.nodes[target].comment;
        tree = updateNode(tree, target, { comment: prev ? `${prev} ${tok.v}` : tok.v });
        break;
      }
      case "nag": {
        if (last) {
          const n = tree.nodes[last];
          tree = updateNode(tree, last, { nags: [...(n.nags ?? []), tok.v] });
        }
        break;
      }
      case "open": {
        if (!last) throw new PgnError("Variation without a preceding move", gameIndex);
        stack.push({ cur, last });
        cur = tree.nodes[last].parentId!;
        last = null;
        break;
      }
      case "close": {
        const top = stack.pop();
        if (!top) throw new PgnError("Unbalanced ')' in movetext", gameIndex);
        cur = top.cur;
        last = top.last;
        break;
      }
      case "result":
        if (stack.length === 0) result = tok.v;
        break;
    }
  }
  if (stack.length) throw new PgnError("Unclosed variation '(' in movetext", gameIndex);
  return { headers, tree, result };
}

/** Parses every game in a PGN text. Throws PgnError on the first invalid game. */
export function parsePgn(text: string): ParsedGame[] {
  const games = splitGames(text);
  if (!games.length) throw new PgnError("No games found in PGN");
  return games.map((g, i) => parseGame(g, i));
}

// ---------------------------------------------------------------------------
// Serialisation

function escapeHeader(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function writeMove(node: MoveNode, parent: MoveNode, forceNumber: boolean, out: string[]) {
  const num = fullMoveNumber(parent.fen);
  if (sideToMove(parent.fen) === "w") out.push(`${num}. ${node.san}`);
  else out.push(forceNumber ? `${num}... ${node.san}` : node.san!);
  for (const nag of node.nags ?? []) out.push(`$${nag}`);
}

function writeComment(node: MoveNode, out: string[]): boolean {
  if (!node.comment) return false;
  out.push(`{ ${node.comment.replace(/}/g, ")")} }`);
  return true;
}

function writeLine(tree: GameTree, parentId: string, forceNumber: boolean, out: string[]) {
  let parent = tree.nodes[parentId];
  let force = forceNumber;
  while (parent.children.length) {
    const [mainId, ...alts] = parent.children;
    const main = tree.nodes[mainId];
    writeMove(main, parent, force, out);
    force = writeComment(main, out);
    for (const altId of alts) {
      const alt = tree.nodes[altId];
      out.push("(");
      writeMove(alt, parent, true, out);
      const commented = writeComment(alt, out);
      writeLine(tree, altId, commented, out);
      out.push(")");
      force = true;
    }
    parent = main;
  }
}

function wrap(tokens: string[], width = 80): string {
  // Glue parentheses to their neighbours so a line never ends with "(" or starts with ")".
  const glued: string[] = [];
  let prefix = "";
  for (const tok of tokens) {
    if (tok === "(") prefix += "(";
    else if (tok === ")" && glued.length && !prefix) glued[glued.length - 1] += ")";
    else {
      glued.push(prefix + tok);
      prefix = "";
    }
  }
  const lines: string[] = [];
  let line = "";
  for (const tok of glued) {
    if (line && line.length + 1 + tok.length > width) {
      lines.push(line);
      line = tok;
    } else {
      line = line ? `${line} ${tok}` : tok;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

export interface SerializeOptions {
  headers?: PgnHeaders;
  result?: string;
}

export function serializePgn(tree: GameTree, { headers = {}, result }: SerializeOptions = {}): string {
  const root = tree.nodes[tree.rootId];
  const res = result ?? headers.Result ?? "*";
  const all: PgnHeaders = { ...SEVEN_TAG_ROSTER, ...headers, Result: res };
  if (root.fen !== START_FEN) {
    all.SetUp = "1";
    all.FEN = root.fen;
  } else {
    delete all.SetUp;
    delete all.FEN;
  }
  const ordered = [
    ...Object.keys(SEVEN_TAG_ROSTER),
    ...Object.keys(all).filter((k) => !(k in SEVEN_TAG_ROSTER)),
  ];
  const headerText = ordered.map((k) => `[${k} "${escapeHeader(all[k] ?? "?")}"]`).join("\n");
  const tokens: string[] = [];
  const rootCommented = writeComment(root, tokens);
  writeLine(tree, tree.rootId, rootCommented || sideToMove(root.fen) === "b", tokens);
  tokens.push(res);
  return `${headerText}\n\n${wrap(tokens)}\n`;
}

/** Validates a FEN string (accepts 4-field EPD too). */
export function checkFen(input: string): { ok: true; fen: string } | { ok: false; error: string } {
  const fen = normalizeFen(input);
  const v = validateFen(fen);
  if (!v.ok) return { ok: false, error: v.error ?? "Invalid FEN" };
  try {
    new Chess(fen);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid FEN" };
  }
  return { ok: true, fen };
}
