"use client";

import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
export { cx };

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap select-none",
        "transition-[background-color,color,box-shadow,transform] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        variant === "primary" &&
          "bg-accent text-accent-ink hover:bg-accent-strong shadow-[0_8px_24px_-12px_var(--accent)]",
        variant === "secondary" &&
          "bg-surface-3 text-text ring-border-strong/60 hover:bg-surface-hover ring-1",
        variant === "ghost" && "text-muted hover:bg-surface-3 hover:text-text",
        variant === "danger" && "bg-danger/12 text-danger ring-danger/30 hover:bg-danger/20 ring-1",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "text-muted inline-grid size-9 place-items-center rounded-xl transition-colors duration-[var(--dur-fast)]",
        "hover:bg-surface-3 hover:text-text disabled:pointer-events-none disabled:opacity-35",
        active && "bg-accent-soft text-accent",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="text-text block text-sm">{label}</span>
        {description ? <span className="text-faint block text-xs">{description}</span> : null}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-[var(--dur)] disabled:opacity-40",
          checked ? "bg-accent" : "bg-surface-3 ring-border-strong ring-1",
        )}
      >
        <span
          className={cx(
            "absolute top-1 left-1 size-4 rounded-full shadow transition-transform duration-[var(--dur)] ease-[var(--ease-out)]",
            checked ? "bg-accent-ink translate-x-4" : "bg-muted",
          )}
        />
      </button>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  description,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min || 1)) * 100;
  return (
    <div className={cx("py-2", disabled && "opacity-50")}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-text text-sm">
          {label}
        </label>
        <span className="tabular text-muted font-mono text-xs">{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="modulo-range w-full"
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
      />
      {description ? <p className="text-faint mt-1 text-xs">{description}</p> : null}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="bg-surface-2 ring-border flex rounded-xl p-1 ring-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg font-medium transition-[background-color,color] duration-[var(--dur-fast)]",
              size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-3 text-[13px]",
              active
                ? "bg-surface-3 text-text ring-border-strong shadow-sm ring-1"
                : "text-muted hover:text-text",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("bg-surface-2/70 ring-border rounded-2xl p-4 ring-1", className)}>
      {title || action ? (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title ? (
            <h3 className="text-faint text-xs font-semibold tracking-[0.08em] uppercase">{title}</h3>
          ) : (
            <span />
          )}
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="bg-surface-3 text-muted ring-border-strong inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 font-mono text-[11px] ring-1">
      {children}
    </kbd>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="animate-in flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {icon ? (
        <div className="bg-surface-3 text-muted mb-1 grid size-11 place-items-center rounded-2xl">{icon}</div>
      ) : null}
      <p className="text-text text-sm font-medium">{title}</p>
      {children ? <div className="text-faint max-w-xs text-xs leading-relaxed">{children}</div> : null}
    </div>
  );
}
