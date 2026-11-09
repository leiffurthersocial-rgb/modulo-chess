import { describe, expect, it } from "vitest";
import {
  centipawnLoss,
  eloFromAcpl,
  harmonicAccuracy,
  qualityElo,
  adaptOpponent,
  combineEstimates,
  eloFromAccuracy,
  estimateGame,
  performanceRating,
} from "../eloEstimate";

describe("eloFromAccuracy", () => {
  it("is monotonic and clamped", () => {
    let prev = -Infinity;
    for (let a = 20; a <= 100; a += 2) {
      const e = eloFromAccuracy(a);
      expect(e).toBeGreaterThanOrEqual(prev);
      prev = e;
    }
    expect(eloFromAccuracy(0)).toBe(250);
    expect(eloFromAccuracy(100)).toBe(3100);
  });
  it("interpolates between anchors", () => {
    expect(eloFromAccuracy(74)).toBeCloseTo(1275);
  });
});

describe("performanceRating", () => {
  it("adds or subtracts 400 for a win or loss", () => {
    expect(performanceRating(1200, 1)).toBe(1600);
    expect(performanceRating(1200, 0.5)).toBe(1200);
    expect(performanceRating(1200, 0)).toBe(800);
  });
});

describe("estimateGame", () => {
  it("relies on the result when no moves were evaluated", () => {
    expect(estimateGame({ userMoves: 0, accuracy: null, quality: null, opponentElo: 1000, score: 1 })).toBe(
      1400,
    );
  });
  it("weights quality more in longer games", () => {
    const short = estimateGame({ userMoves: 5, accuracy: 90, quality: 2100, opponentElo: 800, score: 0 });
    const long = estimateGame({ userMoves: 40, accuracy: 90, quality: 2100, opponentElo: 800, score: 0 });
    expect(long).toBeGreaterThan(short);
  });
});

describe("combineEstimates", () => {
  it("narrows the range with more moves", () => {
    const one = combineEstimates([
      { userMoves: 25, accuracy: 78, quality: 1450, opponentElo: 1400, score: 0.5 },
    ])!;
    const three = combineEstimates([
      { userMoves: 25, accuracy: 78, quality: 1450, opponentElo: 1400, score: 0.5 },
      { userMoves: 30, accuracy: 80, quality: 1550, opponentElo: 1450, score: 1 },
      { userMoves: 28, accuracy: 76, quality: 1350, opponentElo: 1500, score: 0 },
    ])!;
    expect(three.high - three.low).toBeLessThan(one.high - one.low);
    expect(one.elo % 25).toBe(0);
    expect(one.low).toBeLessThan(one.elo);
    expect(combineEstimates([])).toBeNull();
  });
});

describe("adaptOpponent", () => {
  it("waits for a few moves, then moves halfway with a 200 point cap", () => {
    expect(adaptOpponent(1200, 2000, 2)).toBe(1200);
    expect(adaptOpponent(1200, 1500, 6)).toBe(1350);
    expect(adaptOpponent(1200, 2400, 6)).toBe(1400);
    expect(adaptOpponent(1200, 600, 6)).toBe(1000);
  });
});

describe("move-quality models", () => {
  it("centipawn loss is from the mover's view, capped, and maps mates to 1000", () => {
    expect(centipawnLoss("w", { kind: "cp", cp: 800 }, { kind: "cp", cp: 200 })).toBe(600);
    expect(centipawnLoss("b", { kind: "cp", cp: 800 }, { kind: "cp", cp: 200 })).toBe(0);
    expect(
      centipawnLoss("w", { kind: "mate", moves: 2, winner: "w" }, { kind: "mate", moves: 1, winner: "b" }),
    ).toBe(1000);
  });
  it("lower ACPL means higher Elo", () => {
    expect(eloFromAcpl(15)).toBeGreaterThan(eloFromAcpl(60));
    expect(eloFromAcpl(1000)).toBe(250);
  });
  it("harmonic accuracy is dragged down by one bad move", () => {
    const h = harmonicAccuracy([100, 100, 100, 10])!;
    expect(h).toBeLessThan(35);
    expect(harmonicAccuracy([])).toBeNull();
  });
  it("a blunder-prone game rates far below a clean one", () => {
    const clean = qualityElo([98, 95, 97, 99, 96], [5, 12, 8, 3, 10])!;
    const sloppy = qualityElo([98, 40, 97, 20, 96], [5, 450, 8, 700, 10])!;
    expect(clean).toBeGreaterThan(2200);
    expect(sloppy).toBeLessThan(900);
    expect(qualityElo([], [])).toBeNull();
  });
});
