import { Chess } from "chess.js";
import { buildReport } from "@/core/analysis/report";
import { mainline, toUci, uciLineToSan } from "@/core/chess/tree";
import { maxThreads } from "@/core/engine/assets";
import type { SearchHandle } from "@/core/engine/EngineService";
import { getEngine } from "@/core/engine/pool";
import { isBookPosition } from "@/modules/openings/lookup";
import { positionStatus, useGame } from "@/stores/game";
import { useOpeningDb } from "@/stores/openings";
import { useReview, type MoveReview, type PositionEval } from "@/stores/review";
import { useSettings } from "@/stores/settings";

/** Max time per position, so one tactical position can't stall the review. */
const MOVETIME_CAP_MS = 4000;
/**
 * Each position gets one MultiPV-1 search. Only when the player then found the best
 * move do we need the second-best score (for "great" moves): that is a cheaper
 * probe at reduced depth over every other legal move (UCI `searchmoves`).
 */
const PROBE_DEPTH_REDUCTION = 4;
const HASH_MB_PER_WORKER = 32;

let token = 0;
const active = new Set<SearchHandle>();

/** Evaluations survive between runs: re-running or reviewing a related game is instant. */
const cache = new Map<string, PositionEval>();
const cacheKey = (fen: string, depth: number) => `${fen.split(" ").slice(0, 4).join(" ")}|${depth}`;

/**
 * Parallel single-threaded workers scale better than one multi-threaded search for
 * many short searches. Leave one core for the UI.
 */
export function reviewWorkerCount(): number {
  return Math.max(1, Math.min(6, maxThreads() - 1));
}

function terminalEval(fen: string, history: string[]): PositionEval | null {
  const st = positionStatus(fen, history);
  if (st.kind === "checkmate")
    return {
      eval: { kind: "mate", moves: 0, winner: st.turn === "w" ? "b" : "w" },
      best: null,
      pv: [],
      lines: [],
      depth: 0,
    };
  if (st.kind !== "playing") return { eval: { kind: "cp", cp: 0 }, best: null, pv: [], lines: [], depth: 0 };
  return null;
}

/**
 * Full-game review: evaluates every main-line position at a fixed depth
 * across parallel engine workers, then classifies each move.
 */
export async function runReview(): Promise<void> {
  const my = ++token;
  const { tree, gameKey } = useGame.getState();
  const line = mainline(tree);
  const depth = useSettings.getState().reviewDepth;
  const review = useReview.getState();
  if (line.length < 2) {
    review.patch({ status: "error", error: "There are no moves to review yet.", autoStart: false });
    return;
  }
  const workers = reviewWorkerCount();
  review.patch({
    status: "running",
    gameKey,
    done: 0,
    total: line.length,
    depth,
    workers,
    startedAt: performance.now(),
    finishedAt: null,
    error: null,
    evals: {},
    moves: {},
    summary: null,
    autoStart: false,
  });

  const results: (PositionEval | undefined)[] = new Array(line.length);
  const db = await useOpeningDb.getState().load();
  const book = line.map((n) => db !== null && isBookPosition(db, n.fen));
  const queue: number[] = [];
  line.forEach((n, i) => {
    const t = terminalEval(
      n.fen,
      line.slice(0, i).map((x) => x.fen),
    );
    const cached = cache.get(cacheKey(n.fen, depth));
    if (t) results[i] = t;
    else if (cached) results[i] = cached;
    else queue.push(i);
  });

  // Throttled publication of progress + partial classifications.
  let lastPublish = 0;
  let publishTimer: ReturnType<typeof setTimeout> | null = null;
  const publish = (final = false) => {
    if (my !== token) return;
    const now = performance.now();
    if (!final && now - lastPublish < 120) {
      publishTimer ??= setTimeout(() => {
        publishTimer = null;
        publish();
      }, 120);
      return;
    }
    lastPublish = now;
    const report = buildReport(line, results, book);
    const evals: Record<string, PositionEval> = {};
    results.forEach((r, i) => {
      if (r) evals[line[i].id] = r;
    });
    const moves: Record<string, MoveReview> = {};
    for (const m of report.moves) {
      const { nodeId, ...rest } = m;
      moves[nodeId] = rest;
    }
    useReview.getState().patch({
      evals,
      moves,
      done: results.filter(Boolean).length,
      ...(final ? { status: "done" as const, summary: report.summary, finishedAt: performance.now() } : {}),
    });
  };
  publish(); // show cached/terminal positions immediately

  try {
    const engines = await Promise.all(
      Array.from({ length: Math.min(workers, Math.max(1, queue.length)) }, (_, i) =>
        getEngine(`review-${i}`, "single"),
      ),
    );
    if (my !== token) return;
    // Deterministic work split: worker k owns positions k, k+W, k+2W, … and walks them
    // backwards with a hash cleared once. Interleaving spreads sharp stretches of the
    // game across workers (load balance); the fixed order makes reports reproducible,
    // and nearby positions still share useful hash entries.
    const blocks = engines.map((_, k) => queue.filter((_, j) => j % engines.length === k).reverse());
    await Promise.all(
      engines.map(async ({ service }, k) => {
        await service.setOptions({ Threads: 1, Hash: HASH_MB_PER_WORKER });
        await service.newGame();
        for (const i of blocks[k]) {
          if (my !== token || useGame.getState().gameKey !== gameKey) return;
          const fen = line[i].fen;
          const handle = service.search(
            { fen, depth, movetime: MOVETIME_CAP_MS, multiPv: 1 },
            { supersede: false },
          );
          active.add(handle);
          const r = await handle.result.finally(() => active.delete(handle));
          if (r.cancelled || my !== token) return;
          const top = r.lines[0];
          const best = r.bestMove ?? top?.pv[0] ?? null;
          const lines = top?.pv[0] ? [{ uci: top.pv[0], eval: top.eval }] : [];

          // Second-best probe, only where it can matter.
          const played = line[i + 1]?.uci;
          if (best && played === best) {
            const chess = new Chess(fen);
            const others = chess.inCheck()
              ? []
              : chess
                  .moves({ verbose: true })
                  .map(toUci)
                  .filter((u) => u !== best);
            if (others.length) {
              const probe = service.search(
                {
                  fen,
                  depth: Math.max(6, depth - PROBE_DEPTH_REDUCTION),
                  movetime: MOVETIME_CAP_MS / 2,
                  multiPv: 1,
                  searchmoves: others,
                },
                { supersede: false },
              );
              active.add(probe);
              const pr = await probe.result.finally(() => active.delete(probe));
              if (pr.cancelled || my !== token) return;
              const second = pr.lines[0];
              if (second?.pv[0]) lines.push({ uci: second.pv[0], eval: second.eval });
            }
          }
          const pe: PositionEval = {
            eval: top?.eval ?? { kind: "cp", cp: 0 },
            best,
            bestSan: best ? uciLineToSan(fen, [best])[0]?.san : undefined,
            pv: top?.pv ?? [],
            lines,
            depth: r.stats.depth,
          };
          results[i] = pe;
          cache.set(cacheKey(fen, depth), pe);
          publish();
        }
      }),
    );
    if (my !== token) return;
    if (useGame.getState().gameKey !== gameKey) return;
    if (results.some((r, i) => i < line.length && !r)) {
      useReview.getState().patch({ status: "cancelled" });
      return;
    }
    if (publishTimer) clearTimeout(publishTimer);
    publish(true);
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
  active.forEach((h) => h.cancel());
  active.clear();
  if (useReview.getState().status === "running") useReview.getState().patch({ status: "cancelled" });
}
