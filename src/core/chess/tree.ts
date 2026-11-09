import { Chess, DEFAULT_POSITION, type Move, type Square } from "chess.js";

export const START_FEN = DEFAULT_POSITION;

export interface MoveInput {
  from: Square | string;
  to: Square | string;
  promotion?: "q" | "r" | "b" | "n";
}

export interface MoveNode {
  id: string;
  parentId: string | null;
  /** children[0] is the main continuation; the rest are variations. */
  children: string[];
  /** 0 for the root, 1 after the first move, ... (relative to the tree start). */
  ply: number;
  /** Position after this move (or the start position for the root). */
  fen: string;
  san?: string;
  uci?: string;
  from?: Square;
  to?: Square;
  promotion?: string;
  captured?: boolean;
  check?: boolean;
  comment?: string;
  nags?: number[];
}

export interface GameTree {
  rootId: string;
  nodes: Record<string, MoveNode>;
}

let seq = 0;
const newId = () => `n${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function createTree(fen: string = START_FEN): GameTree {
  const id = newId();
  return { rootId: id, nodes: { [id]: { id, parentId: null, children: [], ply: 0, fen } } };
}

export function toUci(m: Pick<Move, "from" | "to" | "promotion">): string {
  return `${m.from}${m.to}${m.promotion ?? ""}`;
}

export function parseUci(uci: string): MoveInput {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: (uci[4] as MoveInput["promotion"]) || undefined,
  };
}

/** Plays a move on a position. Returns null when illegal (never throws). */
export function tryMove(fen: string, move: MoveInput | string): Move | null {
  try {
    const chess = new Chess(fen);
    return chess.move(move);
  } catch {
    return null;
  }
}

export interface AddMoveResult {
  tree: GameTree;
  nodeId: string;
  move: Move;
  /** False when an identical child already existed and was reused. */
  created: boolean;
}

/** Adds a move as a child of `parentId`, reusing an existing child with the same move. */
export function addMove(
  tree: GameTree,
  parentId: string,
  input: MoveInput | string,
  extra: Partial<Pick<MoveNode, "comment" | "nags">> = {},
): AddMoveResult | null {
  const parent = tree.nodes[parentId];
  if (!parent) return null;
  const move = tryMove(parent.fen, input);
  if (!move) return null;
  const uci = toUci(move);
  const existing = parent.children.find((c) => tree.nodes[c]?.uci === uci);
  if (existing) return { tree, nodeId: existing, move, created: false };

  const id = newId();
  const node: MoveNode = {
    id,
    parentId,
    children: [],
    ply: parent.ply + 1,
    fen: move.after,
    san: move.san,
    uci,
    from: move.from,
    to: move.to,
    promotion: move.promotion,
    captured: Boolean(move.captured),
    check: move.san.includes("+") || move.san.includes("#"),
    ...extra,
  };
  return {
    tree: {
      ...tree,
      nodes: { ...tree.nodes, [parentId]: { ...parent, children: [...parent.children, id] }, [id]: node },
    },
    nodeId: id,
    move,
    created: true,
  };
}

/** Root → node path (inclusive). */
export function pathTo(tree: GameTree, id: string): MoveNode[] {
  const out: MoveNode[] = [];
  let cur: MoveNode | undefined = tree.nodes[id];
  while (cur) {
    out.push(cur);
    cur = cur.parentId ? tree.nodes[cur.parentId] : undefined;
  }
  return out.reverse();
}

/** Follows first children from `fromId` (inclusive). */
export function lineFrom(tree: GameTree, fromId: string): MoveNode[] {
  const out: MoveNode[] = [];
  let cur: MoveNode | undefined = tree.nodes[fromId];
  while (cur) {
    out.push(cur);
    cur = cur.children[0] ? tree.nodes[cur.children[0]] : undefined;
  }
  return out;
}

export function mainline(tree: GameTree): MoveNode[] {
  return lineFrom(tree, tree.rootId);
}

/** Whole visible line through `id`: path to it, then its main continuation. */
export function lineThrough(tree: GameTree, id: string): MoveNode[] {
  const path = pathTo(tree, id);
  return [...path, ...lineFrom(tree, id).slice(1)];
}

export function isOnMainline(tree: GameTree, id: string): boolean {
  let cur = tree.nodes[id];
  while (cur && cur.parentId) {
    const parent = tree.nodes[cur.parentId];
    if (parent.children[0] !== cur.id) return false;
    cur = parent;
  }
  return true;
}

/** Removes a node and its subtree. Returns the new tree and the parent id. */
export function deleteNode(tree: GameTree, id: string): { tree: GameTree; parentId: string } | null {
  const node = tree.nodes[id];
  if (!node || !node.parentId) return null;
  const nodes = { ...tree.nodes };
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    stack.push(...(nodes[cur]?.children ?? []));
    delete nodes[cur];
  }
  const parent = nodes[node.parentId];
  nodes[node.parentId] = { ...parent, children: parent.children.filter((c) => c !== id) };
  return { tree: { ...tree, nodes }, parentId: node.parentId };
}

/** Moves the variation containing `id` one step up (towards/into the main line). */
export function promoteVariation(tree: GameTree, id: string): GameTree {
  let cur = tree.nodes[id];
  // Find the closest ancestor (or self) that is not a first child.
  while (cur && cur.parentId) {
    const parent = tree.nodes[cur.parentId];
    const idx = parent.children.indexOf(cur.id);
    if (idx > 0) {
      const children = [...parent.children];
      [children[idx - 1], children[idx]] = [children[idx], children[idx - 1]];
      return { ...tree, nodes: { ...tree.nodes, [parent.id]: { ...parent, children } } };
    }
    cur = parent;
  }
  return tree;
}

export function updateNode(tree: GameTree, id: string, patch: Partial<MoveNode>): GameTree {
  const node = tree.nodes[id];
  if (!node) return tree;
  return { ...tree, nodes: { ...tree.nodes, [id]: { ...node, ...patch } } };
}

export function sideToMove(fen: string): "w" | "b" {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

export function fullMoveNumber(fen: string): number {
  return Number.parseInt(fen.split(" ")[5] ?? "1", 10) || 1;
}

/** FEN without the half-move and full-move clocks (used as a position key). */
export function toEpd(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

/** Converts a UCI move list to SAN from a position, stopping at the first illegal move. */
export function uciLineToSan(fen: string, uciMoves: string[]): { san: string; uci: string; fen: string }[] {
  const chess = new Chess(fen);
  const out: { san: string; uci: string; fen: string }[] = [];
  for (const uci of uciMoves) {
    try {
      const m = chess.move(parseUci(uci));
      out.push({ san: m.san, uci, fen: m.after });
    } catch {
      break;
    }
  }
  return out;
}

/** Formats a SAN line with move numbers: "12. Nf3 Nc6 13. Bb5" / "12... Nc6 13. Bb5". */
export function formatSanLine(startFen: string, sans: string[]): string {
  let num = fullMoveNumber(startFen);
  let turn = sideToMove(startFen);
  const parts: string[] = [];
  sans.forEach((san, i) => {
    if (turn === "w") parts.push(`${num}.`);
    else if (i === 0) parts.push(`${num}...`);
    parts.push(san);
    if (turn === "b") num++;
    turn = turn === "w" ? "b" : "w";
  });
  return parts.join(" ");
}

export function normalizeFen(input: string): string {
  const parts = input.trim().split(/\s+/);
  if (parts.length === 4) parts.push("0", "1");
  if (parts.length === 5) parts.push("1");
  return parts.join(" ");
}
