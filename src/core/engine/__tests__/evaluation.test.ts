import { describe, expect, it } from "vitest";
import {
  evalToComparable,
  formatEval,
  formatEvalShort,
  normalizeScore,
  whiteWinPercent,
  winPercentFor,
} from "../evaluation";

describe("normalizeScore", () => {
  it("keeps cp for white to move and flips for black", () => {
    expect(normalizeScore({ kind: "cp", value: 35 }, "w")).toEqual({ kind: "cp", cp: 35 });
    expect(normalizeScore({ kind: "cp", value: 35 }, "b")).toEqual({ kind: "cp", cp: -35 });
  });
  it("never produces -0", () => {
    const ev = normalizeScore({ kind: "cp", value: 0 }, "b");
    expect(ev.kind === "cp" && Object.is(ev.cp, -0)).toBe(false);
  });
  it("attributes mates to the right side", () => {
    expect(normalizeScore({ kind: "mate", value: 3 }, "w")).toEqual({ kind: "mate", moves: 3, winner: "w" });
    expect(normalizeScore({ kind: "mate", value: 3 }, "b")).toEqual({ kind: "mate", moves: 3, winner: "b" });
    expect(normalizeScore({ kind: "mate", value: -2 }, "w")).toEqual({ kind: "mate", moves: 2, winner: "b" });
    expect(normalizeScore({ kind: "mate", value: -2 }, "b")).toEqual({ kind: "mate", moves: 2, winner: "w" });
  });
  it("treats mate 0 as the side to move being mated", () => {
    expect(normalizeScore({ kind: "mate", value: 0 }, "w")).toEqual({ kind: "mate", moves: 0, winner: "b" });
    expect(normalizeScore({ kind: "mate", value: 0 }, "b")).toEqual({ kind: "mate", moves: 0, winner: "w" });
  });
});

describe("win percentage", () => {
  it("is 50 at equality and symmetric", () => {
    expect(whiteWinPercent({ kind: "cp", cp: 0 })).toBeCloseTo(50);
    const up = whiteWinPercent({ kind: "cp", cp: 200 });
    const down = whiteWinPercent({ kind: "cp", cp: -200 });
    expect(up + down).toBeCloseTo(100);
    expect(up).toBeGreaterThan(65);
    expect(up).toBeLessThan(75);
  });
  it("saturates for mates and clamps huge cp", () => {
    expect(whiteWinPercent({ kind: "mate", moves: 5, winner: "w" })).toBe(100);
    expect(whiteWinPercent({ kind: "mate", moves: 5, winner: "b" })).toBe(0);
    expect(whiteWinPercent({ kind: "cp", cp: 5000 })).toBeCloseTo(whiteWinPercent({ kind: "cp", cp: 1000 }));
  });
  it("is computed from either side", () => {
    expect(winPercentFor({ kind: "cp", cp: 100 }, "b")).toBeCloseTo(
      100 - whiteWinPercent({ kind: "cp", cp: 100 }),
    );
  });
});

describe("formatEval", () => {
  it("formats centipawns", () => {
    expect(formatEval({ kind: "cp", cp: 35 })).toBe("+0.35");
    expect(formatEval({ kind: "cp", cp: -120 })).toBe("−1.20");
    expect(formatEval({ kind: "cp", cp: 0 })).toBe("0.00");
  });
  it("formats mates", () => {
    expect(formatEval({ kind: "mate", moves: 3, winner: "w" })).toBe("#3");
    expect(formatEval({ kind: "mate", moves: 2, winner: "b" })).toBe("#−2");
    expect(formatEval({ kind: "mate", moves: 0, winner: "w" })).toBe("1-0");
  });
});

describe("evalToComparable", () => {
  it("orders mates above any cp and prefers faster mates", () => {
    const m1 = evalToComparable({ kind: "mate", moves: 1, winner: "w" });
    const m5 = evalToComparable({ kind: "mate", moves: 5, winner: "w" });
    expect(m1).toBeGreaterThan(m5);
    expect(m5).toBeGreaterThan(evalToComparable({ kind: "cp", cp: 2000 }));
    expect(evalToComparable({ kind: "mate", moves: 1, winner: "b" })).toBeLessThan(-2000);
  });
});

describe("formatEvalShort", () => {
  it("fits the eval bar", () => {
    expect(formatEvalShort({ kind: "cp", cp: 35 })).toBe("0.3");
    expect(formatEvalShort({ kind: "cp", cp: -1234 })).toBe("12");
    expect(formatEvalShort({ kind: "mate", moves: 3, winner: "b" })).toBe("M3");
  });
});
