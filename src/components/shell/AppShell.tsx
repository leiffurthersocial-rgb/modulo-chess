"use client";

import { Keyboard, ListTree, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ModuleManifest } from "@/core/modules/types";
import { registry } from "@/modules/registry";
import { useCurrentPath } from "@/hooks/useGameSelectors";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useEngine } from "@/stores/engine";
import { useOpeningDb } from "@/stores/openings";
import { useSettings } from "@/stores/settings";
import { identifyOpening } from "@/modules/openings/lookup";
import { IconButton, cx } from "@/components/ui/primitives";
import { BoardArea } from "./BoardArea";
import { LogoMark, Wordmark } from "./Logo";
import { MoveList, MoveStrip } from "./MoveList";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { Toasts } from "./Toasts";

function useActiveModule(): ModuleManifest {
  const pathname = usePathname();
  return registry.byRoute(pathname ?? "/") ?? registry.defaultModule;
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
}

function useGlobalShortcuts(openHelp: () => void) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.target instanceof HTMLElement && e.target.closest("[role=dialog], dialog")) return;
      if (e.key === "?") {
        e.preventDefault();
        openHelp();
        return;
      }
      if (e.key === "e") {
        e.preventDefault();
        useEngine.getState().toggle();
        return;
      }
      const m = registry.modules.find((x) => x.shortcut === e.key && x.route !== undefined);
      if (m) {
        e.preventDefault();
        router.push(m.route!);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, openHelp]);
}

/** Mounts every module's background controller exactly once. */
function Controllers() {
  return (
    <>
      {registry.modules.map((m) =>
        m.controller ? <Fragment key={m.id}>{<m.controller />}</Fragment> : null,
      )}
    </>
  );
}

function OpeningLabel() {
  const path = useCurrentPath();
  const db = useOpeningDb((s) => s.db);
  const load = useOpeningDb((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  const opening = useMemo(() => (db ? identifyOpening(db, path) : null), [db, path]);
  if (!opening)
    return <span className="text-faint truncate text-xs">{path.length > 1 ? "" : "Starting position"}</span>;
  return (
    <span className="text-muted min-w-0 truncate text-xs" title={`${opening.eco} ${opening.name}`}>
      <span className="text-faint font-mono">{opening.eco}</span> {opening.name}
    </span>
  );
}

function ThemeToggle() {
  const theme = useSettings((s) => s.theme);
  const set = useSettings((s) => s.set);
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const read = () => setDark(document.documentElement.dataset.theme !== "light");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, [theme]);
  return (
    <IconButton
      label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => set({ theme: dark ? "light" : "dark" })}
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </IconButton>
  );
}

function Sidebar({ active, onHelp }: { active: ModuleManifest; onHelp: () => void }) {
  return (
    <nav
      aria-label="Modules"
      className="border-border bg-surface/40 hidden w-[84px] shrink-0 flex-col items-center border-r py-4 lg:flex"
    >
      <Link href="/" className="mb-6 rounded-xl" aria-label="Modulo: Chess home">
        <LogoMark className="size-10" />
      </Link>
      <ul className="flex flex-1 flex-col items-center gap-1.5">
        {registry
          .routed()
          .filter((m) => !m.hidden)
          .map((m) => {
            const isActive = m.id === active.id;
            const Icon = m.icon;
            return (
              <li key={m.id}>
                <Link
                  href={m.route!}
                  aria-current={isActive ? "page" : undefined}
                  title={`${m.name}${m.shortcut ? ` (${m.shortcut.toUpperCase()})` : ""}`}
                  className={cx(
                    "group relative flex w-[68px] flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-medium transition-colors duration-[var(--dur-fast)]",
                    isActive ? "text-text" : "text-faint hover:bg-surface-3/60 hover:text-text",
                  )}
                >
                  <span
                    className={cx(
                      "grid size-9 place-items-center rounded-xl transition-colors duration-[var(--dur)]",
                      isActive ? "bg-accent text-accent-ink" : "",
                    )}
                  >
                    <Icon className="size-[18px]" aria-hidden strokeWidth={isActive ? 2.25 : 2} />
                  </span>
                  {m.name}
                </Link>
              </li>
            );
          })}
      </ul>
      <div className="flex flex-col items-center gap-1">
        <IconButton label="Keyboard shortcuts (?)" onClick={onHelp}>
          <Keyboard className="size-[18px]" />
        </IconButton>
        <ThemeToggle />
      </div>
    </nav>
  );
}

