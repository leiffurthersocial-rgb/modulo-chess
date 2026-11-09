import { BookOpen } from "lucide-react";
import type { ModuleManifest } from "@/core/modules/types";
import { OpeningsPanel } from "./OpeningsPanel";

export const openingsModule: ModuleManifest = {
  id: "openings",
  name: "Openings",
  description: "Opening names (ECO) for the current position and book continuations.",
  icon: BookOpen,
  route: "/openings",
  order: 50,
  panel: OpeningsPanel,
  shortcut: "o",
};
