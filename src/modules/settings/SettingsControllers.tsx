"use client";

import { useEffect } from "react";
import { useSettings } from "@/stores/settings";

/** Rehydrates persisted settings after mount and applies theme attributes to <html>. */
export function SettingsControllers() {
  const theme = useSettings((s) => s.theme);
  const animations = useSettings((s) => s.animations);

  useEffect(() => {
    void useSettings.persist.rehydrate();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark =
        theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.animations = animations ? "on" : "off";
  }, [animations]);

  return null;
}
