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
  /** Sort order in navigation (ascending). */
  order: number;
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

export interface ModuleRegistry {
  modules: readonly ModuleManifest[];
  byId(id: string): ModuleManifest | undefined;
  byRoute(path: string): ModuleManifest | undefined;
  /** Modules with a route, in navigation order. */
  routed(): ModuleManifest[];
  defaultModule: ModuleManifest;
}
