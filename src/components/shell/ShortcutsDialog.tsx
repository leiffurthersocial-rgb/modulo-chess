"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Kbd } from "@/components/ui/primitives";
import { registry } from "@/modules/registry";

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const rows: [string, string][] = [
    ["← / →", "Previous / next move"],
    ["↑ / ↓", "First / last move"],
    ["F", "Flip board"],
    ["E", "Toggle engine analysis"],
    ["?", "Show this help"],
    ...registry.modules
      .filter((m) => m.shortcut)
      .map((m) => [m.shortcut!.toUpperCase(), `Open ${m.name}`] as [string, string]),
    ["Tab → board", "Arrow keys move the cursor, Enter picks up / places"],
  ];
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="bg-surface text-text ring-border-strong m-auto w-[min(92vw,420px)] rounded-2xl p-0 shadow-2xl ring-1 backdrop:bg-[var(--scrim)] backdrop:backdrop-blur-sm"
      aria-label="Keyboard shortcuts"
    >
      <div className="border-border flex items-center justify-between border-b px-5 py-4">
        <h2 className="font-display text-xl font-black">Keyboard shortcuts</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="text-faint hover:text-text">
          <X className="size-4" />
        </button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 px-5 py-4 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt>
              <Kbd>{k}</Kbd>
            </dt>
            <dd className="text-muted">{v}</dd>
          </div>
        ))}
      </dl>
    </dialog>
  );
}
