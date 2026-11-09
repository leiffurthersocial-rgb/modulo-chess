"use client";

import { useEffect, useRef } from "react";
import { playSound, soundForSan } from "@/core/sound/sounds";
import { useGame } from "@/stores/game";
import { useSettings } from "@/stores/settings";
import { PlayController } from "./PlayController";

/** Plays a sound when the cursor advances by exactly one move (played or stepped). */
function MoveSounds() {
  const currentId = useGame((s) => s.currentId);
  const prev = useRef(currentId);
  useEffect(() => {
    const before = prev.current;
    prev.current = currentId;
    const { sound, volume } = useSettings.getState();
    if (!sound) return;
    const node = useGame.getState().tree.nodes[currentId];
    if (node?.san && node.parentId === before) playSound(soundForSan(node.san), volume);
  }, [currentId]);
  return null;
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
}

/** Global move-navigation shortcuts. Arrow keys inside the focused board move its cursor instead. */
function Hotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.target instanceof HTMLElement && e.target.closest("[data-board], [role=dialog]")) return;
      const g = useGame.getState();
      switch (e.key) {
        case "ArrowLeft":
          g.prev();
          break;
        case "ArrowRight":
          g.next();
          break;
        case "ArrowUp":
        case "Home":
          g.first();
          break;
        case "ArrowDown":
        case "End":
          g.last();
          break;
        case "f":
          g.flip();
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}

export function BoardControllers() {
  return (
    <>
      <MoveSounds />
      <Hotkeys />
      <PlayController />
    </>
  );
}
