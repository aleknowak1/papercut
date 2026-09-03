// What a panel row carries when dragged onto the scene canvas: a
// background photo, a cutout (becomes a prop layer at the drop point), or
// a character (its first pose, at the drop point). UI plumbing only — the
// document edits live in shared/scene/addToScene.ts.

export const SCENE_DRAG_TYPE = 'application/x-papercut-scene';

export type SceneDragData =
  | { readonly kind: 'background'; readonly assetId: string }
  | { readonly kind: 'cutout'; readonly assetId: string }
  | { readonly kind: 'character'; readonly characterId: string };

export function readSceneDragData(dataTransfer: DataTransfer): SceneDragData | undefined {
  const raw = dataTransfer.getData(SCENE_DRAG_TYPE);
  if (raw === '') return undefined;
  try {
    const parsed = JSON.parse(raw) as SceneDragData;
    if (parsed.kind === 'background' || parsed.kind === 'cutout' || parsed.kind === 'character') {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
