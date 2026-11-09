import { describe, expect, it } from "vitest";
import { addMove, createTree, mainline, type GameTree } from "../../chess/tree";
import type { Evaluation } from "../../engine/types";
import { buildReport, type ReportPositionEval } from "../report";

const cp = (v: number): Evaluation => ({ kind: "cp", cp: v });
const pe = (best: string, lines: [string, number][], whiteCp = lines[0]?.[1] ?? 0): ReportPositionEval => ({
  eval: cp(whiteCp),
  best,
  pv: [best],
  lines: lines.map(([uci, v]) => ({ uci, eval: cp(v) })),
});

function line(sans: string[], fen?: string): GameTree {
  let t = createTree(fen);
  let cur = t.rootId;
  for (const s of sans) {
    const r = addMove(t, cur, s)!;
    t = r.tree;
    cur = r.nodeId;
  }
  return t;
}

describe("buildReport", () => {
  it("classifies best, blunder and computes a summary once complete", () => {
    const t = line(["e4", "e5", "Qh5", "Ke7"]);
    const l = mainline(t);
    const evals = [
      pe("e2e4", [
        ["e2e4", 30],
        ["d2d4", 25],
      ]),
      pe("e7e5", [
        ["e7e5", 30],
        ["c7c5", 35],
      ]),
      pe("g1f3", [
        ["g1f3", 30],
        ["b1c3", 25],
      ]),
      pe("b8c6", [
        ["b8c6", -20],
        ["g7g6", 0],
      ]), // after Qh5, black is fine
      pe("h5e5", [["h5e5", 900]]), // after Ke7?? white wins
    ];
    const r = buildReport(l, evals, [true, false, false, false, false]);
    expect(r.moves.map((m) => m.class)).toEqual(["best", "best", "good", "blunder"]);
    expect(r.moves[3].bestSan).toBe("Nc6");
    expect(r.summary!.b.counts.blunder).toBe(1);
    expect(r.summary!.w.accuracy!).toBeGreaterThan(r.summary!.b.accuracy!);
    expect(r.summary!.b.rating!).toBeLessThan(r.summary!.w.rating!);
  });

  it("marks book moves while the line stays in book", () => {
    const t = line(["e4", "e5"]);
    const evals = [pe("e2e4", [["e2e4", 30]]), pe("e7e5", [["e7e5", 30]]), pe("g1f3", [["g1f3", 30]])];
    const r = buildReport(mainline(t), evals, [true, true, true]);
    expect(r.moves.map((m) => m.class)).toEqual(["book", "book"]);
  });

  it("detects a brilliant sacrifice (Bxf7+ that the engine likes)", () => {
    const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
    const t = line(["Bxf7+"], fen);
    const evals = [
      pe("c4f7", [
        ["c4f7", 60],
        ["e1g1", 20],
      ]),
      pe("e8f7", [["e8f7", 60]]),
    ];
    const r = buildReport(mainline(t), evals, [false, false]);
    expect(r.moves[0].class).toBe("brilliant");
  });

  it("detects a great (only) move", () => {
    const t = line(["e4"]);
    const evals = [
      pe("e2e4", [
        ["e2e4", 50],
        ["d2d4", -300],
      ]),
      pe("e7e5", [["e7e5", 50]]),
    ];
    expect(buildReport(mainline(t), evals, [false, false]).moves[0].class).toBe("great");
  });

  it("returns partial moves and no summary while evaluations are pending", () => {
    const t = line(["e4", "e5"]);
    const r = buildReport(
      mainline(t),
      [pe("e2e4", [["e2e4", 30]]), pe("e7e5", [["e7e5", 30]]), undefined],
      [],
    );
    expect(r.moves).toHaveLength(1);
    expect(r.summary).toBeNull();
  });
});
