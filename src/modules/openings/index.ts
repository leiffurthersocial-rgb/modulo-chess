import { BookOpen } from "lucide-react";
import type { ModuleManifest } from "@/core/modules/types";
import { OpeningsPanel } from "./OpeningsPanel";

export const openingsModule: ModuleManifest = {
  id: "openings",
  name: "Openings",
  description: "Opening names (ECO) for the current position and book continuations.",
  icon: BookOpen,
  route: "/openings",
  group: "analysis",
  order: 40,
  panel: OpeningsPanel,
  shortcut: "o",
};
