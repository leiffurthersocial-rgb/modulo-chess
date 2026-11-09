import { normalizeScore } from "./evaluation";
import type { EngineTransport } from "./transport";
import type { EngineLine, SearchResult, SearchSnapshot, SearchStats, UciOption } from "./types";
import { buildGo, buildPosition, buildSetOption, parseBestMove, parseInfo, parseOption } from "./uci";

export type EngineStatus = "idle" | "loading" | "ready" | "error" | "disposed";

export interface EngineIdentity {
  name: string;
  author?: string;
  options: UciOption[];
}

export interface SearchRequest {
  fen: string;
  /** Optional UCI moves to apply after `fen`. */
  moves?: string[];
  depth?: number;
  movetime?: number;
  nodes?: number;
  /** Search until stopped. Implied when no other limit is given. */
  infinite?: boolean;
  /** Number of principal variations (MultiPV). Defaults to 1. */
  multiPv?: number;
  /** Only consider these moves (UCI `searchmoves`). */
  searchmoves?: string[];
}

export interface SearchHandle {
  readonly id: number;
  /** Resolves when the engine reports `bestmove` (or immediately when cancelled while queued). */
  readonly result: Promise<SearchResult>;
  /** Stops this search. Its promise resolves with `cancelled: true`. */
  cancel(): void;
}

export interface SearchOptions {
  /** Called with the latest aggregated snapshot after every `info` line carrying a PV. */
  onUpdate?: (snapshot: SearchSnapshot) => void;
  /**
   * When true (default), cancels the running search and any queued searches.
   * This is what makes rapid position changes safe: only the latest request survives.
   */
  supersede?: boolean;
}

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineError";
  }
}

interface Job {
  kind: "command" | "search";
  run: () => Promise<void>;
  /** Called when the job is cancelled before it started. */
  drop: (reason: "cancelled" | Error) => void;
}

interface SearchJob extends Job {
  kind: "search";
  id: number;
  cancelled: boolean;
  started: boolean;
  stopSent: boolean;
}

export interface EngineServiceOptions {
  createTransport: () => EngineTransport;
  /** Milliseconds to wait for `uciok`/`readyok` while booting. */
  initTimeoutMs?: number;
}

const emptyStats = (): SearchStats => ({ depth: 0, nodes: 0, nps: 0, time: 0 });

/**
 * Promise-based UCI client.
 *
 * Invariants:
 *  - Commands are processed strictly one job at a time.
 *  - A new `go` is never sent before the previous search's `bestmove` arrived, so `info`
 *    lines can always be attributed to the job that is currently running.
 *  - Superseded searches are stopped and their late `info` lines are ignored.
 */
export class EngineService {
  private transport: EngineTransport | null = null;
  private readonly opts: EngineServiceOptions;
  private initPromise: Promise<EngineIdentity> | null = null;
  private lineListeners = new Set<(line: string) => void>();
  private statusListeners = new Set<(status: EngineStatus, error?: Error) => void>();
  private queue: Job[] = [];
  private running: Job | null = null;
  private ready = false;
  private searchSeq = 0;
  private applied = new Map<string, string>();
  private fatal: Error | null = null;
  private _status: EngineStatus = "idle";
  identity: EngineIdentity | null = null;

  constructor(opts: EngineServiceOptions) {
    this.opts = opts;
  }

  get status(): EngineStatus {
    return this._status;
  }

  get isSearching(): boolean {
    return this.running?.kind === "search";
  }

