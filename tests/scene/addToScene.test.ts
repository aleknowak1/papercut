// Phase 4b (ADR-015): every road into the scene — the Layers panel
// buttons, the per-row "Add to scene" / "Set as background" actions, and
// dropping onto the canvas — goes through addToScene.ts, so proving these
// functions proves them all. The drop point must map to the document
// exactly; everything else must match the panel default.

import { describe, expect, it } from 'vitest';
import { applyEdit, createHistory, undo } from '../../app/shared/document/history';
import type { ProjectDocument } from '../../app/shared/document/types';
import {
  addCharacterToScene,
  addPropToScene,
  cutoutLabel
} from '../../app/shared/scene/addToScene';
import { defaultPlacementKeyframe } from '../../app/shared/scene/geometry';
import { sampleProject } from '../helpers/sampleProject';

function ids(doc: ProjectDocument): {
  sceneId: string;
  cutoutId: string;
  characterId: string;
  poseId: string;
} {
  const cutout = doc.assets.find((a) => a.type === 'cutout');
  const character = doc.characters[0];
  if (cutout === undefined || character === undefined || character.poses[0] === undefined) {
    throw new Error('sampleProject changed shape');
  }
  return {
    sceneId: doc.scenes[0]!.id,
    cutoutId: cutout.id,
    characterId: character.id,
    poseId: character.poses[0].id
  };
}

describe('adding to the scene (shared by buttons, rows, and canvas drops)', () => {
  it('a prop lands with exactly the panel default placement', () => {
    const doc = sampleProject();
    const { sceneId, cutoutId } = ids(doc);
    const added = addPropToScene(doc, sceneId, cutoutId);
    expect(added).toBeDefined();
    const layer = added!.doc.scenes[0]!.layers.find((l) => l.id === added!.layerId)!;
    expect(layer.source).toEqual({ kind: 'prop', assetId: cutoutId });
    // The cutout in sampleProject is 400×800 in a 9:16 project.
    expect(layer.keyframes).toEqual([defaultPlacementKeyframe({ width: 400, height: 800 }, '9:16')]);
    expect(layer.name).toBe(cutoutLabel(added!.doc.assets.find((a) => a.id === cutoutId)!, doc));
  });

  it('a drop point maps to the document exactly (only x and y differ)', () => {
    const doc = sampleProject();
    const { sceneId, cutoutId, characterId } = ids(doc);
    const at = { x: 123.5, y: 987.25 };

    const prop = addPropToScene(doc, sceneId, cutoutId, at)!;
    const propK = prop.doc.scenes[0]!.layers.find((l) => l.id === prop.layerId)!.keyframes[0]!;
    const base = defaultPlacementKeyframe({ width: 400, height: 800 }, '9:16');
    expect(propK).toEqual({ ...base, x: 123.5, y: 987.25 });

    const character = addCharacterToScene(doc, sceneId, characterId, at)!;
    const charK = character.doc.scenes[0]!.layers.find((l) => l.id === character.layerId)!
      .keyframes[0]!;
    expect(charK.x).toBe(123.5);
    expect(charK.y).toBe(987.25);
  });

  it('a character lands showing its first pose, named after the character', () => {
    const doc = sampleProject();
    const { sceneId, characterId, poseId } = ids(doc);
    const added = addCharacterToScene(doc, sceneId, characterId)!;
    const layer = added.doc.scenes[0]!.layers.find((l) => l.id === added.layerId)!;
    expect(layer.source).toEqual({ kind: 'character', characterId });
    expect(layer.name).toBe(doc.characters[0]!.name);
    expect(layer.keyframes[0]!.poseId).toBe(poseId);
  });

  it('refuses gracefully: unknown ids and characters without poses add nothing', () => {
    const doc = sampleProject();
    const { sceneId, characterId } = ids(doc);
    expect(addPropToScene(doc, sceneId, 'nope')).toBeUndefined();
    expect(addCharacterToScene(doc, sceneId, 'nope')).toBeUndefined();
    const bare: ProjectDocument = {
      ...doc,
      characters: doc.characters.map((c) => (c.id === characterId ? { ...c, poses: [] } : c))
    };
    expect(addCharacterToScene(bare, sceneId, characterId)).toBeUndefined();
  });

  it('is one undo step through the history', () => {
    const start = sampleProject();
    const { sceneId, cutoutId } = ids(start);
    let history = createHistory(start);
    history = applyEdit(history, addPropToScene(history.present, sceneId, cutoutId)!.doc);
    expect(history.present.scenes[0]!.layers.length).toBe(start.scenes[0]!.layers.length + 1);
    history = undo(history);
    expect(history.present).toEqual(start);
  });

  it('HD cutouts are labelled', () => {
    const doc = sampleProject();
    const cutout = doc.assets.find((a) => a.type === 'cutout')!;
    const hd = { ...cutout, metadata: { ...cutout.metadata, model: 'hd' } };
    expect(cutoutLabel(hd, doc)).toMatch(/\(HD\)$/);
  });
});
