"use client";

import { ArrowUpToLine, ListTree, Trash2 } from "lucide-react";
import { memo, useEffect, useRef, type ReactNode } from "react";
import { CLASS_META } from "@/core/analysis/classify";
import { fullMoveNumber, isOnMainline, sideToMove, type GameTree, type MoveNode } from "@/core/chess/tree";
import { EmptyState, IconButton, cx } from "@/components/ui/primitives";
import { useGame } from "@/stores/game";
import { useReview, type MoveReview } from "@/stores/review";

const NAG_SYMBOLS: Record<number, string> = { 1: "!", 2: "?", 3: "!!", 4: "??", 5: "!?", 6: "?!" };

/** Strips PGN command annotations like [%clk 0:03:00] / [%eval 0.3] from comments. */
function cleanComment(c: string): string {
  return c.replace(/\[%[^\]]*\]/g, "").trim();
}

function MoveButton({
  node,
  active,
  review,
  prefix,
  compact,
}: {
  node: MoveNode;
  active: boolean;
  review?: MoveReview;
  prefix?: string;
  compact?: boolean;
}) {
  const goTo = useGame((s) => s.goTo);
  const meta = review ? CLASS_META[review.class] : null;
  const nag = node.nags
    ?.map((n) => NAG_SYMBOLS[n])
    .filter(Boolean)
    .join("");
  const showMark = review && ["inaccuracy", "mistake", "blunder", "best"].includes(review.class);
  return (
    <button
      type="button"
      data-node={node.id}
      data-active={active || undefined}
      onClick={() => goTo(node.id)}
      aria-current={active ? "step" : undefined}
      aria-label={`${prefix ?? ""}${node.san}${meta ? `, ${meta.label}` : ""}`}
      className={cx(
        "inline-flex items-center gap-1 rounded-md font-mono transition-colors duration-[var(--dur-fast)]",
        compact ? "px-1 py-0.5 text-[13px]" : "px-1.5 py-[3px] text-[13.5px]",
        active ? "bg-accent text-accent-ink" : "text-text hover:bg-surface-3",
      )}
    >
      {prefix ? <span className={cx(active ? "opacity-70" : "text-faint")}>{prefix}</span> : null}
      <span>{node.san}</span>
      {nag ? <span className={active ? "" : "text-muted"}>{nag}</span> : null}
      {showMark && meta ? (
        <span
          aria-hidden
          className="ml-0.5 grid size-[15px] place-items-center rounded-full text-[9px] font-bold text-white"
          style={{ background: `var(--c-${review!.class})` }}
        >
          {meta.symbol}
        </span>
      ) : null}
    </button>
  );
}

/** Inline rendering of a variation (and nested sub-variations). */
function VariationLine({
  tree,
  startId,
  currentId,
  reviews,
  depth,
}: {
  tree: GameTree;
  startId: string;
  currentId: string;
  reviews: Record<string, MoveReview>;
  depth: number;
}) {
  const out: ReactNode[] = [];
  let node: MoveNode | undefined = tree.nodes[startId];
  let first = true;
  while (node) {
    const parent: MoveNode = tree.nodes[node.parentId!];
    const white = sideToMove(parent.fen) === "w";
    const num = fullMoveNumber(parent.fen);
    const prefix = white ? `${num}.` : first ? `${num}…` : undefined;
    out.push(
      <MoveButton
        key={node.id}
        node={node}
        active={node.id === currentId}
        review={reviews[node.id]}
        prefix={prefix}
        compact
      />,
    );
    if (node.comment && cleanComment(node.comment)) {
      out.push(
        <span key={`${node.id}c`} className="text-muted px-1 text-xs italic">
          {cleanComment(node.comment)}
        </span>,
      );
    }
    // Sub-variations: alternatives to this node's main continuation.
    const [main, ...alts]: string[] = node.children;
    for (const alt of alts) {
      out.push(
        <span key={`${alt}v`} className="text-faint inline-flex flex-wrap items-center">
          (
          <VariationLine
            tree={tree}
            startId={alt}
            currentId={currentId}
            reviews={reviews}
            depth={depth + 1}
          />
          )
        </span>,
      );
    }
    first = false;
    node = main ? tree.nodes[main] : undefined;
    if (alts.length) first = true;
  }
  return <>{out}</>;
}

function VariationBlock({ children, depth = 0 }: { children: ReactNode; depth?: number }) {
  return (
    <div
      className="border-border-strong/70 bg-surface-2/50 col-span-3 my-0.5 flex flex-wrap items-center gap-x-0.5 gap-y-0.5 border-l-2 py-1 pr-2 pl-2.5"
      style={{ marginLeft: depth * 8 }}
    >
      {children}
    </div>
  );
}

