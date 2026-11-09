"use client";

import { Check, ClipboardCopy, Download, FileUp, RotateCcw, Upload } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { checkFen, parsePgn, serializePgn, PgnError, type ParsedGame } from "@/core/chess/pgn";
import { createTree } from "@/core/chess/tree";
import { Button, Section, cx } from "@/components/ui/primitives";
import { useCurrentNode } from "@/hooks/useGameSelectors";
import { useGame } from "@/stores/game";
import { useToasts } from "@/stores/toasts";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

type Detected =
  { kind: "fen"; fen: string } | { kind: "pgn"; games: ParsedGame[] } | { kind: "error"; message: string };

/** FEN if it validates as one, otherwise PGN. */
export function detectInput(text: string): Detected {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "error", message: "Paste a PGN or a FEN first." };
  const looksLikeFen = /^[rnbqkpRNBQKP1-8]+(\/[rnbqkpRNBQKP1-8]+){7}\s+[wb]\b/.test(trimmed);
  if (looksLikeFen) {
    const r = checkFen(trimmed);
    return r.ok ? { kind: "fen", fen: r.fen } : { kind: "error", message: `Invalid FEN: ${r.error}` };
  }
  try {
    return { kind: "pgn", games: parsePgn(trimmed) };
  } catch (e) {
    const msg = e instanceof PgnError ? e.message : "Could not read this PGN.";
    return { kind: "error", message: msg };
  }
}

function gameTitle(g: ParsedGame, i: number): string {
  const w = g.headers.White ?? "?";
  const b = g.headers.Black ?? "?";
  const parts = [`${w} – ${b}`];
  if (g.headers.Date && g.headers.Date !== "????.??.??") parts.push(g.headers.Date.slice(0, 4));
  return parts.join(" · ") || `Game ${i + 1}`;
}

export function ImportExportPanel() {
  const loadParsed = useGame((s) => s.loadParsed);
  const push = useToasts((s) => s.push);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<ParsedGame[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textId = useId();

  const loadGame = (g: ParsedGame) => {
    loadParsed(g);
    setChoices(null);
    setError(null);
    const moves = Object.keys(g.tree.nodes).length - 1;
    push({ tone: "success", title: "Game loaded", body: `${gameTitle(g, 0)} · ${moves} moves` });
  };

  const importText = (input: string) => {
    const d = detectInput(input);
    if (d.kind === "error") {
      setError(d.message);
      return;
    }
    setError(null);
    if (d.kind === "fen") {
      const tree = createTree(d.fen);
      loadParsed({ headers: {}, tree, result: "*" });
      push({ tone: "success", title: "Position loaded" });
      setText("");
      return;
    }
    setText("");
    if (d.games.length === 1) loadGame(d.games[0]);
    else setChoices(d.games);
  };

  const readFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is larger than 5 MB.");
      return;
    }
    importText(await file.text());
  };

  return (
    <div className="flex flex-col gap-3">
      <Section title="Import">
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
          <label htmlFor={textId} className="sr-only">
            PGN or FEN
          </label>
          <textarea
            id={textId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) importText(text);
            }}
            spellCheck={false}
            placeholder={
              "Paste PGN or FEN…\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *\nor\nrnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2"
            }
            className="scroll-thin bg-surface text-text ring-border-strong placeholder:text-faint focus:ring-accent h-36 w-full resize-y rounded-xl p-3 font-mono text-[12.5px] leading-relaxed ring-1 focus:ring-2 focus:outline-none"
          />
          {dragOver ? (
            <div className="bg-accent-soft text-accent pointer-events-none absolute inset-0 grid place-items-center rounded-xl text-sm font-medium">
              Drop PGN file
            </div>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-danger mt-2 text-xs">
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={() => importText(text)} disabled={!text.trim()}>
            <Upload className="size-3.5" aria-hidden /> Load
          </Button>
          <Button size="sm" onClick={() => fileRef.current?.click()}>
            <FileUp className="size-3.5" aria-hidden /> Open .pgn file
          </Button>
          <Button size="sm" variant="ghost" onClick={() => useGame.getState().newGame()}>
            <RotateCcw className="size-3.5" aria-hidden /> Reset board
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
          <div className="animate-in mt-4">
            <p className="text-faint mb-2 text-xs">{choices.length} games found — pick one:</p>
            <ul className="scroll-thin flex max-h-56 flex-col gap-1 overflow-y-auto">
              {choices.map((g, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => loadGame(g)}
                    className="hover:bg-surface-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"
                  >
                    <span className="tabular text-faint w-6 font-mono text-xs">{i + 1}</span>
                    <span className="text-text truncate">{gameTitle(g, i)}</span>
                    <span className="text-muted ml-auto font-mono text-xs">{g.result}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>
      <ExportSection />
    </div>
  );
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const push = useToasts((s) => s.push);
  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      push({ tone: "error", title: "Clipboard unavailable", body: "Select the text and copy it manually." });
    }
  };
  return { copied, copy };
}

function ExportSection() {
  const tree = useGame((s) => s.tree);
  const headers = useGame((s) => s.headers);
  const result = useGame((s) => s.result);
  const node = useCurrentNode();
  const { copied, copy } = useCopy();
  const pgn = useMemo(
    () =>
      serializePgn(tree, {
        headers: { Event: "Modulo: Chess analysis", Site: "Modulo: Chess", ...headers },
        result,
      }),
    [tree, headers, result],
  );

  const download = () => {
    const blob = new Blob([pgn], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const name = [headers.White, headers.Black].filter((x) => x && x !== "?").join("-vs-") || "modulo-game";
    a.href = url;
    a.download = `${name.replace(/[^\w.-]+/g, "_")}.pgn`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Section title="Export">
      <p className="text-faint mb-1.5 text-xs">FEN (current position)</p>
      <div className="flex items-center gap-2">
        <code className="scroll-thin bg-surface text-text ring-border min-w-0 flex-1 overflow-x-auto rounded-lg px-2.5 py-2 font-mono text-[12px] whitespace-nowrap ring-1">
          {node.fen}
        </code>
        <Button size="sm" onClick={() => copy("fen", node.fen)} aria-label="Copy FEN">
          {copied === "fen" ? <Check className="size-3.5" /> : <ClipboardCopy className="size-3.5" />}
        </Button>
      </div>
      <p className="text-faint mt-4 mb-1.5 text-xs">PGN (with variations and comments)</p>
      <textarea
        readOnly
        value={pgn}
        aria-label="PGN"
        className="scroll-thin bg-surface text-text ring-border h-36 w-full resize-y rounded-xl p-3 font-mono text-[12px] leading-relaxed ring-1"
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={() => copy("pgn", pgn)}>
          {copied === "pgn" ? <Check className="size-3.5" /> : <ClipboardCopy className="size-3.5" />}
          {copied === "pgn" ? "Copied" : "Copy PGN"}
        </Button>
        <Button size="sm" onClick={download}>
          <Download className="size-3.5" aria-hidden /> Download .pgn
        </Button>
      </div>
    </Section>
  );
}
