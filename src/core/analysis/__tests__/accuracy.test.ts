import { describe, expect, it } from "vitest";
import { accuracyFromWinPercents, gameAccuracy } from "../accuracy";

describe("accuracyFromWinPercents", () => {
  it("is 100 when the move keeps or improves the position", () => {
    expect(accuracyFromWinPercents(50, 50)).toBe(100);
    expect(accuracyFromWinPercents(50, 60)).toBe(100);
  });
  it("drops steeply with win% loss", () => {
    expect(accuracyFromWinPercents(60, 55)).toBeGreaterThan(80);
    expect(accuracyFromWinPercents(80, 30)).toBeLessThan(15);
  });
});

describe("gameAccuracy", () => {
  it("rates a flawless game ~100 for both sides", () => {
    const g = gameAccuracy(Array(41).fill(52));
    expect(g.w).toBeCloseTo(100);
    expect(g.b).toBeCloseTo(100);
  });
  it("punishes the side that blundered, not the other", () => {
    const wp = [...Array(20).fill(52), 52, 15, ...Array(19).fill(15)]; // White blunders on move 21
    const g = gameAccuracy(wp);
    expect(g.w!).toBeLessThan(85);
    expect(g.b!).toBeGreaterThan(95);
  });
  it("one blunder costs more than spreading the same loss over several moves", () => {
    // White moves are the transitions at even indices (0→1, 2→3, …).
    const oneBig = gameAccuracy([50, 50, 50, 20, 20, 20, 20, 20, 20, 20, 20, 20]).w!;
    const small = gameAccuracy([50, 50, 50, 44, 44, 38, 38, 32, 32, 26, 26, 20]).w!;
    expect(oneBig).toBeLessThan(small);
  });
  it("handles Black moving first and empty input", () => {
    expect(gameAccuracy([50])).toEqual({ w: null, b: null });
    const g = gameAccuracy([50, 80, 80], "b"); // black's move lowers white's win%... here raises it
    expect(g.b!).toBeLessThan(50);
  });
});