function MoveListImpl() {
  const tree = useGame((s) => s.tree);
  const currentId = useGame((s) => s.currentId);
  const result = useGame((s) => s.result);
  const reviews = useReview((s) => s.moves);
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the active move visible without scrolling the page.
  useEffect(() => {
    const el = scroller.current;
    const active = el?.querySelector<HTMLElement>(`[data-node="${currentId}"]`);
    if (!el || !active) {
      if (el && currentId === tree.rootId) el.scrollTop = 0;
      return;
    }
    const a = active.getBoundingClientRect();
    const c = el.getBoundingClientRect();
    if (a.top < c.top + 8) el.scrollTop -= c.top + 8 - a.top;
    else if (a.bottom > c.bottom - 8) el.scrollTop += a.bottom - (c.bottom - 8);
  }, [currentId, tree]);

  const root = tree.nodes[tree.rootId];
  const rows: ReactNode[] = [];

  if (root.comment && cleanComment(root.comment)) {
    rows.push(
      <p key="rootc" className="text-muted col-span-3 px-2 py-1 text-xs italic">
        {cleanComment(root.comment)}
      </p>,
    );
  }

  let parent: MoveNode = root;
  let pendingWhite: MoveNode | null = null;
  let pendingNum = 0;

  const flush = (num: number, w: MoveNode | null, b: MoveNode | null, key: string) => {
    rows.push(
      <div key={key} className="contents">
        <span className="tabular text-faint flex items-center justify-end pr-2 font-mono text-xs select-none">
          {num}
        </span>
        <span className="flex min-w-0 items-center">
          {w ? (
            <MoveButton node={w} active={w.id === currentId} review={reviews[w.id]} />
          ) : (
            <span className="text-faint px-1.5">…</span>
          )}
        </span>
        <span className="flex min-w-0 items-center">
          {b ? <MoveButton node={b} active={b.id === currentId} review={reviews[b.id]} /> : null}
        </span>
      </div>,
    );
  };

  while (parent.children.length) {
    const [mainId, ...alts] = parent.children;
    const main = tree.nodes[mainId];
    const num = fullMoveNumber(parent.fen);
    const white = sideToMove(parent.fen) === "w";
    const comment = main.comment ? cleanComment(main.comment) : "";
    const interrupt = alts.length > 0 || Boolean(comment);

    if (white) {
      pendingWhite = main;
      pendingNum = num;
      if (interrupt) {
        flush(num, main, null, `r${main.id}`);
        pendingWhite = null;
      }
    } else {
      flush(num, pendingWhite, main, `r${main.id}`);
      pendingWhite = null;
    }
    if (comment) {
      rows.push(
        <p key={`${main.id}c`} className="text-muted col-span-3 px-2 py-1 text-xs leading-relaxed italic">
          {comment}
        </p>,
      );
    }
    for (const alt of alts) {
      rows.push(
        <VariationBlock key={`${alt}vb`}>
          <VariationLine tree={tree} startId={alt} currentId={currentId} reviews={reviews} depth={1} />
        </VariationBlock>,
      );
    }
    parent = main;
  }
  if (pendingWhite) flush(pendingNum, pendingWhite, null, `r${pendingWhite.id}end`);

  if (!root.children.length) {
    return (
      <EmptyState icon={<ListTree className="size-5" />} title="No moves yet">
        Make a move on the board, or import a PGN to start analysing.
      </EmptyState>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scroller}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto px-1 py-1"
        aria-label="Move list"
      >
        <div className="grid grid-cols-[2.25rem_1fr_1fr] items-center gap-y-0.5">{rows}</div>
        {result !== "*" ? (
          <p
            className="text-muted mt-2 text-center font-mono text-sm font-semibold"
            aria-label={`Result ${result}`}
          >
            {result}
          </p>
        ) : null}
      </div>
      <VariationTools />
    </div>
  );
}

function VariationTools() {
  const tree = useGame((s) => s.tree);
  const currentId = useGame((s) => s.currentId);
  const mode = useGame((s) => s.mode);
  const { deleteFrom, promote } = useGame.getState();
  const node = tree.nodes[currentId];
  if (!node.parentId || mode === "play") return null;
  const mainline = isOnMainline(tree, currentId);
  return (
    <div className="border-border flex items-center justify-end gap-0.5 border-t px-2 py-1">
      <span className="text-faint mr-auto truncate text-xs">{mainline ? "Main line" : "Variation"}</span>
      {!mainline ? (
        <IconButton label="Promote variation" onClick={() => promote(currentId)}>
          <ArrowUpToLine className="size-4" />
        </IconButton>
      ) : null}
      <IconButton label="Delete from this move" onClick={() => deleteFrom(currentId)}>
        <Trash2 className="size-4" />
      </IconButton>
    </div>
  );
}

export const MoveList = memo(MoveListImpl);
