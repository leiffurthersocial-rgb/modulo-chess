"use client";

import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, FlipVertical2, ListTree } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ModuleManifest, ResolvedNavGroup } from "@/core/modules/types";
import { registry } from "@/modules/registry";
import { identifyOpening } from "@/modules/openings/lookup";
import { cx } from "@/components/ui/primitives";
import { useCurrentPath } from "@/hooks/useGameSelectors";
import { useEngine } from "@/stores/engine";
import { useGame } from "@/stores/game";
import { useOpeningDb } from "@/stores/openings";
import { BoardArea } from "./BoardArea";
import { OPEN_SHORTCUTS_EVENT } from "./events";
import { LogoMark, Wordmark } from "./Logo";
import { MoveList } from "./MoveList";
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
    const onOpen = () => openHelp();
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SHORTCUTS_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SHORTCUTS_EVENT, onOpen);
    };
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

// ── Top navigation ────────────────────────────────────────────────────────

function TopBar({ activeGroup }: { activeGroup: ResolvedNavGroup }) {
  return (
    <header className="bg-nav sticky top-0 z-40 shadow-[0_1px_0_var(--border)]">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-2 px-2 sm:gap-6 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-xl"
          aria-label="Modulo: Chess home"
        >
          <LogoMark className="size-9" />
          <Wordmark className="hidden md:inline" />
        </Link>
        <nav
          aria-label="Main"
          className="flex min-w-0 flex-1 items-center justify-around gap-1 sm:justify-start"
        >
          {registry.groups().map((g) => {
            const active = g.id === activeGroup.id;
            const Icon = g.icon;
            return (
              <Link
                key={g.id}
                href={g.route}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "font-display flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 font-bold transition-colors duration-[var(--dur-fast)] sm:flex-row sm:gap-2 sm:px-3.5 sm:py-2",
                  active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-3 hover:text-text",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="text-[11px] sm:text-[15px]">{g.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────

function GroupTabs({ group, active }: { group: ResolvedNavGroup; active: ModuleManifest }) {
  if (group.modules.length < 2) return null;
  return (
    <div
      role="tablist"
      aria-label={`${group.label} tools`}
      className="bg-surface-2 flex gap-1.5 rounded-xl p-1.5 pb-2"
    >
      {group.modules.map((m) => {
        const isActive = m.id === active.id;
        const Icon = m.icon;
        return (
          <Link
            key={m.id}
            href={m.route!}
            role="tab"
            aria-selected={isActive}
            title={`${m.name}${m.shortcut ? ` (${m.shortcut.toUpperCase()})` : ""}`}
            className={cx(
              "press font-display flex h-10 min-w-0 flex-auto items-center justify-center gap-1.5 rounded-lg px-2.5 text-[14px] font-bold",
              isActive ? "press-accent bg-accent text-white" : "bg-surface-3 text-faint hover:text-text",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className={cx("truncate", !isActive && "sr-only sm:not-sr-only")}>{m.name}</span>
          </Link>
        );
      })}
    </div>
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
  if (!opening) return null;
  return (
    <span className="text-muted min-w-0 truncate text-xs" title={`${opening.eco} ${opening.name}`}>
      <span className="text-faint font-mono">{opening.eco}</span> {opening.name}
    </span>
  );
}

/** First / previous / next / last / flip. The only place move navigation lives. */
function Traverser({ className }: { className?: string }) {
  const { first, prev, next, last, flip } = useGame.getState();
  const hasPrev = useGame((g) => g.tree.nodes[g.currentId].parentId !== null);
  const hasNext = useGame((g) => g.tree.nodes[g.currentId].children.length > 0);
  const btn =
    "press grid h-11 flex-1 place-items-center rounded-xl bg-surface-3 text-text disabled:opacity-40 disabled:pointer-events-none";
  return (
    <div role="toolbar" aria-label="Move navigation" className={cx("flex gap-1.5", className)}>
      <button
        type="button"
        className={btn}
        onClick={first}
        disabled={!hasPrev}
        aria-label="First move"
        title="First move (↑)"
      >
        <ChevronFirst className="size-5" />
      </button>
      <button
        type="button"
        className={btn}
        onClick={prev}
        disabled={!hasPrev}
        aria-label="Previous move"
        title="Previous move (←)"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        className={btn}
        onClick={next}
        disabled={!hasNext}
        aria-label="Next move"
        title="Next move (→)"
      >
        <ChevronRight className="size-5" />
      </button>
      <button
        type="button"
        className={btn}
        onClick={last}
        disabled={!hasNext}
        aria-label="Last move"
        title="Last move (↓)"
      >
        <ChevronLast className="size-5" />
      </button>
      <button type="button" className={btn} onClick={flip} aria-label="Flip board" title="Flip board (F)">
        <FlipVertical2 className="size-5" />
      </button>
    </div>
  );
}

/** Move list section; collapses to a single line until the first move is played. */
function MovesSection() {
  const hasMoves = useGame((g) => g.tree.nodes[g.tree.rootId].children.length > 0);
  return (
    <div
      className={cx(
        "border-border bg-surface-2 flex flex-col border-t",
        hasMoves && "lg:h-[34%] lg:min-h-[190px]",
      )}
    >
      <div className="flex h-10 shrink-0 items-center gap-2 px-3">
        <ListTree className="text-faint size-4 shrink-0" aria-hidden />
        <span className="font-display text-faint text-[13px] font-extrabold tracking-wide uppercase">
          Moves
        </span>
        <span className="bg-border-strong mx-1 h-3 w-px" aria-hidden />
        {hasMoves ? <OpeningLabel /> : <span className="text-faint text-xs">No moves yet</span>}
      </div>
      {hasMoves ? (
        <div className="max-h-[260px] min-h-0 flex-1 lg:max-h-none">
          <MoveList />
        </div>
      ) : null}
    </div>
  );
}

function Panel({ module, group }: { module: ModuleManifest; group: ResolvedNavGroup }) {
  const Body = module.panel;
  return (
    <aside
      aria-label={`${group.label} panel`}
      className="bg-surface flex w-full flex-col overflow-hidden rounded-2xl shadow-[var(--shadow)] lg:sticky lg:top-[88px] lg:h-[calc(100dvh-112px)] lg:w-[420px] lg:shrink-0"
    >
      <div className="flex flex-col gap-3 p-3 pb-0">
        <h2 className="bg-accent font-display rounded-xl px-4 py-2 text-center text-[26px] leading-tight font-black text-white shadow-[0_4px_0_var(--accent-shadow)]">
          {group.modules.length > 1 ? group.label : module.name}
        </h2>
        <GroupTabs group={group} active={module} />
      </div>

      <div className="scroll-thin min-h-0 flex-1 p-3 lg:overflow-y-auto">
        <div key={module.id} role="tabpanel" aria-label={module.name} className="animate-in">
          {Body ? <Body /> : null}
        </div>
      </div>

      {group.showMoves ? <MovesSection /> : null}

      {/* Desktop: navigation sits at the bottom of the panel. Mobile: pinned to the screen bottom. */}
      <div className="border-border bg-surface hidden border-t p-2.5 lg:block">
        <Traverser />
      </div>
    </aside>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const active = useActiveModule();
  const group = registry.groupOf(active);
  const [help, setHelp] = useState(false);
  useGlobalShortcuts(() => setHelp(true));

  return (
    <div className="app-shell flex min-h-dvh flex-col">
      <a
        href="#board"
        className="bg-accent text-accent-ink sr-only z-[70] rounded-lg px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to board
      </a>
      <TopBar activeGroup={group} />

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col items-center gap-4 px-2 pt-3 pb-24 sm:px-4 lg:flex-row lg:items-start lg:justify-center lg:gap-8 lg:px-8 lg:pt-6 lg:pb-6">
        <main id="board" className="w-full lg:sticky lg:top-[88px]" style={{ maxWidth: "var(--board-col)" }}>
          <BoardArea />
          {children}
        </main>
        <Panel module={active} group={group} />
      </div>

      {/* Mobile move navigation, always within thumb reach. */}
      <div className="bg-nav/95 fixed inset-x-0 bottom-0 z-40 px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] shadow-[0_-1px_0_var(--border)] backdrop-blur lg:hidden">
        <Traverser className="mx-auto max-w-[640px]" />
      </div>

      <Toasts />
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} />
      <Controllers />
    </div>
  );
}