function PanelTabs({ active, onSelect }: { active: ModuleManifest; onSelect?: () => void }) {
  return (
    <div role="tablist" aria-label="Panels" className="scroll-thin flex gap-1 overflow-x-auto">
      {registry
        .routed()
        .filter((m) => m.panel && !m.hidden)
        .map((m) => {
          const isActive = m.id === active.id;
          const Icon = m.icon;
          return (
            <Link
              key={m.id}
              href={m.route!}
              role="tab"
              aria-selected={isActive}
              title={`${m.name}${m.shortcut ? ` (${m.shortcut.toUpperCase()})` : ""}`}
              onClick={onSelect}
              className={cx(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium transition-colors duration-[var(--dur-fast)]",
                isActive ? "bg-surface-3 text-text ring-border-strong ring-1" : "text-faint hover:text-text",
              )}
            >
              <Icon className="size-4" aria-hidden />
              <span className={isActive ? "" : "sr-only"}>{m.name}</span>
            </Link>
          );
        })}
    </div>
  );
}

function PanelBody({ module }: { module: ModuleManifest }) {
  const Panel = module.panel;
  return (
    <div key={module.id} role="tabpanel" aria-label={module.name} className="animate-in">
      {Panel ? <Panel /> : null}
    </div>
  );
}

function DesktopPanel({ active }: { active: ModuleManifest }) {
  return (
    <aside
      className="border-border bg-surface/50 hidden w-[400px] shrink-0 flex-col border-l lg:flex xl:w-[440px]"
      aria-label="Analysis panel"
    >
      <div className="border-border border-b px-3 py-3">
        <PanelTabs active={active} />
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
        <PanelBody module={active} />
      </div>
      <div className="border-border flex h-[38%] min-h-[200px] flex-col border-t">
        <div className="border-border flex h-10 shrink-0 items-center gap-2 border-b px-4">
          <ListTree className="text-faint size-4 shrink-0" aria-hidden />
          <span className="text-faint text-xs font-semibold tracking-[0.08em] uppercase">Moves</span>
          <span className="bg-border mx-1 h-3 w-px" aria-hidden />
          <OpeningLabel />
        </div>
        <div className="min-h-0 flex-1">
          <MoveList />
        </div>
      </div>
    </aside>
  );
}

type Snap = "peek" | "half" | "full";
const SNAP_HEIGHT: Record<Snap, string> = {
  peek: "var(--sheet-peek)",
  half: "62dvh",
  full: "calc(100dvh - 56px)",
};

function MobileSheet({ active }: { active: ModuleManifest }) {
  const [snap, setSnap] = useState<Snap>("peek");
  const [view, setView] = useState<"panel" | "moves">("panel");
  const [drag, setDrag] = useState<{ y: number; h: number; dy: number } | null>(null);
  const sheet = useRef<HTMLDivElement>(null);

  const order: Snap[] = ["peek", "half", "full"];
  const cycle = () => setSnap((s) => order[(order.indexOf(s) + 1) % order.length]);

  const onDown = (e: React.PointerEvent) => {
    setDrag({ y: e.clientY, h: sheet.current?.getBoundingClientRect().height ?? 0, dy: 0 });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (drag) setDrag({ ...drag, dy: e.clientY - drag.y });
  };
  const onUp = (e: React.PointerEvent) => {
    const s = drag;
    setDrag(null);
    if (!s) return;
    const dy = e.clientY - s.y;
    if (Math.abs(dy) < 6) {
      cycle();
      return;
    }
    const h = s.h - dy;
    const vh = window.innerHeight;
    const targets: [Snap, number][] = [
      ["peek", Math.max(200, vh * 0.3)],
      ["half", vh * 0.62],
      ["full", vh - 56],
    ];
    targets.sort((a, b) => Math.abs(a[1] - h) - Math.abs(b[1] - h));
    setSnap(targets[0][0]);
  };

  const height = drag ? `${Math.max(120, drag.h - drag.dy)}px` : SNAP_HEIGHT[snap];

  return (
    <div
      ref={sheet}
      className={cx(
        "bg-surface ring-border-strong fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-[22px] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.5)] ring-1 lg:hidden",
        !drag && "transition-[height] duration-[var(--dur-slow)] ease-[var(--ease-out)]",
      )}
      style={{ height, paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Analysis panel"
    >
      <button
        type="button"
        className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        aria-label={snap === "full" ? "Collapse panel" : "Expand panel"}
        aria-expanded={snap !== "peek"}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => setDrag(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            cycle();
          }
        }}
      >
        <span className="bg-border-strong h-1 w-10 rounded-full" />
      </button>
      <div className="flex shrink-0 items-center gap-1 px-3 pb-2">
        <button
          type="button"
          onClick={() => {
            setView("moves");
            if (snap === "peek") setSnap("half");
          }}
          aria-pressed={view === "moves"}
          className={cx(
            "flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium",
            view === "moves" ? "bg-surface-3 text-text ring-border-strong ring-1" : "text-faint",
          )}
        >
          <ListTree className="size-4" aria-hidden /> Moves
        </button>
        <div className="min-w-0 flex-1" onClickCapture={() => setView("panel")}>
          <PanelTabsMobile
            active={view === "panel" ? active : null}
            onSelect={() => snap === "peek" && setSnap("half")}
          />
        </div>
      </div>
      <div className="scroll-thin border-border min-h-0 flex-1 overflow-y-auto overscroll-contain border-t p-3">
        {view === "moves" ? (
          <div className="h-full min-h-[200px]">
            <MoveList />
          </div>
        ) : (
          <PanelBody module={active} />
        )}
      </div>
    </div>
  );
}

