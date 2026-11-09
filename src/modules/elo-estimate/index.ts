import { Gauge } from "lucide-react";
import type { ModuleManifest } from "@/core/modules/types";
import { EloController } from "./EloController";
import { EloPanel } from "./EloPanel";

export const eloEstimateModule: ModuleManifest = {
  id: "elo-estimate",
  name: "Elo estimate",
  description: "Play Stockfish and get your rating estimated from your accuracy and results.",
  icon: Gauge,
  route: "/elo",
  group: "elo",
  order: 15,
  panel: EloPanel,
  controller: EloController,
  shortcut: "l",
};
