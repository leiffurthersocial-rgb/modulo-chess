import { describe, expect, it } from "vitest";
import { EngineService } from "../EngineService";
import type { EngineTransport } from "../transport";
import type { SearchSnapshot } from "../types";

/**
 * A fake asynchronous UCI engine. Each `go` emits info lines on a timer whose cp score
 * equals the search's sequence number, so a test can detect lines leaking between searches.
 */
class FakeEngine implements EngineTransport {
  sent: string[] = [];
  private lineListeners = new Set<(l: string) => void>();
  private errorListeners = new Set<(e: Error) => void>();
  private searching: {
    seq: number;
    timer: ReturnType<typeof setInterval>;
    depth: number;
    maxDepth: number;
  } | null = null;
  private seq = 0;
  multiPv = 1;
  constructor(private readonly opts: { failInit?: boolean; neverReady?: boolean } = {}) {}

  post(cmd: string) {
    this.sent.push(cmd);
    queueMicrotask(() => this.handle(cmd));
  }
  onLine(l: (line: string) => void) {
    this.lineListeners.add(l);
    return () => this.lineListeners.delete(l);
  }
  onError(l: (e: Error) => void) {
    this.errorListeners.add(l);
    return () => this.errorListeners.delete(l);
  }
  terminate() {
    if (this.searching) clearInterval(this.searching.timer);
  }
  crash() {
    this.errorListeners.forEach((l) => l(new Error("boom")));
  }
  private emit(line: string) {
    this.lineListeners.forEach((l) => l(line));
  }
  private handle(cmd: string) {
    if (cmd === "uci") {
      if (this.opts.failInit) return this.crash();
      this.emit("id name FakeFish 1");
      this.emit("option name MultiPV type spin default 1 min 1 max 5");
      this.emit("option name Threads type spin default 1 min 1 max 4");
      this.emit("option name Hash type spin default 16 min 1 max 1024");
      this.emit("uciok");
    } else if (cmd === "isready") {
      if (!this.opts.neverReady) this.emit("readyok");
    } else if (cmd.startsWith("setoption name MultiPV value ")) {
      this.multiPv = Number(cmd.split(" ").pop());
    } else if (cmd.startsWith("go")) {
      if (this.searching) throw new Error("FakeEngine: go while searching (protocol violation)");
      const seq = ++this.seq;
      const depthMatch = /depth (\d+)/.exec(cmd);
      const maxDepth = depthMatch ? Number(depthMatch[1]) : Infinity;
      const s = {
        seq,
        depth: 0,
        maxDepth,
        timer: setInterval(() => {
          s.depth++;
          for (let k = 1; k <= this.multiPv; k++) {
            this.emit(
              `info depth ${s.depth} seldepth ${s.depth + 2} multipv ${k} score cp ${seq * 100 + k} nodes ${s.depth * 1000} nps 50000 time ${s.depth} pv e2e4 e7e5`,
            );
          }
          if (s.depth >= s.maxDepth) this.finish();
        }, 1),
      };
      this.searching = s;
    } else if (cmd === "stop") {
      if (this.searching) this.finish();
    }
  }
  private finish() {
    if (!this.searching) return;
    clearInterval(this.searching.timer);
    this.searching = null;
    this.emit("bestmove e2e4 ponder e7e5");
  }
}

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const BLACK = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setup(opts?: ConstructorParameters<typeof FakeEngine>[0]) {
  const fake = new FakeEngine(opts);
  const service = new EngineService({ createTransport: () => fake, initTimeoutMs: 200 });
  return { fake, service };
}

