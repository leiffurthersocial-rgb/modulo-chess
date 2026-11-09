"use client";

import { Chess } from "chess.js";
import { useEffect } from "react";
import { lineFrom, pathTo, toUci } from "@/core/chess/tree";
import type { SearchHandle } from "@/core/engine/EngineService";
import { getEngine } from "@/core/engine/pool";
import { candidatesFromLines, pickWeakMove, strengthName, strengthPlan } from "@/core/engine/strength";
import { positionStatus, useGame, type Strength } from "@/stores/game";
import { useSettings } from "@/stores/settings";
import { useToasts } from "@/stores/toasts";

/** Minimum time before the engine replies, so moves don't appear instantly. */
const MIN_REPLY_MS = 450;

export function strengthLabel(strength: Strength): string {
  return `${strength.elo} · ${strengthName(strength.elo)}`;
}

/** Plays the engine's moves when it's Stockfish's turn in play mode. */
export function PlayController() {
  const mode = useGame((s) => s.mode);
  const currentId = useGame((s) => s.currentId);
  const gameKey = useGame((s) => s.gameKey);
  const userColor = useGame((s) => s.play.userColor);
  const elo = useGame((s) => s.play.strength.elo);
  const result = useGame((s) => s.result);
  const flavor = useSettings((s) => s.engine.flavor);

  useEffect(() => {
    if (mode !== "play") return;
    const { tree, setResult, setThinking } = useGame.getState();
    const node = tree.nodes[currentId];
    if (!node) return;
    // Only act at the end of the game line.
    if (lineFrom(tree, currentId).length > 1) return;
    const path = pathTo(tree, currentId);
    const status = positionStatus(
      node.fen,
      path.slice(0, -1).map((n) => n.fen),
    );
    if (status.kind !== "playing") {
      const res = status.kind === "checkmate" ? (status.turn === "w" ? "0-1" : "1-0") : "1/2-1/2";
      if (useGame.getState().result !== res) setResult(res);
      return;
    }
    if (result !== "*" || status.turn === userColor) return;

    let cancelled = false;
    let handle: SearchHandle | null = null;
    setThinking(true);
    const started = performance.now();
    const plan = strengthPlan(elo);

    getEngine("play", flavor)
      .then(async ({ service }) => {
        await service.setOptions({ Threads: 1, Hash: 16, ...plan.options });
        if (cancelled) return;
        let move: string | null;
        if (plan.kind === "native") {
          handle = service.search({ fen: node.fen, movetime: plan.movetime, multiPv: 1 });
          const r = await handle.result;
          if (r.cancelled) return;
          move = r.bestMove;
        } else {
          handle = service.search({ fen: node.fen, depth: plan.depth, multiPv: plan.multiPv });
          const r = await handle.result;
          if (r.cancelled) return;
          const legal = new Chess(node.fen).moves({ verbose: true }).map(toUci);
          move = pickWeakMove(candidatesFromLines(r.lines, status.turn), legal, plan);
        }
        const wait = MIN_REPLY_MS - (performance.now() - started);
        if (wait > 0) await new Promise((res) => setTimeout(res, wait));
        if (cancelled || !move) return;
        const s = useGame.getState();
        if (s.mode !== "play" || s.currentId !== currentId || s.gameKey !== gameKey) return;
        s.playMove(move);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        useToasts.getState().push({
          tone: "error",
          title: "Stockfish could not move",
          body: e instanceof Error ? e.message : "The engine failed to start.",
        });
      })
      .finally(() => {
        if (!cancelled) useGame.getState().setThinking(false);
      });
    return () => {
      cancelled = true;
      handle?.cancel();
      useGame.getState().setThinking(false);
    };
  }, [mode, currentId, gameKey, userColor, elo, result, flavor]);

  return null;
}
