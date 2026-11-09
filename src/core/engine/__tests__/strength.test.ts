import { describe, expect, it } from "vitest";
import {
  candidatesFromLines,
  pickWeakMove,
  seededRng,
  strengthPlan,
  MIN_ELO,
  NATIVE_MIN_ELO,
} from "../strength";
import type { EngineLine } from "../types";

const line = (uci: string, cp: number, k: number): EngineLine => ({
  multipv: k,
  depth: 8,
  eval: { kind: "cp", cp },
  score: { kind: "cp", value: cp },
  pv: [uci],
});

describe("strengthPlan", () => {
  it("uses Stockfish's native UCI_Elo at and above 1320", () => {
    const p = strengthPlan(1800);
    expect(p.kind).toBe("native");
    expect(p.options).toMatchObject({ UCI_LimitStrength: true, UCI_Elo: 1800 });
    expect(strengthPlan(NATIVE_MIN_ELO).kind).toBe("native");
  });
  it("weakens below 1320, more strongly at lower Elo", () => {
    const a = strengthPlan(1200);
    const b = strengthPlan(400);
    if (a.kind !== "weakened" || b.kind !== "weakened") throw new Error("expected weakened");
    expect(b.depth).toBeLessThan(a.depth);
    expect(b.temperature).toBeGreaterThan(a.temperature);
    expect(b.randomMoveChance).toBeGreaterThan(a.randomMoveChance);
    expect(a.options).toMatchObject({ UCI_LimitStrength: false });
  });
  it("clamps out-of-range input", () => {
    expect(strengthPlan(0).elo).toBe(MIN_ELO);
    expect(strengthPlan(9999).elo).toBe(3190);
  });
});

describe("pickWeakMove", () => {
  const lines = [line("e2e4", 30, 1), line("d2d4", 20, 2), line("a2a3", -40, 3), line("f2f3", -400, 4)];
  const legal = ["e2e4", "d2d4", "a2a3", "f2f3", "h2h4"];

  function histogram(elo: number, n = 3000) {
    const plan = strengthPlan(elo);
    if (plan.kind !== "weakened") throw new Error("expected weakened");
    const rng = seededRng(42);
    const counts: Record<string, number> = {};
    const cands = candidatesFromLines(lines, "w");
    for (let i = 0; i < n; i++) {
      const m = pickWeakMove(cands, legal, plan, rng)!;
      counts[m] = (counts[m] ?? 0) + 1;
    }
    return counts;
  }

  it("near 1300 plays mostly the top moves and rarely blunders", () => {
    const h = histogram(1300);
    expect((h.e2e4 ?? 0) + (h.d2d4 ?? 0)).toBeGreaterThan(2700);
    expect(h.f2f3 ?? 0).toBeLessThan(30);
  });

  it("beginners spread their choices and sometimes blunder", () => {
    const h = histogram(300);
    expect(h.f2f3 ?? 0).toBeGreaterThan(50);
    expect(h.h2h4 ?? 0).toBeGreaterThan(50); // random-move oversights
    expect(h.e2e4).toBeLessThan(2000);
  });

  it("returns null without legal moves and is deterministic with a seed", () => {
    const plan = strengthPlan(500);
    if (plan.kind !== "weakened") throw new Error();
    expect(pickWeakMove([], [], plan)).toBeNull();
    const c = candidatesFromLines(lines, "w");
    expect(pickWeakMove(c, legal, plan, seededRng(7))).toBe(pickWeakMove(c, legal, plan, seededRng(7)));
  });

  it("reads candidates from the mover's point of view", () => {
    const c = candidatesFromLines([line("e7e5", -50, 1), line("a7a6", 100, 2)], "b");
    expect(c[0].winPct).toBeGreaterThan(c[1].winPct);
  });
});
