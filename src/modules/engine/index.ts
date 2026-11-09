import { Cpu } from "lucide-react";
import type { ModuleManifest } from "@/core/modules/types";
import { EngineController } from "./EngineController";
import { EnginePanel } from "./EnginePanel";

export const engineModule: ModuleManifest = {
  id: "engine",
  name: "Engine",
  description: "Live Stockfish 19 analysis running locally in your browser.",
  icon: Cpu,
  route: "/analysis",
  group: "analysis",
  order: 20,
  panel: EnginePanel,
  controller: EngineController,
  shortcut: "a",
};
