import { classifyMove, gameAccuracy, type MoveClass } from "@/core/analysis/classify";
import { mainline, sideToMove, uciLineToSan } from "@/core/chess/tree";
import type { SearchHandle } from "@/core/engine/EngineService";
import { getEngine } from "@/core/engine/pool";
import type { Evaluation } from "@/core/engine/types";
import { isBookPosition } from "@/modules/openings/lookup";
import { autoThreads } from "@/modules/engine/EngineController";
import { maxThreads } from "@/core/engine/assets";
import { positionStatus, useGame } from "@/stores/game";
import { useOpeningDb } from "@/stores/openings";
import { useReview, type ClassCounts, type MoveReview, type PositionEval } from "@/stores/review";
import { useSettings } from "@/stores/settings";

let token = 0;
let currentHandle: SearchHandle | null = null;

const emptyCounts = (): ClassCounts => ({
  book: 0,
  best: 0,
  excellent: 0,
  good: 0,
  inaccuracy: 0,
  mistake: 0,
  blunder: 0,
});

/** Max time per position, so one tactical position can't stall the review. */
const MOVETIME_CAP_MS = 3000;

/**
 * Full-game analysis: evaluates every mainline position at a fixed depth, then
 * classifies each move by the win-percentage it gave away.
 */
export async function runReview(): Promise<void> {
  const my = ++token;
  const { tree, gameKey } = useGame.getState();
  const line = mainline(tree);
  const depth = useSettings.getState().reviewDepth;
  const review = useReview.getState();
  if (line.length < 2) {
    review.patch({ status: "error", error: "There are no moves to review yet." });
    return;
  }
  review.patch({
    status: "running",
    gameKey,
    done: 0,
    total: line.length,
    depth,
    error: null,
    evals: {},
    moves: {},
    summary: null,
  });

  try {
    const { service } = await getEngine("analysis", useSettings.getState().engine.flavor);
    // Stop live analysis before queueing review searches.
    service.stop();
    const { threads, hashMb } = useSettings.getState().engine;
    const hardMax = Math.min(service.option("Threads")?.max ?? 1, maxThreads());
    await service.setOptions({
      Threads: threads > 0 ? Math.min(threads, hardMax) : autoThreads(hardMax),
      Hash: hashMb,
    });
    await service.newGame();
    const db = await useOpeningDb.getState().load();

    const evals: Record<string, PositionEval> = {};
    const moves: Record<string, MoveReview> = {};
    let inBook = true;

    for (let i = 0; i < line.length; i++) {
      if (my !== token || useGame.getState().gameKey !== gameKey) return;
      const node = line[i];
      const status = positionStatus(
        node.fen,
        line.slice(0, i).map((n) => n.fen),
      );
      let pe: PositionEval;
      if (status.kind === "checkmate") {
        pe = {
          eval: { kind: "mate", moves: 0, winner: status.turn === "w" ? "b" : "w" },
          best: null,
          pv: [],
          depth: 0,
        };
      } else if (status.kind !== "playing") {
        pe = { eval: { kind: "cp", cp: 0 }, best: null, pv: [], depth: 0 };
      } else {
        currentHandle = service.search(
          { fen: node.fen, depth, movetime: MOVETIME_CAP_MS, multiPv: 1 },
          { supersede: false },
        );
        const r = await currentHandle.result;
        currentHandle = null;
        if (my !== token) return;
        if (r.cancelled) {
          useReview.getState().patch({ status: "cancelled" });
          return;
        }
        const top = r.lines[0];
        const ev: Evaluation = top?.eval ?? { kind: "cp", cp: 0 };
        const best = r.bestMove;
        pe = {
          eval: ev,
          best,
          bestSan: best ? uciLineToSan(node.fen, [best])[0]?.san : undefined,
          pv: top?.pv ?? [],
          depth: r.stats.depth,
        };
      }
      evals[node.id] = pe;

      if (i > 0) {
        const prev = line[i - 1];
        const before = evals[prev.id];
        inBook = inBook && db !== null && isBookPosition(db, node.fen);
        const c = classifyMove({
          mover: sideToMove(prev.fen),
          before: before.eval,
          after: pe.eval,
          played: node.uci!,
          best: before.best,
          isBook: inBook,
        });
        moves[node.id] = {
          class: c.class,
          winLoss: c.winLoss,
          accuracy: c.accuracy,
          mover: sideToMove(prev.fen),
          bestSan: before.bestSan,
          bestUci: before.best,
        };
      }
      useReview.getState().patch({ evals: { ...evals }, moves: { ...moves }, done: i + 1 });
    }

    const summary = {
      w: { accuracy: null as number | null, counts: emptyCounts() },
      b: { accuracy: null as number | null, counts: emptyCounts() },
    };
    const acc: Record<"w" | "b", number[]> = { w: [], b: [] };
    for (const m of Object.values(moves)) {
      summary[m.mover].counts[m.class as MoveClass]++;
      if (m.class !== "book") acc[m.mover].push(m.accuracy);
    }
    summary.w.accuracy = gameAccuracy(acc.w);
    summary.b.accuracy = gameAccuracy(acc.b);
    useReview.getState().patch({ status: "done", summary });
  } catch (e) {
    if (my !== token) return;
    useReview.getState().patch({
      status: "error",
      error: e instanceof Error ? e.message : "Analysis failed",
    });
  }
}

export function cancelReview(): void {
  token++;
  currentHandle?.cancel();
  currentHandle = null;
  if (useReview.getState().status === "running") useReview.getState().patch({ status: "cancelled" });
}
