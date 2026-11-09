import { describe, expect, it } from "vitest";
import { buildGo, buildPosition, parseBestMove, parseInfo, parseOption } from "../uci";

describe("parseInfo", () => {
  it("parses a full multipv info line", () => {
    const info = parseInfo(
      "info depth 20 seldepth 28 multipv 2 score cp -35 nodes 1234567 nps 890000 hashfull 412 tbhits 0 time 1387 pv e7e5 g1f3 b8c6",
    );
    expect(info).toEqual({
      depth: 20,
      seldepth: 28,
      multipv: 2,
      score: { kind: "cp", value: -35 },
      nodes: 1234567,
      nps: 890000,
      hashfull: 412,
      tbhits: 0,
      time: 1387,
      pv: ["e7e5", "g1f3", "b8c6"],
    });
  });

  it("parses mate scores including negative and zero", () => {
    expect(parseInfo("info depth 7 score mate 3 pv a1a8")?.score).toEqual({ kind: "mate", value: 3 });
    expect(parseInfo("info depth 7 score mate -2 pv h7h6")?.score).toEqual({ kind: "mate", value: -2 });
    expect(parseInfo("info depth 0 score mate 0")?.score).toEqual({ kind: "mate", value: 0 });
  });

  it("parses bounds and wdl", () => {
    const info = parseInfo("info depth 18 score cp 40 lowerbound wdl 120 860 20 nodes 10 pv e2e4");
    expect(info?.bound).toBe("lower");
    expect(info?.wdl).toEqual([120, 860, 20]);
    expect(info?.pv).toEqual(["e2e4"]);
    expect(parseInfo("info depth 18 score cp 40 upperbound pv e2e4")?.bound).toBe("upper");
  });

  it("parses promotions in the pv", () => {
    expect(parseInfo("info depth 5 score cp 900 pv a7a8q b8a8")?.pv).toEqual(["a7a8q", "b8a8"]);
  });

  it("handles currmove lines and info strings", () => {
    expect(parseInfo("info depth 12 currmove e2e4 currmovenumber 1")).toEqual({
      depth: 12,
      currmove: "e2e4",
      currmovenumber: 1,
    });
    expect(parseInfo("info string NNUE evaluation using nn-61e7af4bb97d.nnue")?.string).toBe(
      "NNUE evaluation using nn-61e7af4bb97d.nnue",
    );
  });

  it("returns null for non-info lines", () => {
    expect(parseInfo("bestmove e2e4")).toBeNull();
    expect(parseInfo("readyok")).toBeNull();
  });
});

describe("parseBestMove", () => {
  it("parses bestmove with and without ponder", () => {
    expect(parseBestMove("bestmove e2e4 ponder e7e5")).toEqual({ bestmove: "e2e4", ponder: "e7e5" });
    expect(parseBestMove("bestmove g7g8n")).toEqual({ bestmove: "g7g8n" });
  });
  it("maps (none) to null", () => {
    expect(parseBestMove("bestmove (none)")).toEqual({ bestmove: null });
  });
});

describe("parseOption", () => {
  it("parses spin options", () => {
    expect(parseOption("option name Skill Level type spin default 20 min 0 max 20")).toEqual({
      name: "Skill Level",
      type: "spin",
      default: "20",
      min: 0,
      max: 20,
    });
  });
  it("parses check, button and string options", () => {
    expect(parseOption("option name UCI_LimitStrength type check default false")).toMatchObject({
      type: "check",
      default: "false",
    });
    expect(parseOption("option name Clear Hash type button")).toEqual({ name: "Clear Hash", type: "button" });
    expect(parseOption("option name EvalFile type string default nn-61e7af4bb97d.nnue")?.default).toBe(
      "nn-61e7af4bb97d.nnue",
    );
  });
});

describe("command builders", () => {
  it("builds go commands", () => {
    expect(buildGo({})).toBe("go infinite");
    expect(buildGo({ depth: 18 })).toBe("go depth 18");
    expect(buildGo({ depth: 14, movetime: 2000 })).toBe("go depth 14 movetime 2000");
    // searchmoves must come last — Stockfish treats all following tokens as moves.
    expect(buildGo({ depth: 10, searchmoves: ["e2e4", "d2d4"] })).toBe("go depth 10 searchmoves e2e4 d2d4");
    expect(buildGo({ searchmoves: ["e2e4"] })).toBe("go infinite searchmoves e2e4");
  });
  it("builds position commands", () => {
    expect(buildPosition("8/8/8/8/8/8/8/K6k w - - 0 1")).toBe("position fen 8/8/8/8/8/8/8/K6k w - - 0 1");
    expect(buildPosition("startfen", ["e2e4", "e7e5"])).toBe("position fen startfen moves e2e4 e7e5");
  });
});
