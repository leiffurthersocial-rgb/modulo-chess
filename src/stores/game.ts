"use client";

import { Chess } from "chess.js";
import { create } from "zustand";
import { type ParsedGame, type PgnHeaders } from "@/core/chess/pgn";
import {
  START_FEN,
  addMove,
  createTree,
  deleteNode,
  isOnMainline,
  lineFrom,
  promoteVariation,
  type GameTree,
  type MoveInput,
} from "@/core/chess/tree";

export type GameMode = "analysis" | "play";

export type Strength = { kind: "skill"; level: number } | { kind: "elo"; elo: number };

export interface PlayConfig {
  userColor: "w" | "b";
  strength: Strength;
}

export interface PreviewState {
  fen: string;
  lastMove?: { from: string; to: string };
  /** Human label, e.g. "Line 1 · 14... Nf6" */
  label?: string;
}

export interface GameState {
  tree: GameTree;
  currentId: string;
  headers: PgnHeaders;
  result: string;
  orientation: "w" | "b";
  mode: GameMode;
  play: PlayConfig;
  /** Engine opponent is thinking. */
  thinking: boolean;
  /** Read-only board preview (hovering an engine line). */
  preview: PreviewState | null;
  /** Bumped whenever a new game is loaded; lets modules reset derived state. */
  gameKey: number;

  playMove: (move: MoveInput | string) => boolean;
  goTo: (id: string) => void;
  next: () => void;
  prev: () => void;
  first: () => void;
  last: () => void;
  nextVariation: (dir: 1 | -1) => void;
  flip: () => void;
  setOrientation: (o: "w" | "b") => void;
  newGame: (fen?: string) => void;
  loadParsed: (game: ParsedGame) => void;
  deleteFrom: (id: string) => void;
  promote: (id: string) => void;
  setHeaders: (h: PgnHeaders) => void;
  setResult: (r: string) => void;
  startPlay: (config: PlayConfig, fromCurrent: boolean) => void;
  stopPlay: () => void;
  takeback: () => void;
  setThinking: (t: boolean) => void;
  setPreview: (p: PreviewState | null) => void;
}

const initialTree = createTree();

export const useGame = create<GameState>()((set, get) => ({
  tree: initialTree,
  currentId: initialTree.rootId,
  headers: {},
  result: "*",
  orientation: "w",
  mode: "analysis",
  play: { userColor: "w", strength: { kind: "skill", level: 8 } },
  thinking: false,
  preview: null,
  gameKey: 0,

  playMove: (move) => {
    const { tree, currentId, mode } = get();
    const res = addMove(tree, currentId, move);
    if (!res) return false;
    const patch: Partial<GameState> = { tree: res.tree, currentId: res.nodeId, preview: null };
    if (mode === "play") {
      const chess = new Chess(res.move.after);
      if (chess.isGameOver()) patch.result = resultOf(chess);
    }
    set(patch);
    return true;
  },
  goTo: (id) => {
    if (get().tree.nodes[id]) set({ currentId: id, preview: null });
  },
  next: () => {
    const { tree, currentId } = get();
    const child = tree.nodes[currentId]?.children[0];
    if (child) set({ currentId: child, preview: null });
  },
  prev: () => {
    const { tree, currentId } = get();
    const parent = tree.nodes[currentId]?.parentId;
    if (parent) set({ currentId: parent, preview: null });
  },
  first: () => set((s) => ({ currentId: s.tree.rootId, preview: null })),
  last: () => {
    const { tree, currentId } = get();
    const line = lineFrom(tree, currentId);
    set({ currentId: line[line.length - 1].id, preview: null });
  },
  nextVariation: (dir) => {
    const { tree, currentId } = get();
    const node = tree.nodes[currentId];
    if (!node?.parentId) return;
    const siblings = tree.nodes[node.parentId].children;
    const idx = siblings.indexOf(currentId);
    const target = siblings[(idx + dir + siblings.length) % siblings.length];
    if (target && target !== currentId) set({ currentId: target, preview: null });
  },
  flip: () => set((s) => ({ orientation: s.orientation === "w" ? "b" : "w" })),
  setOrientation: (orientation) => set({ orientation }),
  newGame: (fen = START_FEN) => {
    const tree = createTree(fen);
    set((s) => ({
      tree,
      currentId: tree.rootId,
      headers: {},
      result: "*",
      mode: "analysis",
      thinking: false,
      preview: null,
      gameKey: s.gameKey + 1,
    }));
  },
  loadParsed: (game) => {
    set((s) => ({
      tree: game.tree,
      currentId: game.tree.rootId,
      headers: game.headers,
      result: game.result,
      mode: "analysis",
      thinking: false,
      preview: null,
      gameKey: s.gameKey + 1,
    }));
  },
  deleteFrom: (id) => {
    const { tree, currentId } = get();
    const res = deleteNode(tree, id);
    if (!res) return;
    const stillExists = Boolean(res.tree.nodes[currentId]);
    set({ tree: res.tree, currentId: stillExists ? currentId : res.parentId });
  },
  promote: (id) => set((s) => ({ tree: promoteVariation(s.tree, id) })),
  setHeaders: (headers) => set({ headers }),
  setResult: (result) => set({ result }),
  startPlay: (play, fromCurrent) => {
    const s = get();
    const engineName = `Stockfish (${play.strength.kind === "elo" ? `${play.strength.elo} Elo` : `level ${play.strength.level}`})`;
    const headers: PgnHeaders = {
      Event: "Casual game vs Stockfish",
      Site: "Modulo: Chess",
      Date: pgnDate(new Date()),
      White: play.userColor === "w" ? "You" : engineName,
      Black: play.userColor === "b" ? "You" : engineName,
    };
    if (fromCurrent) {
      // Continue from the current position as a fresh game.
      const tree = createTree(s.tree.nodes[s.currentId].fen);
      set({
        tree,
        currentId: tree.rootId,
        headers,
        result: "*",
        mode: "play",
        play,
        thinking: false,
        preview: null,
        orientation: play.userColor,
        gameKey: s.gameKey + 1,
      });
    } else {
      const tree = createTree();
      set({
        tree,
        currentId: tree.rootId,
        headers,
        result: "*",
        mode: "play",
        play,
        thinking: false,
        preview: null,
        orientation: play.userColor,
        gameKey: s.gameKey + 1,
      });
    }
  },
  stopPlay: () => set({ mode: "analysis", thinking: false }),
  takeback: () => {
    const { tree, currentId, play, mode } = get();
    if (mode !== "play") return;
    // Undo back to the last position where it is the user's turn (removing the moves).
    let id = currentId;
    let removed = 0;
    while (id !== tree.rootId && removed < 2) {
      const parent = tree.nodes[id].parentId!;
      id = parent;
      removed++;
      const turn = tree.nodes[id].fen.split(" ")[1];
      if (turn === play.userColor) break;
    }
    if (id === currentId) return;
    const child = tree.nodes[id].children[0];
    const res = child ? deleteNode(tree, child) : null;
    set({ tree: res ? res.tree : tree, currentId: id, result: "*", thinking: false });
  },
  setThinking: (thinking) => set({ thinking }),
  setPreview: (preview) => set({ preview }),
}));

