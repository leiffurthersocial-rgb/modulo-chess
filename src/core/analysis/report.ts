import { Chess } from "chess.js";
import { sideToMove, uciLineToSan, type MoveNode } from "../chess/tree";
import { winPercentFor, whiteWinPercent } from "../engine/evaluation";
import type { Evaluation } from "../engine/types";
import { gameAccuracy } from "./accuracy";
import { classifyReviewMove, MOVE_CLASSES, type MoveClass } from "./classify";
import { centipawnLoss, qualityElo } from "./eloEstimate";
import { isRecapture, isSacrifice } from "./sacrifice";

export interface ReportPositionEval {
  eval: Evaluation;
  best: string | null;
  pv: string[];
  lines: { uci: string; eval: Evaluation }[];
}

export interface ReportMove {
  nodeId: string;
  class: MoveClass;
  winLoss: number;
  accuracy: number;
  mover: "w" | "b";
  cpLoss: number;
  playedEval: Evaluation;
  bestUci: string | null;
  bestSan?: string;
  bestLine: string[];
}

export interface ReportSide {
  accuracy: number | null;
  rating: number | null;
  acpl: number | null;
  counts: Record<MoveClass, number>;
}

export interface GameReport {
  moves: ReportMove[];
  summary: { w: ReportSide; b: ReportSide } | null;
}

const emptyCounts = () => Object.fromEntries(MOVE_CLASSES.map((c) => [c, 0])) as Record<MoveClass, number>;

function positionFacts(fen: string): { legal: number; inCheck: boolean } {
  try {
    const c = new Chess(fen);
    return { legal: c.moves().length, inCheck: c.inCheck() };
  } catch {
    return { legal: 0, inCheck: false };
  }
}

/**
 * Classifies every main-line move whose surrounding positions are evaluated.
 * `evals[i]` is the evaluation of `line[i]` (undefined while still pending);
 * `book[i]` says whether line[i] is a known opening position.
 * The summary is only produced once every position is evaluated.
 */
export function buildReport(
  line: MoveNode[],
  evals: (ReportPositionEval | undefined)[],
  book: boolean[],
): GameReport {
  const moves: ReportMove[] = [];
  let inBook = true;
  let prevMoveLoss = 0; // win% the previous mover gave away
  for (let i = 1; i < line.length; i++) {
    const node = line[i];
    const parent = line[i - 1];
    inBook = inBook && Boolean(book[i]);
    const before = evals[i - 1];
    const after = evals[i];
    if (!before || !after || !node.uci) {
      prevMoveLoss = 0;
      continue;
    }
    const mover = sideToMove(parent.fen);
    const bestEval = before.lines[0]?.eval ?? before.eval;
    // Prefer the played move's score from the same MultiPV search (consistent);
    // otherwise use the evaluation of the resulting position.
    const sameSearch = before.lines.find((l) => l.uci === node.uci);
    const playedEval = sameSearch?.eval ?? after.eval;
    const bestWin = winPercentFor(bestEval, mover);
    const playedWin = Math.min(winPercentFor(playedEval, mover), sameSearch ? 100 : bestWin);
    const second = before.lines.find((l) => l.uci !== before.best);

    const prevNode = i >= 2 ? line[i - 1] : undefined;
    const facts = positionFacts(parent.fen);
    const c = classifyReviewMove({
      played: node.uci,
      best: before.best,
      bestWin,
      playedWin,
      // Delivering mate is simply "best", never "great".
      secondWin: second && !node.san?.includes("#") ? winPercentFor(second.eval, mover) : null,
      legalMoves: facts.legal,
      inCheck: facts.inCheck,
      bestIsMate: bestEval.kind === "mate" && bestEval.winner === mover && bestEval.moves > 0,
      isBook: inBook,
      sacrifice: isSacrifice(parent.fen, node.uci),
      recapture: isRecapture(prevNode?.uci, Boolean(prevNode?.captured), node.uci),
      opponentErrorLoss: prevMoveLoss,
    });
    const bestLine = before.pv.length
      ? uciLineToSan(parent.fen, before.pv.slice(0, 10)).map((m) => m.san)
      : [];
    moves.push({
      nodeId: node.id,
      class: c.class,
      winLoss: c.winLoss,
      accuracy: c.accuracy,
      mover,
      cpLoss: centipawnLoss(mover, bestEval, playedEval),
      playedEval,
      bestUci: before.best,
      bestSan: bestLine[0],
      bestLine,
    });
    prevMoveLoss = c.winLoss;
  }

  if (line.length < 2 || evals.slice(0, line.length).some((e) => !e)) return { moves, summary: null };

  const firstMover = sideToMove(line[0].fen);
  const acc = gameAccuracy(
    evals.slice(0, line.length).map((e) => whiteWinPercent(e!.eval)),
    firstMover,
  );
  const side = (color: "w" | "b"): ReportSide => {
    const mine = moves.filter((m) => m.mover === color);
    const counts = emptyCounts();
    mine.forEach((m) => counts[m.class]++);
    const scored = mine.filter((m) => m.class !== "book" && m.class !== "forced");
    const acpl = scored.length ? scored.reduce((a, m) => a + m.cpLoss, 0) / scored.length : null;
    const rating = qualityElo(
      scored.map((m) => m.accuracy),
      scored.map((m) => m.cpLoss),
    );
    return {
      accuracy: acc[color],
      acpl,
      rating: rating === null ? null : Math.round(rating / 25) * 25,
      counts,
    };
  };
  return { moves, summary: { w: side("w"), b: side("b") } };
}
