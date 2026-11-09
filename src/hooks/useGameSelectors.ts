"use client";

import { useMemo } from "react";
import { pathTo, type MoveNode } from "@/core/chess/tree";
import { positionStatus, useGame, type PositionStatus } from "@/stores/game";

export function useCurrentNode(): MoveNode {
  return useGame((s) => s.tree.nodes[s.currentId]);
}

export function useCurrentPath(): MoveNode[] {
  const tree = useGame((s) => s.tree);
  const currentId = useGame((s) => s.currentId);
  return useMemo(() => pathTo(tree, currentId), [tree, currentId]);
}

/** Status of the current position, including repetition along the played path. */
export function useCurrentStatus(): PositionStatus {
  const path = useCurrentPath();
  return useMemo(() => {
    const node = path[path.length - 1];
    return positionStatus(
      node.fen,
      path.slice(0, -1).map((n) => n.fen),
    );
  }, [path]);
}
