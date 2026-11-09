/**
 * The module registry — the single place where features are plugged in.
 * To add a module: create src/modules/<id>/index.ts exporting a ModuleManifest,
 * then add it to the list below. Navigation, routes, panels and controllers
 * are derived from this list. Modules sharing a `group` become tabs on one page.
 */
import { Gauge, Microscope, Settings2, Swords } from "lucide-react";
import { createRegistry } from "@/core/modules/registry";
import type { NavGroup } from "@/core/modules/types";
import { boardModule } from "./board";
import { eloEstimateModule } from "./elo-estimate";
import { engineModule } from "./engine";
import { gameReviewModule } from "./game-review";
import { importExportModule } from "./import-export";
import { openingsModule } from "./openings";
import { settingsModule } from "./settings";

export const NAV_GROUPS: NavGroup[] = [
  { id: "play", label: "Play", icon: Swords, order: 10, showMoves: true },
  { id: "elo", label: "Elo estimate", icon: Gauge, order: 20, showMoves: true },
  { id: "analysis", label: "Analysis", icon: Microscope, order: 30, showMoves: true },
  { id: "settings", label: "Settings", icon: Settings2, order: 90, showMoves: false },
];

export const registry = createRegistry(
  [
    boardModule,
    eloEstimateModule,
    engineModule,
    gameReviewModule,
    openingsModule,
    importExportModule,
    settingsModule,
  ],
  NAV_GROUPS,
);
