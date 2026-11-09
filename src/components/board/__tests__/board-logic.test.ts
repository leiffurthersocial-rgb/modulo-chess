import { describe, expect, it } from "vitest";
import { material } from "../material";
import { legalDests, matchPieces, squareToXY, xyToSquare } from "../pieces";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("material", () => {
  it("is balanced at the start", () => {
    expect(material(START)).toEqual({ w: { captured: [], advantage: 0 }, b: { captured: [], advantage: 0 } });
  });
  it("shows only the net imbalance", () => {
    // Black lost a knight, White lost a pawn: White is up a knight for a pawn.
    const m = material("rnbqkb1r/pppppppp/8/8/8/8/1PPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(m.w).toEqual({ captured: ["n"], advantage: 2 });
    expect(m.b).toEqual({ captured: ["p"], advantage: 0 });
  });
});

describe("board geometry", () => {
  it("round-trips squares for both orientations", () => {
    for (const o of ["w", "b"] as const) {
      for (const sq of ["a1", "h8", "e4", "c7"]) {
        const { x, y } = squareToXY(sq, o);
        expect(xyToSquare(x, y, o)).toBe(sq);
      }
    }
    expect(squareToXY("a1", "w")).toEqual({ x: 0, y: 7 });
    expect(squareToXY("a1", "b")).toEqual({ x: 7, y: 0 });
  });
});

describe("matchPieces", () => {
  it("keeps the id of a moved piece so it can animate", () => {
    const before = matchPieces([], START);
    const knight = before.find((p) => p.square === "g1")!;
    const after = matchPieces(before, "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1");
    expect(after.find((p) => p.square === "f3")!.id).toBe(knight.id);
    // Untouched pieces keep their ids too.
    const rook = before.find((p) => p.square === "a1")!;
    expect(after.find((p) => p.square === "a1")!.id).toBe(rook.id);
  });
});

describe("legalDests", () => {
  it("lists destinations and flags promotions", () => {
    const d = legalDests("8/P7/8/8/8/8/8/k6K w - - 0 1");
    expect(d.get("a7")).toEqual([{ to: "a8", promotion: true }]);
    expect(
      legalDests(START)
        .get("g1")
        ?.map((x) => x.to)
        .sort(),
    ).toEqual(["f3", "h3"]);
  });
});
