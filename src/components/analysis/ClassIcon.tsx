import { ArrowRight, BookOpen, Check, Star, ThumbsUp, X } from "lucide-react";
import type { MoveClass } from "@/core/analysis/classify";
import { CLASS_META } from "@/core/analysis/classify";

const TEXT: Partial<Record<MoveClass, string>> = {
  brilliant: "!!",
  great: "!",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
};

/** The glyph only (white), for use on a coloured background. */
export function ClassGlyph({ cls, size }: { cls: MoveClass; size: number }) {
  const text = TEXT[cls];
  if (text)
    return (
      <span
        className="font-display leading-none font-black tracking-[-0.06em] text-white"
        style={{ fontSize: size * (text.length > 1 ? 0.56 : 0.66) }}
      >
        {text}
      </span>
    );
  const s = size * 0.58;
  const props = { size: s, strokeWidth: 3, color: "white", "aria-hidden": true } as const;
  switch (cls) {
    case "best":
      return <Star {...props} fill="white" strokeWidth={1.5} />;
    case "excellent":
      return <ThumbsUp {...props} strokeWidth={2.6} />;
    case "good":
      return <Check {...props} />;
    case "book":
      return <BookOpen {...props} strokeWidth={2.4} />;
    case "forced":
      return <ArrowRight {...props} />;
    case "miss":
      return <X {...props} />;
    default:
      return null;
  }
}

/** Round, coloured classification icon (move list, report, board). */
export function ClassIcon({
  cls,
  size = 16,
  className,
}: {
  cls: MoveClass;
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={CLASS_META[cls].label}
      title={CLASS_META[cls].label}
      className={`inline-grid shrink-0 place-items-center rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.35)] ${className ?? ""}`}
      style={{ width: size, height: size, background: `var(--c-${cls})` }}
    >
      <ClassGlyph cls={cls} size={size} />
    </span>
  );
}