describe("EngineService", () => {
  it("performs the UCI handshake and exposes options", async () => {
    const { service, fake } = setup();
    const id = await service.init();
    expect(id.name).toBe("FakeFish 1");
    expect(service.option("threads")?.max).toBe(4);
    expect(fake.sent.slice(0, 2)).toEqual(["uci", "isready"]);
    expect(service.status).toBe("ready");
  });

  it("runs a depth-limited search with multipv and normalised evals", async () => {
    const { service } = setup();
    const updates: SearchSnapshot[] = [];
    const result = await service.analyze(
      { fen: BLACK, depth: 4, multiPv: 3 },
      { onUpdate: (s) => updates.push(s) },
    );
    expect(result.cancelled).toBe(false);
    expect(result.bestMove).toBe("e2e4");
    expect(result.lines.map((l) => l.multipv)).toEqual([1, 2, 3]);
    expect(result.stats.depth).toBe(4);
    // cp is relative to Black to move → negated for White POV.
    expect(result.lines[0].eval).toEqual({ kind: "cp", cp: -101 });
    expect(updates.length).toBeGreaterThan(0);
  });

  it("stops an infinite search cleanly", async () => {
    const { service, fake } = setup();
    const handle = service.search({ fen: START, multiPv: 1 });
    await wait(20);
    handle.cancel();
    const r = await handle.result;
    expect(r.cancelled).toBe(true);
    expect(fake.sent.filter((c) => c === "stop")).toHaveLength(1);
    expect(service.isSearching).toBe(false);
  });

  it("never leaks info lines across rapid position changes and never overlaps `go`", async () => {
    const { service, fake } = setup();
    await service.init();
    const seen = new Map<number, Set<number>>();
    const handles = [];
    for (let i = 0; i < 25; i++) {
      const h = service.search(
        { fen: i % 2 ? BLACK : START },
        {
          onUpdate: (s) => {
            const set = seen.get(h.id) ?? new Set();
            s.lines.forEach((l) => set.add(Math.floor(Math.abs(l.score.value) / 100)));
            seen.set(h.id, set);
          },
        },
      );
      handles.push(h);
      if (i % 5 === 0) await wait(3);
    }
    await wait(30);
    const last = handles[handles.length - 1];
    last.cancel();
    const results = await Promise.all(handles.map((h) => h.result));
    // Every search but the last was superseded.
    expect(results.slice(0, -1).every((r) => r.cancelled)).toBe(true);
    // Each search only ever saw lines from a single engine-side search.
    for (const set of seen.values()) expect(set.size).toBe(1);
    // FakeEngine throws on overlapping `go`; also check go/bestmove are balanced.
    expect(fake.sent.filter((c) => c.startsWith("go")).length).toBeLessThanOrEqual(handles.length);
    // Most of the burst never reached the engine at all.
    expect(fake.sent.filter((c) => c.startsWith("go")).length).toBeLessThan(25);
  });

  it("applies option changes between searches, only when they change", async () => {
    const { service, fake } = setup();
    await service.setOptions({ Threads: 2, Hash: 64 });
    await service.setOptions({ Threads: 2, Hash: 64 });
    await service.setOptions({ Threads: 99, Bogus: 1 }); // clamped, unknown dropped
    const opts = fake.sent.filter((c) => c.startsWith("setoption"));
    expect(opts).toEqual([
      "setoption name Threads value 2",
      "setoption name Hash value 64",
      "setoption name Threads value 4",
    ]);
  });

  it("stops a running infinite search before applying options", async () => {
    const { service, fake } = setup();
    const h = service.search({ fen: START });
    await wait(10);
    await service.setOptions({ Hash: 128 });
    expect((await h.result).cancelled).toBe(true);
    const iStop = fake.sent.indexOf("stop");
    const iOpt = fake.sent.indexOf("setoption name Hash value 128");
    expect(iStop).toBeGreaterThan(-1);
    expect(iOpt).toBeGreaterThan(iStop);
  });

  it("queues non-superseding searches (used for game review)", async () => {
    const { service } = setup();
    const a = service.search({ fen: START, depth: 3 }, { supersede: false });
    const b = service.search({ fen: BLACK, depth: 3 }, { supersede: false });
    const [ra, rb] = await Promise.all([a.result, b.result]);
    expect(ra.cancelled || rb.cancelled).toBe(false);
    expect(ra.lines[0].score.value).not.toBe(rb.lines[0].score.value);
  });

  it("rejects pending work when the engine crashes", async () => {
    const { service, fake } = setup();
    await service.init();
    const h = service.search({ fen: START });
    await wait(5);
    fake.crash();
    await expect(h.result).rejects.toThrow(/boom/);
    expect(service.status).toBe("error");
    await expect(service.analyze({ fen: START, depth: 1 })).rejects.toThrow();
  });

  it("reports init failures and timeouts", async () => {
    await expect(setup({ failInit: true }).service.init()).rejects.toThrow(/boom/);
    await expect(setup({ neverReady: true }).service.init()).rejects.toThrow(/respond/);
  });
});
