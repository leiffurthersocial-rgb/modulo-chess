"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { FlavorPreference } from "@/core/engine/browser";
import { DEFAULT_BOARD_THEME } from "@/themes/boards";
import { DEFAULT_PIECE_SET } from "@/themes/pieces";

export type ThemeMode = "dark" | "light" | "system";

export interface EngineSettings {
  threads: number;
  hashMb: number;
  /** 0 = unlimited (infinite analysis). */
  depthLimit: number;
  multiPv: number;
  flavor: FlavorPreference;
}

export interface Settings {
  theme: ThemeMode;
  boardTheme: string;
  pieceSet: string;
  showCoordinates: boolean;
  showLegalMoves: boolean;
  animations: boolean;
  sound: boolean;
  volume: number;
  showArrows: boolean;
  showEvalBar: boolean;
  engine: EngineSettings;
  reviewDepth: number;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  boardTheme: DEFAULT_BOARD_THEME,
  pieceSet: DEFAULT_PIECE_SET,
  showCoordinates: true,
  showLegalMoves: true,
  animations: true,
  sound: true,
  volume: 0.6,
  showArrows: true,
  showEvalBar: true,
  engine: { threads: 0, hashMb: 64, depthLimit: 0, multiPv: 3, flavor: "auto" },
  reviewDepth: 16,
};

export const SETTINGS_STORAGE_KEY = "modulo-chess:settings";

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
  setEngine: (patch: Partial<EngineSettings>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      setEngine: (patch) => set((s) => ({ engine: { ...s.engine, ...patch } })),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Rehydrated explicitly on mount (see <SettingsHydrator/>) to keep SSR markup stable.
      skipHydration: true,
      partialize: (s) => {
        const { set: _s, setEngine: _e, reset: _r, ...rest } = s;
        return rest;
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Settings>;
        return { ...current, ...p, engine: { ...current.engine, ...(p.engine ?? {}) } };
      },
    },
  ),
);
