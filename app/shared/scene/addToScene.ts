// The one place things are added to a scene. The Layers panel's buttons,
// the per-row "Add to scene" / "Set as background" actions in the Assets
// and Characters panels, and dropping onto the canvas all call these —
// so every road into the scene produces exactly the same document, and
// the checks prove the mapping once.

import { newId } from '../document/create';
import { addLayer } from '../document/edits';
import type { Asset, Layer, ProjectDocument } from '../document/types';
import { defaultPlacementKeyframe, type Point } from './geometry';

export interface AddedLayer {
  readonly doc: ProjectDocument;
  readonly layerId: string;
}

/** A readable name for a cutout: the photo it was cut from, if known. */
export function cutoutLabel(cutout: Asset, doc: ProjectDocument): string {
  const source = doc.assets.find((a) => a.id === cutout.metadata.sourceAssetId);
  const name = source?.metadata.originalFileName ?? cutout.file.split('/').pop() ?? cutout.id;
  return cutout.metadata.model === 'hd' ? `${name} (HD)` : name;
}

function assetSize(asset: Asset | undefined): { width: number; height: number } {
  return { width: asset?.metadata.width ?? 0, height: asset?.metadata.height ?? 0 };
}

/**
 * Adds a cutout to the scene as a prop layer: centred and at most half the
 * frame height, or centred at `at` (a canvas drop point, in reference
 * pixels). One addLayer edit — one undo step for the caller's applyEdit.
 */
export function addPropToScene(
  doc: ProjectDocument,
  sceneId: string,
  cutoutAssetId: string,
  at?: Point
): AddedLayer | undefined {
  const cutout = doc.assets.find((a) => a.id === cutoutAssetId && a.type === 'cutout');
  if (cutout === undefined) return undefined;
  const base = defaultPlacementKeyframe(assetSize(cutout), doc.format);
  const layer: Layer = {
    id: newId(),
    name: cutoutLabel(cutout, doc),
    source: { kind: 'prop', assetId: cutout.id },
    keyframes: [at === undefined ? base : { ...base, x: at.x, y: at.y }]
  };
  return { doc: addLayer(doc, sceneId, layer), layerId: layer.id };
}

/**
 * Adds a character to the scene as a layer showing its first pose, sized
 * and placed like addPropToScene. A character without poses has nothing
 * to show and adds nothing.
 */
export function addCharacterToScene(
  doc: ProjectDocument,
  sceneId: string,
  characterId: string,
  at?: Point
): AddedLayer | undefined {
  const character = doc.characters.find((c) => c.id === characterId);
  const pose = character?.poses[0];
  if (character === undefined || pose === undefined) return undefined;
  const cutout = doc.assets.find((a) => a.id === pose.cutoutAssetId);
  const base = defaultPlacementKeyframe(assetSize(cutout), doc.format, pose.id);
  const layer: Layer = {
    id: newId(),
    name: character.name,
    source: { kind: 'character', characterId: character.id },
    keyframes: [at === undefined ? base : { ...base, x: at.x, y: at.y }]
  };
  return { doc: addLayer(doc, sceneId, layer), layerId: layer.id };
}
