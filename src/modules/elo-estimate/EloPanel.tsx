"use client";

import { Flag, Gauge, Microscope, RotateCcw, Timer, Trophy, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EXPERIENCE_LEVELS, roundElo } from "@/core/analysis/eloEstimate";
import { mainline } from "@/core/chess/tree";
import { strengthName } from "@/core/engine/strength";
import { Button, Section, cx } from "@/components/ui/primitives";
import { useCurrentStatus } from "@/hooks/useGameSelectors";
import { useElo, type EloGameRecord, type EloMode } from "@/stores/elo";
import { useReview } from "@/stores/review";
import { useGame } from "@/stores/game";
import {
  abandonSession,
  nextOpponentElo,
  resetToIntro,
  resignEloGame,
  startEloSession,
  startNextGame,
} from "./session";

export function EloPanel() {
  const status = useElo((s) => s.status);
  if (status === "playing") return <PlayingCard />;
  if (status === "evaluating") return <EvaluatingCard />;
  if (status === "between") return <BetweenCard />;
  if (status === "done") return <ResultCard />;
  return <Intro />;
}

function Intro() {
  const [level, setLevel] = useState<string>("regular");
  const startElo = EXPERIENCE_LEVELS.find((l) => l.id === level)?.elo ?? 1200;
  const start = (mode: EloMode) => startEloSession(mode, startElo);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted text-[15px] leading-relaxed">
        Play Stockfish and we’ll estimate your rating from{" "}
        <b className="text-text">how accurately you play</b> and your results. Every move is checked by the
        engine on your device.
      </p>

      <Section title="1 · How experienced are you?">
        <div role="radiogroup" aria-label="Your experience" className="grid grid-cols-5 gap-1.5">
          {EXPERIENCE_LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={level === l.id}
              aria-label={`${l.label}, first opponent about ${l.elo}`}
              onClick={() => setLevel(l.id)}
              className={cx("chip items-center! px-1! text-center", level === l.id && "chip-active")}
            >
              <span className="font-display text-[13px] font-extrabold">{l.label}</span>
              <span className="tabular text-[11px] opacity-75">~{l.elo}</span>
            </button>
          ))}
        </div>
        <p className="text-faint mt-2 text-xs">
          This only sets the first opponent; it doesn’t affect your estimate.
        </p>
      </Section>

      <Section title="2 · Choose a mode">
        <div className="flex flex-col gap-2.5">
          <ModeCard
            icon={<Timer className="size-5" />}
            title="Quick estimate"
            meta="1 game · ~5–10 min"
            body="The opponent adapts to your level as you play. Faster, but a wider range."
            onStart={() => start("quick")}
            primary
          />
          <ModeCard
            icon={<Trophy className="size-5" />}
            title="Full estimate"
            meta="3 games · ~20–30 min"
            body="Each new opponent is set to your estimate so far. More reliable."
            onStart={() => start("full")}
          />
        </div>
      </Section>

      <History />
    </div>
  );
}

function ModeCard({
  icon,
  title,
  meta,
  body,
  onStart,
  primary,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  body: string;
  onStart: () => void;
  primary?: boolean;
}) {
  return (
    <div className="bg-surface-3 flex items-center gap-3 rounded-xl p-3">
      <span className="bg-accent-soft text-accent grid size-10 shrink-0 place-items-center rounded-xl">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-text text-[16px] font-bold">
          {title} <span className="text-faint ml-1 text-xs font-semibold">{meta}</span>
        </p>
        <p className="text-muted text-xs leading-relaxed">{body}</p>
      </div>
      <Button variant={primary ? "primary" : "secondary"} size="sm" onClick={onStart}>
        Start
      </Button>
    </div>
  );
}

