"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToasts } from "@/stores/toasts";

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4 lg:top-auto lg:right-5 lg:bottom-5 lg:left-auto lg:items-end"
      aria-live="polite"
      role="status"
    >
      {toasts.map((t) => {
        const Icon = t.tone === "error" ? XCircle : t.tone === "success" ? CheckCircle2 : Info;
        return (
          <div
            key={t.id}
            className="bg-surface/95 ring-border-strong animate-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl p-3.5 shadow-[var(--shadow)] ring-1 backdrop-blur"
          >
            <Icon
              className={`mt-0.5 size-4 shrink-0 ${t.tone === "error" ? "text-danger" : t.tone === "success" ? "text-accent" : "text-muted"}`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-text text-sm font-medium">{t.title}</p>
              {t.body ? <p className="text-muted mt-0.5 text-xs">{t.body}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="text-faint hover:text-text"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
