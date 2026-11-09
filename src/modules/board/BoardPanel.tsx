"use client";

import { Flag, Gauge, Microscope, Shuffle, Swords, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ELO_PRESETS, MAX_ELO, MIN_ELO, NATIVE_MIN_ELO, strengthName } from "@/core/engine/strength";
import { playSound } from "@/core/sound/sounds";
import { Button, Section, Segmented, Slider, Switch, cx } from "@/components/ui/primitives";
import { useCurrentStatus } from "@/hooks/useGameSelectors";
import { useElo } from "@/stores/elo";
import { useReview } from "@/stores/review";
import { useGame } from "@/stores/game";
import { useSettings } from "@/stores/settings";

type ColorChoice = "w" | "b" | "random";

export function BoardPanel() {
  const mode = useGame((s) => s.mode);
  const eloActive = useElo((s) => s.status === "playing" || s.status === "evaluating");
  if (mode === "play" && eloActive) return <EloInProgress />;
  return mode === "play" ? <PlayingPanel /> : <SetupPanel />;
}

function EloInProgress() {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-surface-3 rounded-xl p-4">
        <p className="font-display text-text text-xl font-extrabold">Elo estimate in progress</p>
        <p className="text-muted mt-1 text-sm">
          This game counts towards your estimate. Its controls are on the Elo page.
        </p>
      </div>
      <Button variant="primary" className="w-full" onClick={() => router.push("/elo")}>
        <Gauge className="size-4" aria-hidden /> Go to Elo estimate
      </Button>
    </div>
  );
}

function SetupPanel() {
  const play = useGame((s) => s.play);
  const startPlay = useGame((s) => s.startPlay);
  const isStart = useGame((s) => s.currentId === s.tree.rootId);
  const status = useCurrentStatus();
  const [color, setColor] = useState<ColorChoice>(play.userColor);
  const [elo, setElo] = useState<number>(play.strength.elo);
  const [fromCurrent, setFromCurrent] = useState(false);
  const sound = useSettings((s) => s.sound);
  const volume = useSettings((s) => s.volume);

  const start = () => {
    const userColor = color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color;
    startPlay({ userColor, strength: { elo } }, { fromCurrent: fromCurrent && !isStart });
    if (sound) playSound("start", volume);
  };

  return (
    <div className="flex flex-col gap-3">
      <Section title="Opponent strength">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="tabular font-display text-text text-[40px] leading-none font-black">{elo}</p>
            <p className="font-display text-accent mt-1 text-sm font-bold">{strengthName(elo)}</p>
          </div>
          <p className="text-faint max-w-[55%] text-right text-[11px] leading-snug">
            {elo < NATIVE_MIN_ELO
              ? "Below 1320 Stockfish is weakened with a shallower search and human-like mistakes."
              : "Uses Stockfish’s built-in UCI_Elo strength limit."}
          </p>
        </div>
        <Slider label="Elo" value={elo} min={MIN_ELO} max={MAX_ELO} step={10} onChange={setElo} />
        <div className="mt-1 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {ELO_PRESETS.map((p) => (
            <button
              key={p.elo}
              type="button"
              onClick={() => setElo(p.elo)}
              aria-pressed={elo === p.elo}
              className={cx(
                "press font-display flex flex-col items-center rounded-lg px-1 py-1.5",
                elo === p.elo
                  ? "press-accent bg-accent text-white"
                  : "bg-surface-3 text-muted hover:text-text",
              )}
            >
              <span className="text-[13px] font-extrabold">{p.elo}</span>
              <span className="text-[10px] font-bold opacity-80">{p.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Your colour">
        <Segmented<ColorChoice>
          label="Your colour"
          value={color}
          onChange={setColor}
          options={[
            {
              value: "w",
              label: (
                <>
                  <span className="ring-border-strong size-3 rounded-sm bg-[var(--eval-white)] ring-1" />
                  White
                </>
              ),
            },
            {
              value: "random",
              label: (
                <>
                  <Shuffle className="size-3.5" aria-hidden />
                  Random
                </>
              ),
            },
            {
              value: "b",
              label: (
                <>
                  <span className="ring-border-strong size-3 rounded-sm bg-[var(--eval-black)] ring-1" />
                  Black
                </>
              ),
            },
          ]}
        />
        <Switch
          checked={fromCurrent && !isStart}
          onChange={setFromCurrent}
          disabled={isStart || status.kind !== "playing"}
          label="Start from the current position"
          description={isStart ? "Set up a position in Analysis first" : "Continue from the board as shown"}
        />
      </Section>

      <Button variant="primary" onClick={start} className="w-full">
        <Swords className="size-5" aria-hidden /> Play
      </Button>
      <p className="text-faint text-center text-xs">
        Want to know your level?{" "}
        <Link href="/elo" className="text-accent font-semibold hover:underline">
          Estimate your Elo
        </Link>
      </p>
    </div>
  );
}

function PlayingPanel() {
  const play = useGame((s) => s.play);
  const result = useGame((s) => s.result);
  const thinking = useGame((s) => s.thinking);
  const { stopPlay, takeback, setResult, startPlay } = useGame.getState();
  const canTakeback = useGame((s) => s.currentId !== s.tree.rootId);
  const status = useCurrentStatus();
  const router = useRouter();
  const over = result !== "*";
  const youWon = (result === "1-0" && play.userColor === "w") || (result === "0-1" && play.userColor === "b");

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cx("animate-in rounded-xl p-4", over && youWon ? "bg-accent text-white" : "bg-surface-3")}
        aria-live="polite"
      >
        <p className={cx("font-display text-sm font-bold", over && youWon ? "opacity-90" : "text-faint")}>
          vs Stockfish · {play.strength.elo} ({strengthName(play.strength.elo)})
        </p>
        <p className="font-display mt-1 text-[28px] leading-tight font-black">
          {over
            ? result === "1/2-1/2"
              ? "Draw"
              : youWon
                ? "You won!"
                : "Stockfish won"
            : thinking
              ? "Stockfish is thinking…"
              : status.turn === play.userColor
                ? "Your move"
                : "Waiting…"}
        </p>
        <p className={cx("mt-0.5 text-sm", over && youWon ? "opacity-90" : "text-muted")}>
          {over
            ? `${result} · ${status.kind === "playing" ? "by resignation" : status.text}`
            : `You play ${play.userColor === "w" ? "White" : "Black"}`}
        </p>
      </div>

      {!over ? (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={takeback} disabled={!canTakeback || thinking}>
            <Undo2 className="size-4" aria-hidden /> Takeback
          </Button>
          <Button variant="danger" onClick={() => setResult(play.userColor === "w" ? "0-1" : "1-0")}>
            <Flag className="size-4" aria-hidden /> Resign
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" onClick={() => startPlay(play)}>
            <Swords className="size-4" aria-hidden /> Rematch
          </Button>
          <Button
            onClick={() => {
              stopPlay();
              useReview.getState().patch({ autoStart: true });
              router.push("/analysis");
            }}
          >
            <Microscope className="size-4" aria-hidden /> Review
          </Button>
        </div>
      )}
      <Button variant="ghost" onClick={stopPlay}>
        {over ? "New game settings" : "Abort game"}
      </Button>
    </div>
  );
}
