"use client";

import { Flag, Microscope, RotateCcw, Shuffle, Swords, Undo2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { playSound } from "@/core/sound/sounds";
import { Button, Section, Segmented, Slider, Switch, cx } from "@/components/ui/primitives";
import { useCurrentStatus } from "@/hooks/useGameSelectors";
import { useGame, type Strength } from "@/stores/game";
import { useSettings } from "@/stores/settings";
import { strengthLabel } from "./PlayController";

type ColorChoice = "w" | "b" | "random";

/** Rough human-readable descriptions of Stockfish's Skill Level. */
function skillHint(level: number): string {
  if (level <= 2) return "Beginner — makes frequent mistakes";
  if (level <= 6) return "Casual club player";
  if (level <= 10) return "Strong club player";
  if (level <= 15) return "Expert / master strength";
  if (level < 20) return "Grandmaster strength";
  return "Full strength";
}

export function BoardPanel() {
  const mode = useGame((s) => s.mode);
  return mode === "play" ? <PlayingPanel /> : <SetupPanel />;
}

function SetupPanel() {
  const play = useGame((s) => s.play);
  const startPlay = useGame((s) => s.startPlay);
  const newGame = useGame((s) => s.newGame);
  const hasMoves = useGame((s) => s.tree.nodes[s.tree.rootId].children.length > 0);
  const isStart = useGame((s) => s.tree.nodes[s.currentId].ply === 0 && s.currentId === s.tree.rootId);
  const status = useCurrentStatus();
  const [color, setColor] = useState<ColorChoice>(play.userColor);
  const [strength, setStrength] = useState<Strength>(play.strength);
  const [fromCurrent, setFromCurrent] = useState(false);
  const sound = useSettings((s) => s.sound);
  const volume = useSettings((s) => s.volume);

  const start = () => {
    const userColor = color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color;
    startPlay({ userColor, strength }, fromCurrent && !isStart);
    if (sound) playSound("start", volume);
  };

  return (
    <div className="flex flex-col gap-3">
      <Section title="Analysis board">
        <p className="text-muted text-sm leading-relaxed">
          Move pieces for both sides freely — every new move from an earlier position becomes a variation.
          Turn on the engine below the board to analyse.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => newGame()} disabled={!hasMoves}>
            <RotateCcw className="size-3.5" aria-hidden /> Reset board
          </Button>
        </div>
      </Section>

      <Section title="Play vs Stockfish">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-text mb-1.5 text-sm">Play as</p>
            <Segmented<ColorChoice>
              label="Your colour"
              value={color}
              onChange={setColor}
              options={[
                {
                  value: "w",
                  label: (
                    <>
                      <span className="ring-border-strong size-2.5 rounded-sm bg-[var(--eval-white)] ring-1" />
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
                      <span className="ring-border-strong size-2.5 rounded-sm bg-[var(--eval-black)] ring-1" />
                      Black
                    </>
                  ),
                },
              ]}
            />
          </div>
          <div>
            <p className="text-text mb-1.5 text-sm">Strength</p>
            <Segmented<"skill" | "elo">
              label="Strength mode"
              size="sm"
              value={strength.kind}
              onChange={(k) =>
                setStrength(k === "elo" ? { kind: "elo", elo: 1500 } : { kind: "skill", level: 8 })
              }
              options={[
                { value: "skill", label: "Skill level" },
                { value: "elo", label: "Elo" },
              ]}
            />
            {strength.kind === "skill" ? (
              <Slider
                label="Skill level"
                value={strength.level}
                min={0}
                max={20}
                onChange={(level) => setStrength({ kind: "skill", level })}
                description={skillHint(strength.level)}
              />
            ) : (
              <Slider
                label="Target Elo"
                value={strength.elo}
                min={1320}
                max={3190}
                step={10}
                onChange={(elo) => setStrength({ kind: "elo", elo })}
                description="Uses UCI_LimitStrength. Stockfish’s Elo scale is calibrated against engines at long time controls."
              />
            )}
          </div>
          <Switch
            checked={fromCurrent && !isStart}
            onChange={setFromCurrent}
            disabled={isStart || status.kind !== "playing"}
            label="Start from current position"
            description={
              isStart ? "Navigate to a position to enable" : "Continue the game from the board as shown"
            }
          />
          <Button
            variant="primary"
            onClick={start}
            disabled={fromCurrent && !isStart && status.kind !== "playing"}
          >
            <Swords className="size-4" aria-hidden /> Start game
          </Button>
        </div>
      </Section>
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
        className={cx(
          "animate-in rounded-2xl p-4 ring-1",
          over
            ? youWon
              ? "bg-accent-soft ring-accent/40"
              : "bg-surface-2/70 ring-border"
            : "bg-surface-2/70 ring-border",
        )}
        aria-live="polite"
      >
        <p className="text-faint text-xs font-semibold tracking-[0.08em] uppercase">
          vs Stockfish · {strengthLabel(play.strength)}
        </p>
        <p className="font-display text-text mt-2 text-[28px] leading-tight">
          {over
            ? result === "1/2-1/2"
              ? "Draw"
              : youWon
                ? "You won"
                : "Stockfish won"
            : thinking
              ? "Stockfish is thinking…"
              : status.turn === play.userColor
                ? "Your move"
                : "Waiting…"}
        </p>
        <p className="text-muted mt-1 text-sm">
          {over
            ? `${result} · ${status.kind === "playing" ? "Resignation" : status.text}`
            : `You play ${play.userColor === "w" ? "White" : "Black"}.`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {!over ? (
          <>
            <Button onClick={takeback} disabled={!canTakeback || thinking}>
              <Undo2 className="size-4" aria-hidden /> Takeback
            </Button>
            <Button variant="danger" onClick={() => setResult(play.userColor === "w" ? "0-1" : "1-0")}>
              <Flag className="size-4" aria-hidden /> Resign
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" onClick={() => startPlay(play, false)}>
              <Swords className="size-4" aria-hidden /> Rematch
            </Button>
            <Button
              onClick={() => {
                stopPlay();
                router.push("/review");
              }}
            >
              <Microscope className="size-4" aria-hidden /> Review game
            </Button>
          </>
        )}
      </div>
      <Button variant="ghost" onClick={stopPlay}>
        Back to analysis board
      </Button>
    </div>
  );
}
