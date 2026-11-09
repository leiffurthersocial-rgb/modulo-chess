import { bootEngine, type BootedEngine, type FlavorPreference } from "./browser";

/**
 * Engines are keyed by role so that features never fight over one worker:
 *  - "analysis": live analysis and the Elo estimator (user-configured threads/hash)
 *  - "play": the opponent in play mode (1 thread, small hash, strength-limited)
 *  - "review-N": parallel single-threaded workers for full-game review
 */
export type EngineRole = "analysis" | "play" | `review-${number}`;

const engines = new Map<EngineRole, { pref: FlavorPreference; promise: Promise<BootedEngine> }>();

export function getEngine(role: EngineRole, preference: FlavorPreference = "auto"): Promise<BootedEngine> {
  const existing = engines.get(role);
  if (existing && existing.pref === preference) return existing.promise;
  if (existing) void existing.promise.then((e) => e.service.dispose()).catch(() => undefined);
  const promise = bootEngine(preference);
  engines.set(role, { pref: preference, promise });
  // Forget failed boots and crashed engines so the next call retries.
  promise.then(
    (booted) =>
      booted.service.onStatus((status) => {
        if ((status === "error" || status === "disposed") && engines.get(role)?.promise === promise)
          engines.delete(role);
      }),
    () => {
      if (engines.get(role)?.promise === promise) engines.delete(role);
    },
  );
  return promise;
}

export function disposeEngine(role: EngineRole): void {
  const existing = engines.get(role);
  engines.delete(role);
  void existing?.promise.then((e) => e.service.dispose()).catch(() => undefined);
}
