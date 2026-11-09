/**
 * The module registry — the single place where features are plugged in.
 * To add a module: create src/modules/<id>/index.ts exporting a ModuleManifest,
 * then add it to the list below. Navigation, routes, panels and controllers
 * are derived from this list.
 */
import { createRegistry } from "@/core/modules/registry";
import { boardModule } from "./board";
import { engineModule } from "./engine";
import { gameReviewModule } from "./game-review";
import { importExportModule } from "./import-export";
import { openingsModule } from "./openings";
import { settingsModule } from "./settings";

export const registry = createRegistry([
  boardModule,
  engineModule,
  gameReviewModule,
  importExportModule,
  openingsModule,
  settingsModule,
]);
