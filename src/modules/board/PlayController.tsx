"use client";

import { useEffect } from "react";
import { lineFrom, pathTo } from "@/core/chess/tree";
import type { SearchHandle } from "@/core/engine/EngineService";
import { getEngine } from "@/core/engine/pool";
import { positionStatus, useGame, type Strength } from "@/stores/game";
import { useSettings } from "@/stores/settings";
import { useToasts } from "@/stores/toasts";

/** UCI options for a strength setting. */
export function strengthOptions(strength: Strength): Record<string, string | number | boolean> {
  return strength.kind === "elo"
    ? { UCI_LimitStrength: true, UCI_Elo: strength.elo, "Skill Level": 20 }
    : { UCI_LimitStrength: false, "Skill Level": strength.level };
}

/** Think time grows with strength; weak levels answer quickly. */
export function thinkTimeMs(strength: Strength): number {
  if (strength.kind === "elo") return 400 + Math.round(((strength.elo - 1320) / (3190 - 1320)) * 1600);
  return 150 + strength.level * 60;
}

const MIN_REPLY_MS = 450;

export function strengthLabel(strength: Strength): string {
  return strength.kind === "elo" ? `${strength.elo} Elo` : `Level ${strength.level}`;
}

/** Plays the engine's moves when it's Stockfish's turn in play mode. */
export function PlayController() {
  const mode = useGame((s) => s.mode);
  const currentId = useGame((s) => s.currentId);
  const gameKey = useGame((s) => s.gameKey);
  const userColor = useGame((s) => s.play.userColor);
  const strength = useGame((s) => s.play.strength);
  const result = useGame((s) => s.result);
  const flavor = useSettings((s) => s.engine.flavor);

  useEffect(() => {
    if (mode !== "play") return;
    const { tree, setResult, setThinking } = useGame.getState();
    const node = tree.nodes[currentId];
    if (!node) return;
    // Only act at the end of the game line.
    const line = lineFrom(tree, currentId);
    if (line.length > 1) return;
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
    getEngine("play", flavor)
      .then(async ({ service }) => {
        await service.setOptions({ Threads: 1, Hash: 16, ...strengthOptions(strength) });
        if (cancelled) return;
        handle = service.search({ fen: node.fen, movetime: thinkTimeMs(strength) });
        const r = await handle.result;
        const wait = MIN_REPLY_MS - (performance.now() - started);
        if (wait > 0) await new Promise((res) => setTimeout(res, wait));
        if (cancelled || r.cancelled || !r.bestMove) return;
        const s = useGame.getState();
        if (s.mode !== "play" || s.currentId !== currentId || s.gameKey !== gameKey) return;
        s.playMove(r.bestMove);
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
  }, [mode, currentId, gameKey, userColor, strength, result, flavor]);

  return null;
}
