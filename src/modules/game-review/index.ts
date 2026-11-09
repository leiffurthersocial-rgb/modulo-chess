import { LineChart } from "lucide-react";
import type { ModuleManifest } from "@/core/modules/types";
import { ReviewPanel } from "./ReviewPanel";

export const gameReviewModule: ModuleManifest = {
  id: "game-review",
  name: "Report",
  description: "Game report: move classifications, accuracy and an Elo estimate for both players.",
  icon: LineChart,
  route: "/analysis",
  group: "analysis",
  order: 20,
  panel: ReviewPanel,
  shortcut: "r",
};
