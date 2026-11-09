import { Settings2 } from "lucide-react";
import type { ModuleManifest } from "@/core/modules/types";
import { SettingsControllers } from "./SettingsControllers";
import { SettingsPanel } from "./SettingsPanel";

export const settingsModule: ModuleManifest = {
  id: "settings",
  name: "Settings",
  description: "Theme, board, pieces, sound and engine preferences.",
  icon: Settings2,
  route: "/settings",
  order: 90,
  panel: SettingsPanel,
  controller: SettingsControllers,
  shortcut: ",",
};
