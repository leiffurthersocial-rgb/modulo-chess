"use client";

import { Chess, type Square } from "chess.js";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { boardTheme } from "@/themes/boards";
import { pieceUrl } from "@/themes/pieces";
import { Arrows, type BoardArrow } from "./Arrows";
import { legalDests, matchPieces, pieceName, squareToXY, xyToSquare, type PlacedPiece } from "./pieces";
import { PromotionDialog, type PromotionPiece } from "./PromotionDialog";

export interface BoardMove {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
}

export interface BoardBadge {
  square: string;
  label: string;
  color: string;
  title: string;
}

export interface BoardProps {
  fen: string;
  orientation: "w" | "b";
  /** Whether the user may move pieces. */
  interactive: boolean;
  /** Restrict which side the user may move (defaults to side to move). */
  movableColor?: "w" | "b";
  lastMove?: { from: string; to: string } | null;
  arrows?: BoardArrow[];
  badge?: BoardBadge | null;
  pieceSet: string;
  theme: string;
  showCoordinates?: boolean;
  showLegalMoves?: boolean;
  /** Returns true if the move was accepted. */
  onMove: (move: BoardMove) => boolean;
  /** Called when the user attempts an illegal move. */
  onIllegal?: () => void;
  ariaLabel?: string;
  className?: string;
}

interface DragState {
  from: Square;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
  wasSelected: boolean;
  pieceId: string;
}

