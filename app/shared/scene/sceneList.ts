// Small pure rules for the scene strip (Phase 7, decision b): what a new
// scene is called, and which scene survives as the selection when one is
// deleted. Here rather than in the component so they are tested as plain
// functions (ADR-015).

import type { Scene } from '../document/types';

/**
 * The name for a newly inserted scene: "Scene N" counting up from how
 * many scenes exist, skipping any name already taken (deletes can leave
 * gaps and collisions; renames make anything possible).
 */
export function nextSceneName(scenes: readonly Scene[]): string {
  const taken = new Set(scenes.map((s) => s.name));
  for (let n = scenes.length + 1; ; n++) {
    const name = `Scene ${n}`;
    if (!taken.has(name)) return name;
  }
}

/**
 * The scene to select after deleting `removedId`: its NEXT neighbour in
 * play order, else the previous one, else nothing (deleting the last
 * remaining scene is refused by the edit anyway).
 */
export function neighbourAfterRemoval(
  scenes: readonly Scene[],
  removedId: string
): string | undefined {
  const at = scenes.findIndex((s) => s.id === removedId);
  if (at < 0) return undefined;
  return scenes[at + 1]?.id ?? scenes[at - 1]?.id;
}
