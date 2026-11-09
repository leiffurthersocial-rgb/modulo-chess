/**
 * Locations of the Stockfish WASM builds copied into /public by scripts/copy-engine.mjs.
 * The copy script verifies these constants match the installed `stockfish` package.
 */
export const STOCKFISH_VERSION = "19.0.1";
export const STOCKFISH_BUILD = "19";

export type EngineFlavor = "multi" | "single";

const base = `/stockfish/${STOCKFISH_VERSION}`;

export const ENGINE_URLS: Record<EngineFlavor, string> = {
  /** Multi-threaded lite NNUE build; requires SharedArrayBuffer (cross-origin isolation). */
  multi: `${base}/stockfish-${STOCKFISH_BUILD}-lite.js`,
  /** Single-threaded lite NNUE build; works on any static host. */
  single: `${base}/stockfish-${STOCKFISH_BUILD}-lite-single.js`,
};

/** True when the page is cross-origin isolated and threads can be used. */
export function supportsThreads(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    typeof SharedArrayBuffer !== "undefined" &&
    (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true &&
    typeof WebAssembly === "object"
  );
}

export function maxThreads(): number {
  const hc = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, Math.min(hc, 32));
}
