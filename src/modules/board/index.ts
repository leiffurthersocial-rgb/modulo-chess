import { Swords } from "lucide-react";
import type { ModuleManifest } from "@/core/modules/types";
import { BoardControllers } from "./BoardControllers";
import { BoardPanel } from "./BoardPanel";

export const boardModule: ModuleManifest = {
  id: "board",
  name: "Play",
  description: "Play Stockfish from beginner (Elo 250) to full strength, or use a free analysis board.",
  icon: Swords,
  route: "/",
  group: "play",
  order: 10,
  panel: BoardPanel,
  controller: BoardControllers,
  shortcut: "p",
};
