"use client";

import { create } from "zustand";
import type { EngineFlavor } from "@/core/engine/assets";
import type { SearchSnapshot } from "@/core/engine/types";

export type EngineUiStatus = "off" | "loading" | "ready" | "error";

export interface EngineState {
  /** User toggle: live analysis on/off. */
  enabled: boolean;
  status: EngineUiStatus;
  error: string | null;
  flavor: EngineFlavor | null;
  engineName: string | null;
  notice: string | null;
  maxThreads: number;
  /** Latest snapshot for the position being analysed. */
  snapshot: SearchSnapshot | null;
  /** A search is in progress. */
  searching: boolean;
  /** Increment to force the controller to restart (retry after error). */
  restartKey: number;

  setEnabled: (v: boolean) => void;
  toggle: () => void;
  patch: (p: Partial<EngineState>) => void;
  retry: () => void;
}

export const useEngine = create<EngineState>()((set) => ({
  enabled: false,
  status: "off",
  error: null,
  flavor: null,
  engineName: null,
  notice: null,
  maxThreads: 1,
  snapshot: null,
  searching: false,
  restartKey: 0,
  setEnabled: (enabled) => set({ enabled }),
  toggle: () => set((s) => ({ enabled: !s.enabled })),
  patch: (p) => set(p),
  retry: () => set((s) => ({ restartKey: s.restartKey + 1, error: null, status: "off" })),
}));
