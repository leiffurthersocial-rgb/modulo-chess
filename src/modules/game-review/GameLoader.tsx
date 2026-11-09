"use client";

import { FileUp, Microscope } from "lucide-react";
import { useId, useRef, useState } from "react";
import { detectGameInput, type ParsedGame } from "@/core/chess/pgn";
import { createTree } from "@/core/chess/tree";
import { Button, cx } from "@/components/ui/primitives";
import { useGame } from "@/stores/game";
import { useReview } from "@/stores/review";
import { useToasts } from "@/stores/toasts";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function title(g: ParsedGame): string {
  return `${g.headers.White ?? "?"} – ${g.headers.Black ?? "?"}`;
}

/**
 * Paste / upload / drop a game. Loading a PGN starts the review straight away,
 * which also estimates both players' Elo.
 */
export function GameLoader({ compact = false }: { compact?: boolean }) {
  const loadParsed = useGame((s) => s.loadParsed);
  const push = useToasts((s) => s.push);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<ParsedGame[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const loadGame = (g: ParsedGame) => {
    loadParsed(g);
    setChoices(null);
    setError(null);
    setText("");
    const hasMoves = g.tree.nodes[g.tree.rootId].children.length > 0;
    if (hasMoves) useReview.getState().patch({ autoStart: true });
    push({ tone: "success", title: "Game loaded", body: hasMoves ? `${title(g)} · analysing…` : title(g) });
  };

  const load = (input: string) => {
    const d = detectGameInput(input);
    if (d.kind === "error") return setError(d.message);
    if (d.kind === "fen") {
      loadParsed({ headers: {}, tree: createTree(d.fen), result: "*" });
      setText("");
      setError(null);
      push({ tone: "success", title: "Position loaded", body: "Play moves on the board, then analyse." });
      return;
    }
    if (d.games.length === 1) loadGame(d.games[0]);
    else setChoices(d.games);
  };

  const readFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) return setError("That file is larger than 5 MB.");
    load(await file.text());
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className={cx("relative rounded-xl transition-shadow", dragOver && "ring-accent ring-2")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) void readFile(f);
        }}
      >
        <label htmlFor={id} className="sr-only">
          PGN or FEN
        </label>
        <textarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) load(text);
          }}
          spellCheck={false}
          placeholder="Paste a PGN (or a FEN), or drop a .pgn file here…"
          className={cx(
            "scroll-thin bg-surface-2 text-text placeholder:text-faint focus:ring-accent w-full resize-y rounded-xl p-3 font-mono text-[12.5px] leading-relaxed focus:ring-2 focus:outline-none",
            compact ? "h-20" : "h-32",
          )}
        />
        {dragOver ? (
          <div className="bg-accent-soft font-display text-accent pointer-events-none absolute inset-0 grid place-items-center rounded-xl font-bold">
            Drop PGN file
          </div>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button variant="primary" onClick={() => load(text)} disabled={!text.trim()}>
          <Microscope className="size-4" aria-hidden /> Analyse
        </Button>
        <Button onClick={() => fileRef.current?.click()}>
          <FileUp className="size-4" aria-hidden /> Upload
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".pgn,.txt,application/x-chess-pgn,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {choices ? (
        <div className="animate-in">
          <p className="text-faint mb-1.5 text-xs">{choices.length} games in this file — pick one:</p>
          <ul className="scroll-thin flex max-h-56 flex-col gap-1 overflow-y-auto">
            {choices.map((g, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => loadGame(g)}
                  className="hover:bg-surface-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"
                >
                  <span className="tabular text-faint w-6 font-mono text-xs">{i + 1}</span>
                  <span className="text-text truncate">{title(g)}</span>
                  <span className="text-muted ml-auto font-mono text-xs">{g.result}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
