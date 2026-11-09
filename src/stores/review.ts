"use client";

import { create } from "zustand";
import type { MoveClass } from "@/core/analysis/classify";
import type { Evaluation } from "@/core/engine/types";

export interface PositionEval {
  eval: Evaluation;
  best: string | null;
  bestSan?: string;
  pv: string[];
  depth: number;
}

export interface MoveReview {
  class: MoveClass;
  winLoss: number;
  accuracy: number;
  mover: "w" | "b";
  bestSan?: string;
  bestUci?: string | null;
}

export type ClassCounts = Record<MoveClass, number>;

export interface SideSummary {
  accuracy: number | null;
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
  error: string | null;
  /** Evaluation of the position at each mainline node. */
  evals: Record<string, PositionEval>;
  /** Classification of the move that led to each mainline node. */
  moves: Record<string, MoveReview>;
  summary: { w: SideSummary; b: SideSummary } | null;
  patch: (p: Partial<ReviewState>) => void;
  reset: () => void;
}

const initial = {
  status: "idle" as ReviewStatus,
  gameKey: null,
  done: 0,
  total: 0,
  depth: 14,
  error: null,
  evals: {},
  moves: {},
  summary: null,
};

export const useReview = create<ReviewState>()((set) => ({
  ...initial,
  patch: (p) => set(p),
  reset: () => set(initial),
}));