export function pgnDate(d: Date): string {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function resultOf(chess: Chess): string {
  if (chess.isCheckmate()) return chess.turn() === "w" ? "0-1" : "1-0";
  if (chess.isDraw() || chess.isStalemate()) return "1/2-1/2";
  return "*";
}

export type GameStatusKind =
  "playing" | "checkmate" | "stalemate" | "threefold" | "fifty-move" | "insufficient";

export interface PositionStatus {
  kind: GameStatusKind;
  turn: "w" | "b";
  inCheck: boolean;
  /** Human-readable description. */
  text: string;
}

const statusCache = new Map<string, PositionStatus>();

/** Status of a position. Repetition needs history, so pass the FENs leading to it when known. */
export function positionStatus(fen: string, history: string[] = []): PositionStatus {
  const key = history.length ? `${fen}|${history.join("|")}` : fen;
  const cached = statusCache.get(key);
  if (cached) return cached;
  const chess = new Chess(fen);
  const turn = chess.turn();
  const side = turn === "w" ? "White" : "Black";
  let st: PositionStatus;
  if (chess.isCheckmate())
    st = {
      kind: "checkmate",
      turn,
      inCheck: true,
      text: `Checkmate — ${turn === "w" ? "Black" : "White"} wins`,
    };
  else if (chess.isStalemate()) st = { kind: "stalemate", turn, inCheck: false, text: "Stalemate — draw" };
  else if (chess.isInsufficientMaterial())
    st = { kind: "insufficient", turn, inCheck: false, text: "Insufficient material — draw" };
  else if (chess.isDrawByFiftyMoves())
    st = { kind: "fifty-move", turn, inCheck: chess.inCheck(), text: "Fifty-move rule — draw" };
  else if (isThreefold(fen, history))
    st = { kind: "threefold", turn, inCheck: chess.inCheck(), text: "Threefold repetition — draw" };
  else st = { kind: "playing", turn, inCheck: chess.inCheck(), text: `${side} to move` };
  if (statusCache.size > 500) statusCache.clear();
  statusCache.set(key, st);
  return st;
}

function isThreefold(fen: string, history: string[]): boolean {
  const key = fen.split(" ").slice(0, 4).join(" ");
  let n = 1;
  for (const h of history) if (h.split(" ").slice(0, 4).join(" ") === key) n++;
  return n >= 3;
}

export { isOnMainline };