function History() {
  const history = useElo((s) => s.history);
  const clear = useElo((s) => s.clearHistory);
  if (!history.length) return null;
  return (
    <Section
      title="Your past estimates"
      action={
        <button type="button" onClick={clear} className="text-faint hover:text-text text-xs">
          Clear
        </button>
      }
    >
      <ul className="flex flex-col gap-1">
        {history.slice(0, 6).map((h) => (
          <li
            key={h.date}
            className="hover:bg-surface-3 flex items-center justify-between rounded-lg px-2 py-1.5 text-sm"
          >
            <span className="text-muted">
              {new Date(h.date).toLocaleDateString()} · {h.mode === "quick" ? "Quick" : `${h.games} games`}
            </span>
            <span className="tabular text-text font-mono">
              {h.elo}{" "}
              <span className="text-faint">
                ({h.low}–{h.high})
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function SessionHeader() {
  const mode = useElo((s) => s.mode);
  const games = useElo((s) => s.games);
  const total = useElo((s) => s.totalGames);
  return (
    <div className="flex items-center justify-between">
      <p className="font-display text-faint text-sm font-bold tracking-wide uppercase">
        {mode === "quick" ? "Quick estimate" : `Game ${Math.min(games.length + 1, total)} of ${total}`}
      </p>
      {mode === "full" ? (
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={cx("h-1.5 w-6 rounded-full", i < games.length ? "bg-accent" : "bg-surface-hover")}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PlayingCard() {
  const opponentElo = useElo((s) => s.opponentElo);
  const mode = useElo((s) => s.mode);
  const scored = useElo((s) => Object.keys(s.moveScores).length);
  const thinking = useGame((s) => s.thinking);
  const userColor = useGame((s) => s.play.userColor);
  const status = useCurrentStatus();
  const yourTurn = status.turn === userColor;

  return (
    <div className="flex flex-col gap-3">
      <SessionHeader />
      <div className="bg-surface-3 rounded-xl p-4" aria-live="polite">
        <p className="font-display text-text text-[26px] leading-tight font-extrabold">
          {thinking ? "Stockfish is thinking…" : yourTurn ? "Your move" : "Waiting…"}
        </p>
        <p className="text-muted mt-1 text-sm">
          You play {userColor === "w" ? "White" : "Black"} · no takebacks
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Opponent"
          value={String(opponentElo)}
          sub={mode === "quick" ? "adapts to you" : strengthName(opponentElo)}
        />
        <Stat label="Moves assessed" value={String(scored)} sub="book moves skipped" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="danger" onClick={resignEloGame}>
          <Flag className="size-4" aria-hidden /> Resign
        </Button>
        <Button variant="ghost" onClick={abandonSession}>
          <X className="size-4" aria-hidden /> Abandon
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface-3 rounded-xl px-3 py-2.5">
      <p className="text-faint text-xs">{label}</p>
      <p className="tabular font-display text-text text-xl font-extrabold">{value}</p>
      {sub ? <p className="text-faint text-[11px]">{sub}</p> : null}
    </div>
  );
}

function EvaluatingCard() {
  const done = useElo((s) => Object.keys(s.evals).length);
  const total = useGame((s) => mainline(s.tree).length);
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <SessionHeader />
      <div className="bg-surface-3 rounded-xl p-4">
        <p className="font-display text-text text-xl font-extrabold">Checking your moves…</p>
        <div
          className="bg-surface-hover mt-3 h-2 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <div
            className="bg-accent h-full rounded-full transition-[width] duration-[var(--dur)]"
            style={{ width: `${(done / Math.max(1, total)) * 100}%` }}
          />
        </div>
        <p className="text-faint mt-2 text-xs">
          {done} of {total} positions
        </p>
      </div>
    </div>
  );
}

function resultLabel(g: EloGameRecord): string {
  return g.score === 1 ? "Win" : g.score === 0.5 ? "Draw" : "Loss";
}

function GameRows({ games }: { games: EloGameRecord[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {games.map((g, i) => (
        <li
          key={i}
          className="bg-surface-3 grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-3 py-2 text-sm"
        >
          <span
            className={cx(
              "grid size-7 place-items-center rounded-lg text-xs font-bold text-white",
              g.score === 1
                ? "bg-[var(--c-best)]"
                : g.score === 0.5
                  ? "bg-surface-hover"
                  : "bg-[var(--c-blunder)]",
            )}
          >
            {resultLabel(g)[0]}
          </span>
          <span className="text-muted min-w-0 truncate">
            vs {roundElo(g.opponentElo)} · {g.accuracy === null ? "—" : `${g.accuracy.toFixed(1)}% accuracy`}
          </span>
          <span className="tabular text-text font-mono">≈{roundElo(g.estimate)}</span>
        </li>
      ))}
    </ul>
  );
}

function BetweenCard() {
  const games = useElo((s) => s.games);
  const last = games[games.length - 1];
  return (
    <div className="flex flex-col gap-3">
      <SessionHeader />
      <div className="bg-surface-3 rounded-xl p-4">
        <p className="font-display text-text text-[26px] font-extrabold">{resultLabel(last)}</p>
        <p className="text-muted text-sm">Game {games.length} finished.</p>
      </div>
      <GameRows games={games} />
      <Button variant="primary" onClick={startNextGame}>
        Next game vs {nextOpponentElo()}
      </Button>
      <Button variant="ghost" onClick={abandonSession}>
        Stop here
      </Button>
    </div>
  );
}

function ResultCard() {
  const final = useElo((s) => s.final);
  const games = useElo((s) => s.games);
  const mode = useElo((s) => s.mode);
  const router = useRouter();
  if (!final) return <Intro />;
  return (
    <div className="animate-in flex flex-col gap-3">
      <div className="bg-accent rounded-2xl p-5 text-center text-white shadow-[0_6px_0_var(--accent-shadow)]">
        <Gauge className="mx-auto size-6 opacity-90" aria-hidden />
        <p className="mt-1 text-sm font-semibold opacity-90">Estimated rating</p>
        <p className="tabular font-display text-[56px] leading-none font-black">{final.elo}</p>
        <p className="mt-2 text-sm opacity-90">
          likely between {final.low} and {final.high} · {strengthName(final.elo)}
        </p>
      </div>
      <GameRows games={games} />
      <p className="text-faint text-xs leading-relaxed">
        {mode === "quick" ? "One game is a small sample — run the full estimate for a tighter range. " : ""}
        Estimates combine your move accuracy (book moves excluded) with your results against each opponent’s
        Elo. They are approximate and roughly track online rapid ratings.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={resetToIntro}>
          <RotateCcw className="size-4" aria-hidden /> Again
        </Button>
        <Button
          onClick={() => {
            useGame.getState().stopPlay();
            useReview.getState().patch({ autoStart: true });
            router.push("/analysis");
          }}
        >
          <Microscope className="size-4" aria-hidden /> Review game
        </Button>
      </div>
    </div>
  );
}
