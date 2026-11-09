"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { EloEstimate, GameAssessment } from "@/core/analysis/eloEstimate";
import type { Evaluation } from "@/core/engine/types";

export type EloMode = "quick" | "full";
export type EloStatus = "idle" | "playing" | "evaluating" | "between" | "done";

export interface EloGameRecord extends GameAssessment {
  userColor: "w" | "b";
  result: string;
  estimate: number;
}

export interface EloHistoryEntry extends EloEstimate {
  date: string;
  mode: EloMode;
  games: number;
}

export interface PositionEvalLite {
  eval: Evaluation;
  best: string | null;
}

export interface MoveScore {
  accuracy: number;
  cpLoss: number;
}

export interface EloState {
  mode: EloMode | null;
  status: EloStatus;
  totalGames: number;
  games: EloGameRecord[];
  startElo: number;
  /** Opponent Elo for the current game (adapts during a quick estimate). */
  opponentElo: number;
  /** Opponent Elo sampled at each evaluated user move, for the game's average. */
  opponentSamples: number[];
  /** useGame.gameKey of the session's current game. */
  gameKey: number | null;
  /** Engine evaluations keyed by FEN. */
  evals: Record<string, PositionEvalLite>;
  /** Quality of each evaluated, non-book user move, keyed by node id. */
  moveScores: Record<string, MoveScore>;
  final: EloEstimate | null;
  history: EloHistoryEntry[];
  patch: (p: Partial<EloState>) => void;
  clearHistory: () => void;
}

export const useElo = create<EloState>()(
  persist(
    (set) => ({
      mode: null,
      status: "idle",
      totalGames: 0,
      games: [],
      startElo: 1200,
      opponentElo: 1200,
      opponentSamples: [],
      gameKey: null,
      evals: {},
      moveScores: {},
      final: null,
      history: [],
      patch: (p) => set(p),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "modulo-chess:elo",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ history: s.history }),
    },
  ),
);