function PanelTabsMobile({ active, onSelect }: { active: ModuleManifest | null; onSelect: () => void }) {
  return (
    <div role="tablist" aria-label="Panels" className="scroll-thin flex gap-1 overflow-x-auto">
      {registry
        .routed()
        .filter((m) => m.panel && !m.hidden)
        .map((m) => {
          const isActive = active?.id === m.id;
          const Icon = m.icon;
          return (
            <Link
              key={m.id}
              href={m.route!}
              role="tab"
              aria-selected={isActive}
              aria-label={m.name}
              onClick={onSelect}
              className={cx(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-medium",
                isActive ? "bg-surface-3 text-text ring-border-strong ring-1" : "text-faint",
              )}
            >
              <Icon className="size-4" aria-hidden />
              <span className={isActive ? "" : "sr-only sm:not-sr-only"}>{m.name}</span>
            </Link>
          );
        })}
    </div>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const active = useActiveModule();
  const [help, setHelp] = useState(false);
  // null until mounted: render both layouts (CSS decides), then only the visible one.
  const desktop = useMediaQuery(DESKTOP_QUERY);
  useGlobalShortcuts(() => setHelp(true));

  return (
    <div className="app-shell flex h-dvh overflow-hidden">
      <a
        href="#board"
        className="bg-accent text-accent-ink sr-only z-[70] rounded-lg px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to board
      </a>
      <Sidebar active={active} onHelp={() => setHelp(true)} />
      <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
        <header className="flex h-14 shrink-0 items-center gap-3 px-4 lg:hidden">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Modulo: Chess home">
            <LogoMark className="size-8" />
            <Wordmark className="text-[19px]" />
          </Link>
          <div className="ml-auto flex items-center">
            <IconButton
              label="Keyboard shortcuts"
              onClick={() => setHelp(true)}
              className="hidden sm:inline-grid"
            >
              <Keyboard className="size-[18px]" />
            </IconButton>
            <ThemeToggle />
          </div>
        </header>

        <main
          id="board"
          className="flex min-h-0 min-w-0 flex-1 flex-col items-center overflow-y-auto px-3 pb-[calc(var(--sheet-peek)+12px)] lg:justify-center-safe lg:px-8 lg:py-6 lg:pb-6"
        >
          <div
            className="hidden w-full max-w-[880px] items-center justify-between pb-4 lg:flex"
            style={{ width: "var(--board-col)" }}
          >
            <Wordmark />
            <span className="text-faint text-xs">{active.description}</span>
          </div>
          <div className="w-full" style={{ maxWidth: "var(--board-col)" }}>
            <BoardArea />
          </div>
          {desktop !== true ? (
            <div className="mt-1 w-full lg:hidden" style={{ maxWidth: "var(--board-col)" }}>
              <MoveStrip />
            </div>
          ) : null}
          {children}
        </main>

        {desktop !== false ? <DesktopPanel active={active} /> : null}
      </div>
      {desktop !== true ? <MobileSheet active={active} /> : null}
      <Toasts />
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
      <Controllers />
    </div>
  );
}
