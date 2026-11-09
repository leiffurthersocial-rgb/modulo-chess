import { ENGINE_URLS, supportsThreads, type EngineFlavor } from "./assets";
import { EngineService, type EngineIdentity } from "./EngineService";
import { createWorkerTransport } from "./transport";

export type FlavorPreference = "auto" | EngineFlavor;

export interface BootedEngine {
  service: EngineService;
  flavor: EngineFlavor;
  identity: EngineIdentity;
  /** Set when the preferred flavor failed and we fell back. */
  fallbackReason?: string;
}

function make(flavor: EngineFlavor): EngineService {
  return new EngineService({ createTransport: () => createWorkerTransport(ENGINE_URLS[flavor]) });
}

/**
 * Boots Stockfish in a Web Worker. Uses the multi-threaded build when the page is
 * cross-origin isolated (SharedArrayBuffer available), otherwise — or if it fails —
 * the single-threaded build.
 */
export async function bootEngine(preference: FlavorPreference = "auto"): Promise<BootedEngine> {
  if (typeof Worker === "undefined" || typeof WebAssembly !== "object") {
    throw new Error("This browser does not support Web Workers and WebAssembly.");
  }
  const threads = supportsThreads();
  const wantMulti = preference === "multi" || (preference === "auto" && threads);

  if (wantMulti && threads) {
    const service = make("multi");
    try {
      const identity = await service.init();
      return { service, flavor: "multi", identity };
    } catch (e) {
      service.dispose();
      const single = make("single");
      const identity = await single.init();
      return {
        service: single,
        flavor: "single",
        identity,
        fallbackReason: `Multi-threaded engine failed (${e instanceof Error ? e.message : "unknown error"}); using single-threaded build.`,
      };
    }
  }

  const service = make("single");
  const identity = await service.init();
  return {
    service,
    flavor: "single",
    identity,
    fallbackReason:
      wantMulti && !threads
        ? "SharedArrayBuffer is unavailable (page not cross-origin isolated); using single-threaded build."
        : undefined,
  };
}
