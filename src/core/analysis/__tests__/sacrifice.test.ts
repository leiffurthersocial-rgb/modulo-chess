import { describe, expect, it } from "vitest";
import { isRecapture, isSacrifice, sacrificedMaterial } from "../sacrifice";

describe("sacrifice detection", () => {
  // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 — White to move.
  const twoKnights = "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";

  it("flags a bishop sacrifice on f7 (Bxf7+)", () => {
    // Bxf7+ wins a pawn but the bishop (3) can be taken by the king: net 2.
    expect(sacrificedMaterial(twoKnights, "c4f7")).toBe(2);
    expect(isSacrifice(twoKnights, "c4f7")).toBe(true);
  });

  it("does not flag quiet developing moves", () => {
    expect(isSacrifice(twoKnights, "e1g1")).toBe(false);
    expect(isSacrifice(twoKnights, "d2d3")).toBe(false);
  });

  it("does not flag an attacking move that hangs nothing", () => {
    // Ng5 attacks f7, and nothing black attacks g5 (the f6 knight blocks the queen).
    expect(isSacrifice(twoKnights, "f3g5")).toBe(false);
  });

  it("flags leaving the queen en prise", () => {
    // White queen moves to a square attacked by a pawn.
    const fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    expect(sacrificedMaterial(fen, "d1h5")).toBe(0); // h5 is safe
    expect(sacrificedMaterial(fen, "d1g4")).toBe(0); // g4 attacked by nothing yet
    const fen2 = "rnbqkbnr/ppp2ppp/8/3pp3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3";
    expect(sacrificedMaterial(fen2, "d1g4")).toBe(9); // Bc8 takes the undefended queen
  });

  it("ignores material that was already hanging before the move", () => {
    const fen = "rnbqkbnr/ppp2ppp/8/1B1pp3/4P3/8/PPPP1PPP/RNBQK1NR w KQkq - 0 3"; // Bb5 is safe
    expect(sacrificedMaterial(fen, "g1f3")).toBe(0);
    const hanging = "rnbqkbnr/pp3ppp/2p5/1B1pp3/4P3/8/PPPP1PPP/RNBQK1NR w KQkq - 0 4"; // c6 pawn hits b5
    expect(sacrificedMaterial(hanging, "g1f3")).toBe(0); // the bishop was already hanging
  });

  it("returns 0 for illegal moves and detects recaptures", () => {
    expect(sacrificedMaterial(twoKnights, "a1a8")).toBe(0);
    expect(isRecapture("f3e5", true, "c6e5")).toBe(true);
    expect(isRecapture("f3e5", false, "c6e5")).toBe(false);
  });
});
