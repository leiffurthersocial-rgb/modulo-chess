"use client";

import { create } from "zustand";
import { loadOpeningDb, type OpeningDb } from "@/modules/openings/lookup";

interface OpeningDbState {
  db: OpeningDb | null;
  error: string | null;
  load: () => Promise<OpeningDb | null>;
}

export const useOpeningDb = create<OpeningDbState>()((set, get) => ({
  db: null,
  error: null,
  load: async () => {
    if (get().db) return get().db;
    try {
      const db = await loadOpeningDb();
      set({ db, error: null });
      return db;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Could not load opening data" });
      return null;
    }
  },
}));
