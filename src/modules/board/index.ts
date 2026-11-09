import { LayoutGrid } from "lucide-react";
import type { ModuleManifest } from "@/core/modules/types";
import { BoardControllers } from "./BoardControllers";
import { BoardPanel } from "./BoardPanel";

export const boardModule: ModuleManifest = {
  id: "board",
  name: "Play",
  description: "Analysis board and games against Stockfish at adjustable strength.",
  icon: LayoutGrid,
  route: "/",
  order: 10,
  panel: BoardPanel,
  controller: BoardControllers,
  shortcut: "p",
};
