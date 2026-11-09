/**
 * The Modulo mark: a modulo operator (%) whose dots are chess squares.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--accent, #467de8)" />
      <rect x="7.5" y="7.5" width="6.5" height="6.5" rx="1.6" fill="#ffffff" />
      <rect x="18" y="18" width="6.5" height="6.5" rx="1.6" fill="#ffffff" fillOpacity="0.75" />
      <path d="M22.6 8.6 9.4 23.4" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={`font-display text-text text-[22px] leading-none font-black tracking-tight ${className ?? ""}`}
    >
      Modulo<span className="text-accent">:</span> Chess
    </span>
  );
}
