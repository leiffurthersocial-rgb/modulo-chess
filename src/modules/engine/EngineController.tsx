"use client";

import { useEffect, useState } from "react";
import { maxThreads } from "@/core/engine/assets";
import type { EngineService } from "@/core/engine/EngineService";
import { getEngine } from "@/core/engine/pool";
import type { SearchSnapshot } from "@/core/engine/types";
import { positionStatus, useGame } from "@/stores/game";
import { useEngine } from "@/stores/engine";
import { useReview } from "@/stores/review";
import { useSettings } from "@/stores/settings";

/** Default thread count: leave one core for the UI. */
export function autoThreads(engineMax: number): number {
  return Math.max(1, Math.min(engineMax, maxThreads() - 1));
}

/**
 * Drives live analysis of the current position. Mounted once by the shell.
 * Every position change issues a superseding search; the EngineService guarantees
 * that only the latest search ever reports lines.
 */
export function EngineController() {
  const enabled = useEngine((s) => s.enabled);
  const restartKey = useEngine((s) => s.restartKey);
  const patch = useEngine((s) => s.patch);
  const fen = useGame((s) => s.tree.nodes[s.currentId].fen);
  const mode = useGame((s) => s.mode);
  const reviewRunning = useReview((s) => s.status === "running");
  const { threads, hashMb, multiPv, depthLimit, flavor } = useSettings((s) => s.engine);
  const [service, setService] = useState<EngineService | null>(null);

  // Boot lazily on first enable, then keep options in sync.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let offStatus: (() => void) | undefined;
    if (useEngine.getState().status !== "ready") patch({ status: "loading", error: null });
    getEngine("analysis", flavor)
      .then(async (booted) => {
        if (cancelled) return;
        const engineMax = booted.service.option("Threads")?.max ?? 1;
        const hardMax = Math.min(engineMax, maxThreads());
        const t = threads > 0 ? Math.min(threads, hardMax) : autoThreads(hardMax);
        await booted.service.setOptions({ Threads: t, Hash: hashMb });
        if (cancelled) return;
        offStatus = booted.service.onStatus((status, error) => {
          if (status === "error") {
            patch({ status: "error", error: error?.message ?? "Engine crashed", searching: false });
            setService(null);
          }
        });
        patch({
          status: "ready",
          flavor: booted.flavor,
          engineName: booted.identity.name,
          notice: booted.fallbackReason ?? null,
          maxThreads: hardMax,
          error: null,
        });
        setService(booted.service);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        patch({
          status: "error",
          error: e instanceof Error ? e.message : "The engine failed to start",
          searching: false,
        });
        setService(null);
      });
    return () => {
      cancelled = true;
      offStatus?.();
    };
  }, [enabled, flavor, threads, hashMb, restartKey, patch]);

  // Analyse the displayed position.
  useEffect(() => {
    if (!service || !enabled || reviewRunning || mode === "play") {
      patch({ searching: false });
      return;
    }
    const status = positionStatus(fen);
    if (status.kind === "checkmate" || status.kind === "stalemate") {
      patch({ searching: false, snapshot: null });
      return;
    }
    let latest: SearchSnapshot | null = null;
    let frame = 0;
    const flush = () => {
      frame = 0;
      if (latest) patch({ snapshot: latest });
    };
    // Small debounce so scrubbing through a game doesn't flood the engine.
    let handle: ReturnType<EngineService["search"]> | null = null;
    const timer = setTimeout(() => {
      handle = service.search(
        { fen, multiPv, depth: depthLimit > 0 ? depthLimit : undefined },
        {
          onUpdate: (snap) => {
            latest = snap;
            if (!frame) frame = requestAnimationFrame(flush);
          },
        },
      );
      patch({ searching: true });
      handle.result
        .then((r) => {
          if (!r.cancelled) patch({ searching: false, snapshot: r.lines.length ? r : latest });
        })
        .catch(() => undefined);
    }, 40);
    return () => {
      clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
      handle?.cancel();
    };
  }, [service, enabled, reviewRunning, mode, fen, multiPv, depthLimit, patch]);

  return null;
}
