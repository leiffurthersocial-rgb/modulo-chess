import { LineChart } from "lucide-react";
import type { ModuleManifest } from "@/core/modules/types";
import { ReviewPanel } from "./ReviewPanel";

export const gameReviewModule: ModuleManifest = {
  id: "game-review",
  name: "Review",
  description: "Full-game analysis with an eval graph, accuracy and move classification.",
  icon: LineChart,
  route: "/review",
  order: 30,
  panel: ReviewPanel,
  shortcut: "r",
};