function BoardImpl({
  fen,
  orientation,
  interactive,
  movableColor,
  lastMove,
  arrows = [],
  badge,
  pieceSet,
  theme,
  showCoordinates = true,
  showLegalMoves = true,
  onMove,
  onIllegal,
  ariaLabel,
  className,
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const pieceEls = useRef(new Map<string, HTMLDivElement>());
  const drag = useRef<DragState | null>(null);

  // Stable piece identities across positions (adjust-state-during-render pattern).
  const [pieces, setPieces] = useState<PlacedPiece[]>(() => matchPieces([], fen));
  const [piecesFen, setPiecesFen] = useState(fen);
  if (piecesFen !== fen) {
    setPiecesFen(fen);
    setPieces(matchPieces(pieces, fen));
  }

  const [selected, setSelected] = useState<Square | null>(null);
  const [hover, setHover] = useState<Square | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [focusSq, setFocusSq] = useState<Square>(orientation === "w" ? "e2" : "e7");
  const [hasFocus, setHasFocus] = useState(false);

  // Reset transient interaction state when the position or interactivity changes.
  const [resetKey, setResetKey] = useState(`${fen}|${interactive}`);
  if (resetKey !== `${fen}|${interactive}`) {
    setResetKey(`${fen}|${interactive}`);
    setSelected(null);
    setHover(null);
    setDragging(null);
    setPromotion(null);
  }

  const turn = fen.split(" ")[1] === "b" ? "b" : "w";
  const mover = movableColor ?? turn;
  const canMove = interactive && mover === turn;
  const dests = useMemo(() => (canMove ? legalDests(fen) : new Map()), [fen, canMove]);
  const pieceAt = useMemo(() => new Map(pieces.map((p) => [p.square, p])), [pieces]);
  const selectedDests = selected ? (dests.get(selected) ?? []) : [];
  const t = boardTheme(theme);

  const squareFromPoint = useCallback(
    (clientX: number, clientY: number): Square | null => {
      const el = boardRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const x = Math.floor(((clientX - r.left) / r.width) * 8);
      const y = Math.floor(((clientY - r.top) / r.height) * 8);
      return xyToSquare(x, y, orientation);
    },
    [orientation],
  );

  const attemptMove = (from: Square, to: Square): boolean => {
    const options = dests.get(from) ?? [];
    const target = options.find((d: { to: Square }) => d.to === to);
    if (!target) {
      if (from !== to) onIllegal?.();
      return false;
    }
    if (target.promotion) {
      setPromotion({ from, to });
      return true;
    }
    setSelected(null);
    return onMove({ from, to });
  };

  const resetPieceTransform = (id: string) => {
    const el = pieceEls.current.get(id);
    const p = pieces.find((x) => x.id === id);
    if (el && p) {
      const { x, y } = squareToXY(p.square, orientation);
      el.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
    }
  };

  // ── Pointer interaction ──────────────────────────────────────────────────

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || promotion) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const sq = squareFromPoint(e.clientX, e.clientY);
    if (!sq) return;
    setFocusSq(sq);
    // Click-to-move onto a destination of the selected piece.
    if (selected && selectedDests.some((d: { to: Square }) => d.to === sq)) {
      e.preventDefault();
      attemptMove(selected, sq);
      return;
    }
    const piece = pieceAt.get(sq);
    if (piece && canMove && piece.color === turn && dests.has(sq)) {
      e.preventDefault();
      boardRef.current?.setPointerCapture(e.pointerId);
      drag.current = {
        from: sq,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
        wasSelected: selected === sq,
        pieceId: piece.id,
      };
      setSelected(sq);
      return;
    }
    setSelected(null);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
      d.active = true;
      setDragging(d.pieceId);
    }
    const el = pieceEls.current.get(d.pieceId);
    const board = boardRef.current;
    if (el && board) {
      const r = board.getBoundingClientRect();
      const size = r.width / 8;
      const px = e.clientX - r.left - size / 2;
      const py = e.clientY - r.top - size / 2;
      el.style.transform = `translate(${px}px, ${py}px) scale(1.08)`;
    }
    const sq = squareFromPoint(e.clientX, e.clientY);
    setHover((h) => (h === sq ? h : sq));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    boardRef.current?.releasePointerCapture?.(e.pointerId);
    setHover(null);
    if (d.active) {
      setDragging(null);
      const to = cancelled ? null : squareFromPoint(e.clientX, e.clientY);
      const moved = to && to !== d.from ? attemptMove(d.from, to) : false;
      if (!moved) resetPieceTransform(d.pieceId);
      if (!moved && to === d.from) setSelected(d.from);
    } else if (d.wasSelected) {
      setSelected(null);
    }
  };

  // ── Keyboard interaction (roving cursor + Enter/Space) ───────────────────

  const activateSquare = (sq: Square) => {
    if (!interactive) return;
    if (selected && selectedDests.some((d: { to: Square }) => d.to === sq)) {
      attemptMove(selected, sq);
      return;
    }
    const piece = pieceAt.get(sq);
    if (piece && canMove && piece.color === turn && dests.has(sq)) setSelected(selected === sq ? null : sq);
    else setSelected(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const { x, y } = squareToXY(focusSq, orientation);
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    if (moves[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      const [dx, dy] = moves[e.key];
      const next = xyToSquare(
        Math.max(0, Math.min(7, x + dx)),
        Math.max(0, Math.min(7, y + dy)),
        orientation,
      );
      if (next) setFocusSq(next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      activateSquare(focusSq);
    } else if (e.key === "Escape" && selected) {
      e.stopPropagation();
      setSelected(null);
    }
  };

  // Keep drag-transforms in sync if orientation flips mid-interaction.
  useEffect(() => {
    drag.current = null;
  }, [orientation]);

  // ── Render ───────────────────────────────────────────────────────────────

  const squares: { sq: Square; x: number; y: number; dark: boolean }[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const sq = xyToSquare(x, y, orientation)!;
      const file = sq.charCodeAt(0) - 97;
      const rank = Number(sq[1]) - 1;
      squares.push({ sq, x, y, dark: (file + rank) % 2 === 0 });
    }
  }

  const destSet = new Map(selectedDests.map((d: { to: Square }) => [d.to, true]));
  const sideName = turn === "w" ? "White" : "Black";
  const promoColor = promotion ? (pieceAt.get(promotion.from)?.color ?? turn) : turn;

  const describe = (sq: Square) => {
    const p = pieceAt.get(sq);
    const parts = [sq, p ? `${p.color === "w" ? "white" : "black"} ${pieceName(p.type)}` : "empty"];
    if (selected === sq) parts.push("selected");
    if (destSet.has(sq)) parts.push(p ? "capture available" : "legal move");
    if (lastMove && (lastMove.from === sq || lastMove.to === sq)) parts.push("last move");
    return parts.join(", ");
  };

  const style = {
    "--sq-light": t.light,
    "--sq-dark": t.dark,
  } as CSSProperties;

  return (
    <div className={`board-wrap ${className ?? ""}`}>
      <div
        ref={boardRef}
        className="board"
        style={style}
        data-board
        data-interactive={interactive}
        data-dragging={dragging ? "true" : "false"}
        role="grid"
        aria-label={
          ariaLabel ??
          `Chess board. ${sideName} to move. Use arrow keys to move the cursor, Enter to pick up and place a piece.`
        }
        aria-activedescendant={hasFocus ? `sq-${focusSq}` : undefined}
        tabIndex={0}
        onFocus={() => setHasFocus(true)}
        onBlur={() => setHasFocus(false)}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e)}
        onPointerCancel={(e) => endDrag(e, true)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="board-squares">
          {Array.from({ length: 8 }, (_, row) => (
            <div key={row} role="row" style={{ display: "contents" }}>
              {squares.slice(row * 8, row * 8 + 8).map(({ sq, x, y, dark }) => {
                const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
                const isDest = showLegalMoves && destSet.has(sq);
                const occupied = pieceAt.has(sq);
                const p = pieceAt.get(sq);
                return (
                  <div
                    key={sq}
                    id={`sq-${sq}`}
                    role="gridcell"
                    aria-label={describe(sq)}
                    aria-selected={selected === sq}
                    className="board-square"
                    data-dark={dark}
                    data-square={sq}
                    data-movable={canMove && p?.color === turn && dests.has(sq) ? "true" : undefined}
                  >
                    {isLast ? <div className="hl hl-last" /> : null}
                    {selected === sq ? <div className="hl hl-selected" /> : null}
                    {isDest ? <div className={`hl ${occupied ? "hl-capture" : "hl-dest"}`} /> : null}
                    {dragging && hover === sq ? <div className="hl hl-hover" /> : null}
                    {hasFocus && focusSq === sq ? <div className="hl hl-focus" /> : null}
                    {showCoordinates && y === 7 ? (
                      <span className="board-coord file" style={{ color: dark ? t.coordDark : t.coordLight }}>
                        {sq[0]}
                      </span>
                    ) : null}
                    {showCoordinates && x === 0 ? (
                      <span className="board-coord rank" style={{ color: dark ? t.coordDark : t.coordLight }}>
                        {sq[1]}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <CheckHighlight fen={fen} orientation={orientation} />

        <div className="board-pieces" aria-hidden>
          {pieces.map((p) => {
            const { x, y } = squareToXY(p.square, orientation);
            const isDragging = dragging === p.id;
            return (
              <div
                key={p.id}
                ref={(el) => {
                  if (el) pieceEls.current.set(p.id, el);
                  else pieceEls.current.delete(p.id);
                }}
                className="piece"
                data-dragging={isDragging ? "true" : undefined}
                style={{
                  backgroundImage: `url(${pieceUrl(pieceSet, p.color, p.type)})`,
                  ...(isDragging ? {} : { transform: `translate(${x * 100}%, ${y * 100}%)` }),
                }}
              />
            );
          })}
        </div>

        <Arrows arrows={arrows} orientation={orientation} />

        {badge ? <Badge badge={badge} orientation={orientation} /> : null}

        {promotion ? (
          <PromotionDialog
            square={promotion.to}
            color={promoColor}
            orientation={orientation}
            pieceSet={pieceSet}
            onCancel={() => {
              setPromotion(null);
              setSelected(null);
              setPieces(matchPieces(pieces, fen));
            }}
            onSelect={(piece) => {
              const { from, to } = promotion;
              setPromotion(null);
              setSelected(null);
              if (!onMove({ from, to, promotion: piece })) setPieces(matchPieces(pieces, fen));
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function Badge({ badge, orientation }: { badge: BoardBadge; orientation: "w" | "b" }) {
  const { x, y } = squareToXY(badge.square, orientation);
  return (
    <div
      className="board-badge"
      title={badge.title}
      style={{ left: `${(x + 1) * 12.5 - 1.6}%`, top: `${y * 12.5 + 1.6}%`, background: badge.color }}
    >
      {badge.label}
    </div>
  );
}

/** Red radial glow under the king of the side to move when in check. */
const CheckHighlight = memo(function CheckHighlight({
  fen,
  orientation,
}: {
  fen: string;
  orientation: "w" | "b";
}) {
  const sq = useMemo(() => checkedKingSquare(fen), [fen]);
  if (!sq) return null;
  const { x, y } = squareToXY(sq, orientation);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: `${x * 12.5}%`,
        top: `${y * 12.5}%`,
        width: "12.5%",
        height: "12.5%",
        background: "radial-gradient(circle, var(--hl-check) 0%, rgba(255,64,64,.4) 42%, transparent 72%)",
      }}
    />
  );
});

function checkedKingSquare(fen: string): Square | null {
  try {
    const chess = new Chess(fen);
    if (!chess.inCheck()) return null;
    const turn = chess.turn();
    return chess.findPiece({ type: "k", color: turn })[0] ?? null;
  } catch {
    return null;
  }
}

export const Board = memo(BoardImpl);
