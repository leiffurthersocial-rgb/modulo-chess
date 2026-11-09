/** Minimal line-oriented channel to a UCI engine. Abstracted so tests can use a fake engine. */
export interface EngineTransport {
  post(command: string): void;
  /** Subscribe to output lines. Returns an unsubscribe function. */
  onLine(listener: (line: string) => void): () => void;
  /** Subscribe to fatal errors (worker failed to load, WASM crashed, …). */
  onError(listener: (error: Error) => void): () => void;
  terminate(): void;
}

/** Wraps a dedicated Web Worker running a Stockfish WASM build. */
export function createWorkerTransport(url: string): EngineTransport {
  const worker = new Worker(url);
  const lineListeners = new Set<(line: string) => void>();
  const errorListeners = new Set<(error: Error) => void>();

  worker.onmessage = (ev: MessageEvent) => {
    // The stockfish.js build also posts download-progress objects; only strings are UCI output.
    if (typeof ev.data !== "string") return;
    for (const line of ev.data.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) lineListeners.forEach((l) => l(trimmed));
    }
  };
  worker.onerror = (ev: ErrorEvent) => {
    ev.preventDefault();
    const err = new Error(ev.message || "Engine worker failed to load");
    errorListeners.forEach((l) => l(err));
  };
  worker.onmessageerror = () => {
    errorListeners.forEach((l) => l(new Error("Engine worker message could not be decoded")));
  };

  return {
    post: (command) => worker.postMessage(command),
    onLine(listener) {
      lineListeners.add(listener);
      return () => lineListeners.delete(listener);
    },
    onError(listener) {
      errorListeners.add(listener);
      return () => errorListeners.delete(listener);
    },
    terminate() {
      lineListeners.clear();
      errorListeners.clear();
      worker.terminate();
    },
  };
}