  onStatus(listener: (status: EngineStatus, error?: Error) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Spawns the engine and performs the UCI handshake. Idempotent. */
  init(): Promise<EngineIdentity> {
    if (this.initPromise) return this.initPromise;
    this.setStatus("loading");
    this.initPromise = new Promise<EngineIdentity>((resolve, reject) => {
      let transport: EngineTransport;
      try {
        transport = this.opts.createTransport();
      } catch (e) {
        const err = new EngineError(e instanceof Error ? e.message : "Could not start engine");
        this.fail(err);
        reject(err);
        return;
      }
      this.transport = transport;
      transport.onLine((line) => this.lineListeners.forEach((l) => l(line)));
      transport.onError((error) => {
        const err = new EngineError(error.message);
        this.fail(err);
        reject(err);
      });

      const identity: EngineIdentity = { name: "UCI engine", options: [] };
      const timeout = setTimeout(() => {
        const err = new EngineError("Engine did not respond in time");
        this.fail(err);
        reject(err);
      }, this.opts.initTimeoutMs ?? 30000);

      let phase: "uci" | "ready" = "uci";
      const off = this.addLineListener((line) => {
        if (phase === "uci") {
          if (line.startsWith("id name ")) identity.name = line.slice(8);
          else if (line.startsWith("id author ")) identity.author = line.slice(10);
          else if (line.startsWith("option ")) {
            const opt = parseOption(line);
            if (opt) identity.options.push(opt);
          } else if (line === "uciok") {
            phase = "ready";
            transport.post("isready");
          }
        } else if (line === "readyok") {
          clearTimeout(timeout);
          off();
          this.identity = identity;
          this.ready = true;
          this.setStatus("ready");
          resolve(identity);
          this.pump();
        }
      });
      transport.post("uci");
    });
    return this.initPromise;
  }

  option(name: string): UciOption | undefined {
    return this.identity?.options.find((o) => o.name.toLowerCase() === name.toLowerCase());
  }

  /**
   * Applies UCI options (only those that changed), then waits for `readyok`.
   * Options are applied between searches; a running infinite search is stopped first.
   */
  setOptions(options: Record<string, string | number | boolean>): Promise<void> {
    const pending = Object.entries(options).map(([k, v]) => [k, String(v)] as const);
    if (this.running?.kind === "search") this.stopJob(this.running as SearchJob);
    return this.enqueueCommand(async () => {
      let changed = false;
      for (const [name, raw] of pending) {
        let value = raw;
        const opt = this.option(name);
        if (opt === undefined && this.identity) continue; // unsupported by this build
        if (opt?.type === "spin") value = String(clampSpin(Number(value), opt));
        if (this.applied.get(name) === value) continue;
        this.post(buildSetOption(name, value));
        this.applied.set(name, value);
        changed = true;
      }
      if (changed) await this.sync();
    });
  }

  /** Sends `ucinewgame` (clears hash/history heuristics) and waits for `readyok`. */
  newGame(): Promise<void> {
    return this.enqueueCommand(async () => {
      this.post("ucinewgame");
      await this.sync();
    });
  }

  /** Starts a search. By default supersedes any running or queued search. */
  search(request: SearchRequest, { onUpdate, supersede = true }: SearchOptions = {}): SearchHandle {
    if (supersede) this.cancelSearches();
    const id = ++this.searchSeq;
    let resolveResult!: (r: SearchResult) => void;
    let rejectResult!: (e: Error) => void;
    const result = new Promise<SearchResult>((res, rej) => {
      resolveResult = res;
      rejectResult = rej;
    });

    const fen = request.fen;
    const multiPv = Math.max(1, Math.floor(request.multiPv ?? 1));
    const lines = new Map<number, EngineLine>();
    let stats = emptyStats();
    const snapshot = (): SearchSnapshot => ({
      fen,
      lines: [...lines.values()].filter((l) => l.multipv <= multiPv).sort((a, b) => a.multipv - b.multipv),
      stats: { ...stats },
    });
    // Score is relative to the side to move in the searched position.
    const turn = sideAfter(fen, request.moves);

    const job: SearchJob = {
      kind: "search",
      id,
      cancelled: false,
      started: false,
      stopSent: false,
      drop: (reason) => {
        if (reason === "cancelled") resolveResult({ ...snapshot(), bestMove: null, cancelled: true });
        else rejectResult(reason);
      },
      run: () =>
        new Promise<void>((done) => {
          if (job.cancelled) {
            resolveResult({ ...snapshot(), bestMove: null, cancelled: true });
            done();
            return;
          }
          const finish = (r: SearchResult | Error) => {
            off();
            offFatal();
            // Free the slot before resolving so callers observe a consistent state.
            if (this.running === job) this.running = null;
            if (r instanceof Error) rejectResult(r);
            else resolveResult(r);
            done();
          };
          const off = this.addLineListener((line) => {
            if (line.startsWith("info ")) {
              if (job.cancelled) return; // late output of a superseded search
              const info = parseInfo(line);
              if (!info || info.string !== undefined) return;
              if (info.depth !== undefined || info.nodes !== undefined) {
                stats = {
                  depth: info.depth ?? stats.depth,
                  seldepth: info.seldepth ?? stats.seldepth,
                  nodes: info.nodes ?? stats.nodes,
                  nps: info.nps ?? stats.nps,
                  time: info.time ?? stats.time,
                  hashfull: info.hashfull ?? stats.hashfull,
                };
              }
              if (info.score && info.pv && info.depth !== undefined) {
                const k = info.multipv ?? 1;
                // Keep the previous exact line when the engine reports a fail-high/low bound.
                const prev = lines.get(k);
                if (info.bound && prev && prev.depth >= info.depth) return;
                lines.set(k, {
                  multipv: k,
                  depth: info.depth,
                  seldepth: info.seldepth,
                  score: info.score,
                  eval: normalizeScore(info.score, turn),
                  bound: info.bound,
                  pv: info.pv,
                  wdl: info.wdl,
                });
                onUpdate?.(snapshot());
              }
            } else if (line.startsWith("bestmove")) {
              const bm = parseBestMove(line);
              finish({
                ...snapshot(),
                bestMove: bm?.bestmove ?? null,
                ponder: bm?.ponder,
                cancelled: job.cancelled,
              });
            }
          });
          const offFatal = this.onFatal((e) => finish(e));

          if (this.applied.get("MultiPV") !== String(multiPv) && (this.option("MultiPV") || !this.identity)) {
            this.post(buildSetOption("MultiPV", multiPv));
            this.applied.set("MultiPV", String(multiPv));
          }
          this.post(buildPosition(fen, request.moves));
          this.post(
            buildGo({
              depth: request.depth,
              movetime: request.movetime,
              nodes: request.nodes,
              infinite: request.infinite,
              searchmoves: request.searchmoves,
            }),
          );
          job.started = true;
        }),
    };

    this.enqueue(job);
    return {
      id,
      result,
      cancel: () => this.cancelJob(job),
    };
  }

  /** Convenience: a finite search that resolves with the final result. */
  analyze(request: SearchRequest, options?: SearchOptions): Promise<SearchResult> {
    return this.search(request, options).result;
  }

  /** Stops the running search and drops queued searches. */
  stop(): void {
    this.cancelSearches();
  }

  dispose(): void {
    const err = new EngineError("Engine was disposed");
    this.fail(err, "disposed");
  }

  // -------------------------------------------------------------------------

  private fatalListeners = new Set<(e: Error) => void>();

  private onFatal(listener: (e: Error) => void): () => void {
    this.fatalListeners.add(listener);
    return () => this.fatalListeners.delete(listener);
  }

  private fail(error: Error, status: EngineStatus = "error") {
    if (this.fatal) return;
    this.fatal = error;
    this.ready = false;
    const queued = this.queue;
    this.queue = [];
    queued.forEach((j) => j.drop(error));
    this.fatalListeners.forEach((l) => l(error));
    this.fatalListeners.clear();
    try {
      this.transport?.terminate();
    } catch {
      /* ignore */
    }
    this.transport = null;
    this.setStatus(status, error);
  }

  private setStatus(status: EngineStatus, error?: Error) {
    this._status = status;
    this.statusListeners.forEach((l) => l(status, error));
  }

  private post(command: string) {
    this.transport?.post(command);
  }

  private addLineListener(listener: (line: string) => void): () => void {
    this.lineListeners.add(listener);
    return () => this.lineListeners.delete(listener);
  }

  /** isready → readyok round trip. */
  private sync(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const offFatal = this.onFatal((e) => {
        off();
        reject(e);
      });
      const off = this.addLineListener((line) => {
        if (line === "readyok") {
          off();
          offFatal();
          resolve();
        }
      });
      this.post("isready");
    });
  }

  private enqueueCommand(fn: () => Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.enqueue({
        kind: "command",
        drop: (reason) => (reason === "cancelled" ? resolve() : reject(reason)),
        run: () => fn().then(resolve, (e) => reject(e)),
      });
    });
  }

  private enqueue(job: Job) {
    if (this.fatal) {
      job.drop(this.fatal);
      return;
    }
    this.queue.push(job);
    if (!this.initPromise) void this.init().catch(() => undefined);
    this.pump();
  }

  private pump() {
    if (!this.ready || this.running || this.fatal) return;
    const job = this.queue.shift();
    if (!job) return;
    this.running = job;
    job
      .run()
      .catch(() => undefined)
      .finally(() => {
        if (this.running === job) this.running = null;
        this.pump();
      });
  }

  private cancelSearches() {
    const dropped = this.queue.filter((j): j is SearchJob => j.kind === "search");
    this.queue = this.queue.filter((j) => j.kind !== "search");
    dropped.forEach((j) => {
      j.cancelled = true;
      j.drop("cancelled");
    });
    if (this.running?.kind === "search") this.stopJob(this.running as SearchJob);
  }

  private cancelJob(job: SearchJob) {
    const idx = this.queue.indexOf(job);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
      job.cancelled = true;
      job.drop("cancelled");
    } else if (this.running === job) {
      this.stopJob(job);
    }
  }

  private stopJob(job: SearchJob) {
    job.cancelled = true;
    if (job.started && !job.stopSent) {
      job.stopSent = true;
      this.post("stop");
    }
  }
}

function sideAfter(fen: string, moves: string[] = []): "w" | "b" {
  const stm = fen.split(" ")[1] === "b" ? "b" : "w";
  if (moves.length % 2 === 0) return stm;
  return stm === "w" ? "b" : "w";
}

function clampSpin(value: number, opt: UciOption): number {
  let v = Math.round(Number.isFinite(value) ? value : Number(opt.default ?? 0));
  if (opt.min !== undefined) v = Math.max(opt.min, v);
  if (opt.max !== undefined) v = Math.min(opt.max, v);
  return v;
}
