"use client";

import { Keyboard, Monitor, Moon, RotateCcw, Sun, Volume2 } from "lucide-react";
import { OPEN_SHORTCUTS_EVENT } from "@/components/shell/events";
import { STOCKFISH_VERSION } from "@/core/engine/assets";
import { playSound } from "@/core/sound/sounds";
import { Button, Section, Segmented, Slider, Switch, cx } from "@/components/ui/primitives";
import { useEngine } from "@/stores/engine";
import { useSettings, type ThemeMode } from "@/stores/settings";
import { BOARD_THEMES } from "@/themes/boards";
import { PIECE_SETS, pieceUrl } from "@/themes/pieces";
import type { FlavorPreference } from "@/core/engine/browser";

export function SettingsPanel() {
  const s = useSettings();
  const flavor = useEngine((e) => e.flavor);
  const notice = useEngine((e) => e.notice);

  return (
    <div className="flex flex-col gap-3">
      <Section title="Appearance">
        <p className="text-text mb-1.5 text-sm">Theme</p>
        <Segmented<ThemeMode>
          label="Colour theme"
          value={s.theme}
          onChange={(theme) => s.set({ theme })}
          options={[
            {
              value: "dark",
              label: (
                <>
                  <Moon className="size-3.5" aria-hidden />
                  Dark
                </>
              ),
            },
            {
              value: "light",
              label: (
                <>
                  <Sun className="size-3.5" aria-hidden />
                  Light
                </>
              ),
            },
            {
              value: "system",
              label: (
                <>
                  <Monitor className="size-3.5" aria-hidden />
                  System
                </>
              ),
            },
          ]}
        />

        <p className="text-text mt-4 mb-2 text-sm">Board</p>
        <div role="radiogroup" aria-label="Board theme" className="grid grid-cols-5 gap-2">
          {BOARD_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={s.boardTheme === t.id}
              aria-label={t.name}
              title={t.name}
              onClick={() => s.set({ boardTheme: t.id })}
              className={cx(
                "group flex flex-col items-center gap-1.5 rounded-xl p-1.5 transition-colors",
                s.boardTheme === t.id ? "bg-accent-soft ring-accent ring-1" : "hover:bg-surface-3",
              )}
            >
              <span className="grid aspect-square w-full grid-cols-2 overflow-hidden rounded-lg">
                <span style={{ background: t.light }} />
                <span style={{ background: t.dark }} />
                <span style={{ background: t.dark }} />
                <span style={{ background: t.light }} />
              </span>
              <span className="text-muted text-[10.5px]">{t.name}</span>
            </button>
          ))}
        </div>

        <p className="text-text mt-4 mb-2 text-sm">Pieces</p>
        <div role="radiogroup" aria-label="Piece set" className="grid grid-cols-4 gap-2">
          {PIECE_SETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={s.pieceSet === p.id}
              aria-label={`${p.name} by ${p.author}`}
              title={`${p.name} — ${p.author} (${p.license})`}
              onClick={() => s.set({ pieceSet: p.id })}
              className={cx(
                "flex flex-col items-center gap-1 rounded-xl p-1.5 transition-colors",
                s.pieceSet === p.id ? "bg-accent-soft ring-accent ring-1" : "hover:bg-surface-3",
              )}
            >
              <span className="flex">
                <span
                  className="size-8 bg-contain"
                  style={{ backgroundImage: `url(${pieceUrl(p.id, "w", "n")})` }}
                />
                <span
                  className="-ml-2 size-8 bg-contain"
                  style={{ backgroundImage: `url(${pieceUrl(p.id, "b", "q")})` }}
                />
              </span>
              <span className="text-muted text-[10.5px]">{p.name}</span>
            </button>
          ))}
        </div>

        <div className="divide-border mt-3 divide-y">
          <Switch
            checked={s.showCoordinates}
            onChange={(v) => s.set({ showCoordinates: v })}
            label="Coordinates"
          />
          <Switch
            checked={s.showLegalMoves}
            onChange={(v) => s.set({ showLegalMoves: v })}
            label="Show legal moves"
          />
          <Switch
            checked={s.showEvalBar}
            onChange={(v) => s.set({ showEvalBar: v })}
            label="Evaluation bar"
          />
          <Switch
            checked={s.showArrows}
            onChange={(v) => s.set({ showArrows: v })}
            label="Engine arrows"
            description="Best-move arrows for each line"
          />
          <Switch
            checked={s.animations}
            onChange={(v) => s.set({ animations: v })}
            label="Piece animation"
            description="Always off when your system requests reduced motion"
          />
        </div>
      </Section>

      <Section title="Sound">
        <div className="divide-border divide-y">
          <Switch
            checked={s.sound}
            onChange={(v) => s.set({ sound: v })}
            label="Move sounds"
            description="Move, capture, check and game end"
          />
        </div>
        <div className={cx("flex items-end gap-3", !s.sound && "opacity-50")}>
          <div className="flex-1">
            <Slider
              label="Volume"
              value={Math.round(s.volume * 100)}
              min={0}
              max={100}
              onChange={(v) => s.set({ volume: v / 100 })}
              format={(v) => `${v}%`}
              disabled={!s.sound}
            />
          </div>
          <Button
            size="sm"
            className="mb-2"
            disabled={!s.sound}
            onClick={() => playSound("capture", s.volume)}
          >
            <Volume2 className="size-3.5" aria-hidden /> Test
          </Button>
        </div>
      </Section>

      <Section title="Engine">
        <p className="text-text mb-1.5 text-sm">Build</p>
        <Segmented<FlavorPreference>
          label="Engine build"
          size="sm"
          value={s.engine.flavor}
          onChange={(flavor) => s.setEngine({ flavor })}
          options={[
            { value: "auto", label: "Auto" },
            { value: "multi", label: "Multi-threaded" },
            { value: "single", label: "Single-threaded" },
          ]}
        />
        <p className="text-faint mt-2 text-xs leading-relaxed">
          Stockfish {STOCKFISH_VERSION} (lite NNUE).{" "}
          {flavor
            ? `Running the ${flavor === "multi" ? "multi" : "single"}-threaded build.`
            : "Loads when you start analysis."}{" "}
          {notice ?? ""}
        </p>
        <Slider
          label="Game review depth"
          value={s.reviewDepth}
          min={8}
          max={22}
          onChange={(v) => s.set({ reviewDepth: v })}
        />
        <p className="text-faint text-xs">Threads, hash, lines and depth limit are in the Engine panel.</p>
      </Section>

      <Section title="Keyboard">
        <p className="text-muted mb-3 text-sm">
          Arrow keys step through moves, F flips the board, E toggles the engine.
        </p>
        <Button size="sm" onClick={() => window.dispatchEvent(new Event(OPEN_SHORTCUTS_EVENT))}>
          <Keyboard className="size-4" aria-hidden /> All shortcuts
        </Button>
      </Section>

      <Section title="About & licences">
        <div className="text-muted space-y-2 text-xs leading-relaxed">
          <p>
            <b className="text-text">Modulo: Chess</b> is MIT-licensed. The chess engine is{" "}
            <a
              className="text-accent underline-offset-2 hover:underline"
              href="https://github.com/official-stockfish/Stockfish"
              target="_blank"
              rel="noreferrer"
            >
              Stockfish
            </a>{" "}
            (GPLv3), compiled to WebAssembly by{" "}
            <a
              className="text-accent underline-offset-2 hover:underline"
              href="https://github.com/nmrugg/stockfish.js"
              target="_blank"
              rel="noreferrer"
            >
              stockfish.js
            </a>
            . Its source and licence are served with the app at{" "}
            <a
              className="text-accent underline-offset-2 hover:underline"
              href={`/stockfish/${STOCKFISH_VERSION}/COPYING.txt`}
              target="_blank"
              rel="noreferrer"
            >
              /stockfish/{STOCKFISH_VERSION}/COPYING.txt
            </a>
            .
          </p>
          <ul className="space-y-1">
            {PIECE_SETS.map((p) => (
              <li key={p.id}>
                <span className="text-text">{p.name}</span> pieces by{" "}
                <a
                  className="underline-offset-2 hover:underline"
                  href={p.source}
                  target="_blank"
                  rel="noreferrer"
                >
                  {p.author}
                </a>{" "}
                ·{" "}
                <a
                  className="underline-offset-2 hover:underline"
                  href={p.licenseUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {p.license}
                </a>
              </li>
            ))}
            <li>
              Opening names: <span className="text-text">lichess-org/chess-openings</span> · CC0
            </li>
          </ul>
        </div>
        <Button size="sm" variant="ghost" className="mt-3 -ml-2" onClick={s.reset}>
          <RotateCcw className="size-3.5" aria-hidden /> Reset all settings
        </Button>
      </Section>
    </div>
  );
}
