import { describe, expect, it } from "vitest";
import type { Evaluation } from "../../engine/types";
import { classifyByLoss, classifyMove, gameAccuracy, moveAccuracy, winPercentLoss } from "../classify";

const cp = (v: number): Evaluation => ({ kind: "cp", cp: v });
const mate = (moves: number, winner: "w" | "b"): Evaluation => ({ kind: "mate", moves, winner });

describe("classifyByLoss thresholds", () => {
  it.each([
    [0, "excellent"],
    [1.99, "excellent"],
    [2, "good"],
    [4.99, "good"],
    [5, "inaccuracy"],
    [9.99, "inaccuracy"],
    [10, "mistake"],
    [19.99, "mistake"],
    [20, "blunder"],
    [80, "blunder"],
  ])("loss %s → %s", (loss, expected) => {
    expect(classifyByLoss(loss)).toBe(expected);
  });
});

describe("winPercentLoss", () => {
  it("is measured from the mover's perspective", () => {
    // White to move at +1.00 plays into −1.00: a big loss for White.
    expect(winPercentLoss("w", cp(100), cp(-100))).toBeGreaterThan(15);
    // Same evaluations, but it was Black moving: Black gained, so no loss.
    expect(winPercentLoss("b", cp(100), cp(-100))).toBe(0);
  });
  it("never goes negative", () => {
    expect(winPercentLoss("w", cp(0), cp(300))).toBe(0);
  });
});

describe("classifyMove", () => {
  it("marks the engine's top move as best", () => {
    expect(classifyMove({ mover: "w", before: cp(30), after: cp(25), played: "e2e4", best: "e2e4" }).class).toBe("best");
  });
  it("marks book moves regardless of eval", () => {
    expect(classifyMove({ mover: "w", before: cp(30), after: cp(-30), played: "f2f3", best: "e2e4", isBook: true }).class).toBe("book");
  });
  it("detects a blunder that throws away a winning position", () => {
    const r = classifyMove({ mover: "w", before: cp(500), after: cp(-200), played: "d1h5", best: "e2e4" });
    expect(r.class).toBe("blunder");
    expect(r.accuracy).toBeLessThan(30);
  });
  it("detects a missed mate as a blunder", () => {
    expect(classifyMove({ mover: "w", before: mate(2, "w"), after: cp(0), played: "a2a3", best: "h5f7" }).class).toBe("blunder");
  });
  it("walking into a mate is a blunder for Black", () => {
    expect(classifyMove({ mover: "b", before: cp(0), after: mate(1, "w"), played: "g7g5", best: "e7e5" }).class).toBe("blunder");
  });
  it("small slips in a lost position are not punished", () => {
    // Already −8: losing another pawn barely changes win probability.
    expect(classifyMove({ mover: "w", before: cp(-800), after: cp(-900), played: "a2a3", best: "b2b3" }).class).toBe("excellent");
  });
  it("classifies a medium loss as an inaccuracy or mistake", () => {
    expect(classifyMove({ mover: "w", before: cp(50), after: cp(-20), played: "a2a3", best: "e2e4" }).class).toBe("inaccuracy");
    expect(classifyMove({ mover: "w", before: cp(50), after: cp(-120), played: "a2a3", best: "e2e4" }).class).toBe("mistake");
  });
});

describe("accuracy", () => {
  it("is ~100 for zero loss and decreases monotonically", () => {
    expect(moveAccuracy(0)).toBe(100);
    expect(moveAccuracy(5)).toBeLessThan(moveAccuracy(1));
    expect(moveAccuracy(100)).toBe(0);
  });
  it("averages a game", () => {
    expect(gameAccuracy([])).toBeNull();
    expect(gameAccuracy([100, 50])).toBe(75);
  });
});
