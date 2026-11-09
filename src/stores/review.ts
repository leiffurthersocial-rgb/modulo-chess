"use client";

import { create } from "zustand";
import type { MoveClass } from "@/core/analysis/classify";
import type { Evaluation } from "@/core/engine/types";

export interface CandidateLine {
  uci: string;
  eval: Evaluation;
}

export interface PositionEval {
  /** Best-play evaluation of the position (White POV). */
  eval: Evaluation;
  best: string | null;
  bestSan?: string;
  /** Principal variation of the best line (UCI). */
  pv: string[];
  /** Top MultiPV candidates (best first). */
  lines: CandidateLine[];
  depth: number;
}

export interface MoveReview {
  class: MoveClass;
  winLoss: number;
  accuracy: number;
  mover: "w" | "b";
  /** Centipawn loss of the move (0–1000). */
  cpLoss: number;
  /** Evaluation after the played move (White POV). */
  playedEval: Evaluation;
  bestSan?: string;
  bestUci?: string | null;
  /** Best continuation from the position before the move, in SAN (starts with the best move). */
  bestLine?: string[];
}

export type ClassCounts = Record<MoveClass, number>;

export interface SideSummary {
  /** Game accuracy (lichess algorithm). */
  accuracy: number | null;
  /** Estimated playing strength shown in this game. */
  rating: number | null;
  /** Average centipawn loss. */
  acpl: number | null;
  counts: ClassCounts;
}

export type ReviewStatus = "idle" | "running" | "done" | "cancelled" | "error";

export interface ReviewState {
  status: ReviewStatus;
  /** gameKey of the reviewed game; results are dropped when another game is loaded. */
  gameKey: number | null;
  done: number;
  total: number;
  depth: number;
  /** Parallel engine workers used. */
  workers: number;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
  /** Evaluation of the position at each mainline node. */
  evals: Record<string, PositionEval>;
  /** Classification of the move that led to each mainline node. */
  moves: Record<string, MoveReview>;
  summary: { w: SideSummary; b: SideSummary } | null;
  /** Start a review as soon as the Review panel opens (set by "Review game" buttons). */
  autoStart: boolean;
  patch: (p: Partial<ReviewState>) => void;
  reset: () => void;
}

const initial = {
  status: "idle" as ReviewStatus,
  gameKey: null,
  done: 0,
  total: 0,
  depth: 16,
  workers: 1,
  startedAt: null,
  finishedAt: null,
  error: null,
  evals: {},
  moves: {},
  summary: null,
  autoStart: false,
};

export const useReview = create<ReviewState>()((set) => ({
  ...initial,
  patch: (p) => set(p),
  reset: () => set(initial),
}));
