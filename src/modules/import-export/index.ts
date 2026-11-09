import { ArrowDownUp } from "lucide-react";
import type { ModuleManifest } from "@/core/modules/types";
import { ImportExportPanel } from "./ImportExportPanel";

export const importExportModule: ModuleManifest = {
  id: "import-export",
  name: "Import",
  description: "Load PGN or FEN, and export your analysis with variations.",
  icon: ArrowDownUp,
  route: "/import",
  group: "analysis",
  order: 50,
  panel: ImportExportPanel,
  shortcut: "i",
};
