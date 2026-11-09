import type { ComponentType } from "react";

export interface ModuleIconProps {
  className?: string;
  "aria-hidden"?: boolean;
  strokeWidth?: number;
}

/**
 * Every feature in Modulo is a module. A module declares itself with a manifest;
 * the shell renders navigation, panels and background controllers from manifests,
 * so adding a feature never requires touching the core.
 */
export interface ModuleManifest {
  /** Stable, URL-safe id (also the directory name under src/modules). */
  id: string;
  /** Short label used in navigation and panel tabs. */
  name: string;
  /** One-line description (used for page metadata and tooltips). */
  description: string;
  icon: ComponentType<ModuleIconProps>;
  /** Route that opens this module's panel, e.g. "/review". "/" for the default module. */
  route?: string;
  /** Sort order within its group (ascending). */
  order: number;
  /**
   * Navigation group (a top-bar item). Modules sharing a group appear as tabs in
   * that page's panel. Defaults to the module id.
   */
  group?: string;
  /** Panel rendered in the analysis sidebar / mobile sheet when the module is active. */
  panel?: ComponentType;
  /**
   * Headless component mounted once for the app's lifetime. Use it for background
   * work (engine controllers, keyboard shortcuts) that must run regardless of which
   * panel is visible. Must render null or purely global UI.
   */
  controller?: ComponentType;
  /** Optional keyboard shortcut (single key) that opens this module's panel. */
  shortcut?: string;
  /** Hide from primary navigation (still routable). */
  hidden?: boolean;
}

/** A top-level navigation entry (one page). */
export interface NavGroup {
  id: string;
  label: string;
  icon: ComponentType<ModuleIconProps>;
  order: number;
  /** Show the move list + move navigation in this page's panel. */
  showMoves: boolean;
}

export interface ResolvedNavGroup extends NavGroup {
  /** Route of the group's first module (what the top-bar link opens). */
  route: string;
  modules: ModuleManifest[];
}

export interface ModuleRegistry {
  modules: readonly ModuleManifest[];
  byId(id: string): ModuleManifest | undefined;
  byRoute(path: string): ModuleManifest | undefined;
  /** Modules with a route, in navigation order. */
  routed(): ModuleManifest[];
  defaultModule: ModuleManifest;
  /** Navigation groups with their routed modules, in order. */
  groups(): ResolvedNavGroup[];
  groupOf(module: ModuleManifest): ResolvedNavGroup;
}
