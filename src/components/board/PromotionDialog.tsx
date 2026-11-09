"use client";

import { useEffect, useRef } from "react";
import { pieceUrl } from "@/themes/pieces";
import { pieceName, squareToXY } from "./pieces";

const ORDER = ["q", "n", "r", "b"] as const;
export type PromotionPiece = (typeof ORDER)[number];

interface Props {
  square: string;
  color: "w" | "b";
  orientation: "w" | "b";
  pieceSet: string;
  onSelect: (piece: PromotionPiece) => void;
  onCancel: () => void;
}

/** Lichess-style column of promotion choices anchored on the target square. */
export function PromotionDialog({ square, color, orientation, pieceSet, onSelect, onCancel }: Props) {
  const { x, y } = squareToXY(square, orientation);
  const fromTop = y === 0;
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="absolute inset-0 z-30 bg-[var(--scrim)] backdrop-blur-[1px]"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onCancel();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label="Choose promotion piece"
        className="bg-surface ring-border-strong absolute flex flex-col overflow-hidden rounded-xl shadow-2xl ring-1"
        style={{
          left: `${x * 12.5}%`,
          width: "12.5%",
          ...(fromTop ? { top: 0 } : { bottom: 0, flexDirection: "column-reverse" }),
        }}
      >
        {ORDER.map((p, i) => (
          <button
            key={p}
            ref={i === 0 ? first : undefined}
            type="button"
            aria-label={`Promote to ${pieceName(p)}`}
            className="hover:bg-accent-soft focus-visible:bg-accent-soft aspect-square w-full bg-center bg-no-repeat transition-colors"
            style={{ backgroundImage: `url(${pieceUrl(pieceSet, color, p)})`, backgroundSize: "86%" }}
            onClick={() => onSelect(p)}
          />
        ))}
      </div>
    </div>
  );
}
