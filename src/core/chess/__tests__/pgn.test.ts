import { describe, expect, it } from "vitest";
import { PgnError, checkFen, parseGame, parsePgn, serializePgn, splitGames } from "../pgn";
import {
  addMove,
  createTree,
  deleteNode,
  isOnMainline,
  mainline,
  promoteVariation,
  uciLineToSan,
  formatSanLine,
} from "../tree";

const sans = (tree: ReturnType<typeof createTree>) =>
  mainline(tree)
    .slice(1)
    .map((n) => n.san);

describe("parseGame", () => {
  it("parses headers, moves, comments, NAGs and result", () => {
    const g = parseGame(`[Event "Test"]
[White "A"]
[Black "B"]
[Result "1-0"]

{Opening comment} 1. e4 e5! 2. Nf3 $1 {develops} Nc6 3. Bb5 a6?! 1-0`);
    expect(g.headers.Event).toBe("Test");
    expect(g.result).toBe("1-0");
    expect(sans(g.tree)).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"]);
    const line = mainline(g.tree);
    expect(line[0].comment).toBe("Opening comment");
    expect(line[2].nags).toEqual([1]);
    expect(line[3].nags).toEqual([1]);
    expect(line[3].comment).toBe("develops");
    expect(line[6].nags).toEqual([6]);
  });

  it("parses nested variations", () => {
    const g = parseGame("1. e4 (1. d4 d5 (1... Nf6 2. c4) 2. c4) 1... e5 (1... c5 2. Nf3) 2. Nf3 *");
    expect(sans(g.tree)).toEqual(["e4", "e5", "Nf3"]);
    const root = g.tree.nodes[g.tree.rootId];
    expect(root.children).toHaveLength(2);
    const d4 = g.tree.nodes[root.children[1]];
    expect(d4.san).toBe("d4");
    expect(d4.children.map((c) => g.tree.nodes[c].san)).toEqual(["d5", "Nf6"]);
    const e4 = g.tree.nodes[root.children[0]];
    expect(e4.children.map((c) => g.tree.nodes[c].san)).toEqual(["e5", "c5"]);
  });

  it("supports FEN setups starting with black to move", () => {
    const g = parseGame(`[SetUp "1"]
[FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"]

1... e5 2. Nf3 *`);
    expect(sans(g.tree)).toEqual(["e5", "Nf3"]);
  });

  it("accepts castling with zeros, line comments and move numbers glued to moves", () => {
    const g = parseGame("1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.0-0 ; castles\nNf6 *");
    expect(sans(g.tree)).toEqual(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O", "Nf6"]);
    expect(mainline(g.tree)[7].comment).toBe("castles");
  });

  it("reports illegal moves with their move number", () => {
    expect(() => parseGame("1. e4 e5 2. Ke3 *")).toThrow(PgnError);
    expect(() => parseGame("1. e4 e5 2. Ke3 *")).toThrow(/2\./);
  });

  it("rejects unbalanced variations", () => {
    expect(() => parseGame("1. e4 (1. d4 *")).toThrow(/Unclosed/);
    expect(() => parseGame("1. e4 ) *")).toThrow(/Unbalanced/);
  });
});

describe("splitGames / parsePgn", () => {
  it("splits multi-game databases", () => {
    const db = `[Event "1"]\n\n1. e4 *\n\n[Event "2"]\n\n1. d4 *\n`;
    expect(splitGames(db)).toHaveLength(2);
    const games = parsePgn(db);
    expect(games.map((g) => g.headers.Event)).toEqual(["1", "2"]);
  });
  it("throws on empty input", () => {
    expect(() => parsePgn("   ")).toThrow(PgnError);
  });
});

describe("serializePgn", () => {
  it("round-trips variations, comments and NAGs", () => {
    const src =
      "{Start} 1. e4 $1 { best by test } (1. d4 d5 (1... Nf6 2. c4) 2. c4) 1... e5 (1... c5 2. Nf3) 2. Nf3 Nc6 *";
    const g = parseGame(src);
    const out = serializePgn(g.tree, { headers: { Event: "RT" } });
    expect(out).toContain('[Event "RT"]');
    expect(out.replace(/\s+/g, " ")).toContain(
      "1. e4 $1 { best by test } (1. d4 d5 (1... Nf6 2. c4) 2. c4) 1... e5 (1... c5 2. Nf3) 2. Nf3 Nc6 *",
    );
    const again = parseGame(out);
    expect(serializePgn(again.tree, { headers: { Event: "RT" } })).toBe(out);
  });

  it("writes FEN/SetUp headers for custom positions", () => {
    const fen = "8/8/8/8/8/8/4K3/7k w - - 0 1";
    const t = createTree(fen);
    const out = serializePgn(addMove(t, t.rootId, "Kf3")!.tree);
    expect(out).toContain('[SetUp "1"]');
    expect(out).toContain(`[FEN "${fen}"]`);
    expect(out).toContain("1. Kf3 *");
  });
});

describe("tree operations", () => {
  it("reuses existing children instead of duplicating", () => {
    const t0 = createTree();
    const a = addMove(t0, t0.rootId, { from: "e2", to: "e4" })!;
    const b = addMove(a.tree, a.tree.rootId, "e4")!;
    expect(b.created).toBe(false);
    expect(b.nodeId).toBe(a.nodeId);
  });

  it("returns null for illegal moves", () => {
    const t0 = createTree();
    expect(addMove(t0, t0.rootId, { from: "e2", to: "e5" })).toBeNull();
  });

  it("promotes and deletes variations", () => {
    let t = createTree();
    const e4 = addMove(t, t.rootId, "e4")!;
    t = e4.tree;
    const d4 = addMove(t, t.rootId, "d4")!;
    t = d4.tree;
    expect(isOnMainline(t, d4.nodeId)).toBe(false);
    t = promoteVariation(t, d4.nodeId);
    expect(isOnMainline(t, d4.nodeId)).toBe(true);
    const del = deleteNode(t, e4.nodeId)!;
    expect(del.tree.nodes[e4.nodeId]).toBeUndefined();
    expect(del.tree.nodes[t.rootId].children).toEqual([d4.nodeId]);
  });

  it("converts UCI pvs to SAN and formats with move numbers", () => {
    const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const line = uciLineToSan(start, ["e2e4", "e7e5", "g1f3", "zzzz", "b8c6"]);
    expect(line.map((m) => m.san)).toEqual(["e4", "e5", "Nf3"]);
    expect(formatSanLine(start, ["e4", "e5", "Nf3"])).toBe("1. e4 e5 2. Nf3");
    const black = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    expect(formatSanLine(black, ["e5", "Nf3"])).toBe("1... e5 2. Nf3");
  });
});

describe("checkFen", () => {
  it("accepts FEN and EPD", () => {
    expect(checkFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -")).toEqual({
      ok: true,
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    });
  });
  it("rejects garbage", () => {
    expect(checkFen("not a fen").ok).toBe(false);
    expect(checkFen("8/8/8/8/8/8/8/8 w - - 0 1").ok).toBe(false); // no kings
  });
});
