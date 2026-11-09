"use client";

import { useEffect } from "react";
import { classifyMove, gameAccuracy } from "@/core/analysis/classify";
import {
  adaptOpponent,
  centipawnLoss,
  combineEstimates,
  estimateGame,
  qualityElo,
} from "@/core/analysis/eloEstimate";
import { mainline, sideToMove, type MoveNode } from "@/core/chess/tree";
import { getEngine } from "@/core/engine/pool";
import { isBookPosition } from "@/modules/openings/lookup";
import { useElo, type EloGameRecord, type MoveScore, type PositionEvalLite } from "@/stores/elo";
import { positionStatus, useGame } from "@/stores/game";
import { useOpeningDb } from "@/stores/openings";
import { useSettings } from "@/stores/settings";
import { useToasts } from "@/stores/toasts";

/** Depth / time used to judge the player's moves. */
const EVAL_DEPTH = 11;
const EVAL_MOVETIME = 1200;

let pumping = false;
let rerun = false;

function scoreFor(result: string, color: "w" | "b"): number {
  if (result === "1/2-1/2") return 0.5;
  if (result === "1-0") return color === "w" ? 1 : 0;
  if (result === "0-1") return color === "b" ? 1 : 0;
  return 0.5;
}

/** Recomputes accuracy and centipawn loss for every user move whose before/after positions are evaluated. */
function scoreMoves(line: MoveNode[], evals: Record<string, PositionEvalLite>, userColor: "w" | "b") {
  const db = useOpeningDb.getState().db;
  const out: Record<string, MoveScore> = {};
  let inBook = true;
  for (let i = 1; i < line.length; i++) {
    const prev = line[i - 1];
    const node = line[i];
    inBook = inBook && db !== null && isBookPosition(db, node.fen);
    const mover = sideToMove(prev.fen);
    if (mover !== userColor || inBook) continue;
    const before = evals[prev.fen];
    const after = evals[node.fen];
    if (!before || !after) continue;
    out[node.id] = {
      accuracy: classifyMove({
        mover,
        before: before.eval,
        after: after.eval,
        played: node.uci!,
        best: before.best,
      }).accuracy,
      cpLoss: centipawnLoss(mover, before.eval, after.eval),
    };
  }
  return out;
}

function finalizeGame() {
  const elo = useElo.getState();
  const game = useGame.getState();
  const scores = Object.values(elo.moveScores);
  const accs = scores.map((m) => m.accuracy);
  const opponentElo = elo.opponentSamples.length
    ? elo.opponentSamples.reduce((a, b) => a + b, 0) / elo.opponentSamples.length
    : elo.opponentElo;
  const assessment = {
    userMoves: scores.length,
    accuracy: gameAccuracy(accs),
    quality: qualityElo(
      accs,
      scores.map((m) => m.cpLoss),
    ),
    opponentElo,
    score: scoreFor(game.result, game.play.userColor),
  };
  const record: EloGameRecord = {
    ...assessment,
    userColor: game.play.userColor,
    result: game.result,
    estimate: estimateGame(assessment),
  };
  const games = [...elo.games, record];
  if (games.length < elo.totalGames) {
    elo.patch({ games, status: "between" });
    return;
  }
  const final = combineEstimates(games);
  const history = final
    ? [
        { ...final, date: new Date().toISOString(), mode: elo.mode!, games: games.length },
        ...elo.history,
      ].slice(0, 20)
    : elo.history;
  elo.patch({ games, status: "done", final, history });
}

/** Evaluates every not-yet-evaluated position of the current estimate game, one at a time. */
async function pump(): Promise<void> {
  if (pumping) {
    rerun = true;
    return;
  }
  pumping = true;
  rerun = false;
  try {
    await useOpeningDb.getState().load();
    const { service } = await getEngine("analysis", useSettings.getState().engine.flavor);
    for (;;) {
      const elo = useElo.getState();
      const game = useGame.getState();
      if (!["playing", "evaluating"].includes(elo.status) || game.gameKey !== elo.gameKey) return;
      const line = mainline(game.tree);
      const missing = line.find((n) => !elo.evals[n.fen]);
      if (!missing) {
        if (elo.status === "evaluating") finalizeGame();
        return;
      }
      const idx = line.indexOf(missing);
      const st = positionStatus(
        missing.fen,
        line.slice(0, idx).map((n) => n.fen),
      );
      let pe: PositionEvalLite;
      if (st.kind === "checkmate")
        pe = { eval: { kind: "mate", moves: 0, winner: st.turn === "w" ? "b" : "w" }, best: null };
      else if (st.kind !== "playing") pe = { eval: { kind: "cp", cp: 0 }, best: null };
      else {
        const r = await service.analyze(
          { fen: missing.fen, depth: EVAL_DEPTH, movetime: EVAL_MOVETIME, multiPv: 1 },
          { supersede: false },
        );
        if (r.cancelled) continue;
        pe = { eval: r.lines[0]?.eval ?? { kind: "cp", cp: 0 }, best: r.bestMove };
      }
      // The session or game may have changed while we were waiting.
      const now = useElo.getState();
      if (now.gameKey !== useGame.getState().gameKey || !["playing", "evaluating"].includes(now.status))
        return;
      const evals = { ...now.evals, [missing.fen]: pe };
      const userColor = useGame.getState().play.userColor;
      const moveScores = scoreMoves(mainline(useGame.getState().tree), evals, userColor);
      const newlyScored = Object.keys(moveScores).length > Object.keys(now.moveScores).length;
      const patch: Partial<typeof now> = { evals, moveScores };
      if (newlyScored) {
        patch.opponentSamples = [...now.opponentSamples, now.opponentElo];
        // Quick mode: the opponent follows the player's running level.
        if (now.mode === "quick" && now.status === "playing") {
          const scored = Object.values(moveScores);
          const running =
            qualityElo(
              scored.map((m) => m.accuracy),
              scored.map((m) => m.cpLoss),
            ) ?? now.opponentElo;
          const next = adaptOpponent(now.opponentElo, running, scored.length);
          if (next !== now.opponentElo) {
            patch.opponentElo = next;
            useGame.getState().setStrength({ elo: next });
          }
        }
      }
      now.patch(patch);
    }
  } catch (e) {
    useToasts.getState().push({
      tone: "error",
      title: "Couldn't evaluate your moves",
      body: e instanceof Error ? e.message : "The engine failed.",
    });
  } finally {
    pumping = false;
    if (rerun) void pump();
  }
}

/** Background worker for the Elo estimate module. */
export function EloController() {
  const status = useElo((s) => s.status);
  const sessionKey = useElo((s) => s.gameKey);
  const tree = useGame((s) => s.tree);
  const result = useGame((s) => s.result);
  const mode = useGame((s) => s.mode);
  const gameKey = useGame((s) => s.gameKey);

  useEffect(() => {
    void useElo.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (status !== "playing" && status !== "evaluating") return;
    // A different game was loaded, or the player left mid-game: abandon the session.
    if (gameKey !== sessionKey || (mode !== "play" && result === "*")) {
      useElo.getState().patch({ status: "idle", mode: null, gameKey: null, games: [] });
      useToasts
        .getState()
        .push({ tone: "info", title: "Elo estimate stopped", body: "The game was left before it finished." });
      return;
    }
    if (status === "playing" && result !== "*") useElo.getState().patch({ status: "evaluating" });
    void pump();
  }, [status, sessionKey, tree, result, mode, gameKey]);

  return null;
}
