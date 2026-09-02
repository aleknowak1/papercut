// Scene and layers (Phase 4, ADR-015): layer order/hide/lock, background
// fit, and time-0 placement edits round-trip through save/reopen, every
// operation is one undo step, and a project.json from before these fields
// existed loads unchanged.

import { describe, expect, it } from 'vitest';
import { createProject, loadProject, saveProject } from '../../app/main/projectStore';
import {
  addLayer,
  reorderLayer,
  setKeyframe,
  setLayerHidden,
  setLayerLocked,
  setSceneBackgroundFit
} from '../../app/shared/document/edits';
import { applyEdit, createHistory, undo } from '../../app/shared/document/history';
import type { Keyframe, Layer, ProjectDocument, Scene } from '../../app/shared/document/types';
import { validateProjectDocument } from '../../app/shared/document/validate';
import { sampleProject } from '../helpers/sampleProject';
import { suiteOutputDirs } from '../helpers/testOutput';

const tempDir = suiteOutputDirs('scene');

const keyframeAtZero = (overrides: Partial<Keyframe> = {}): Keyframe => ({
  time: 0,
  x: 540,
  y: 960,
  scale: 1,
  rotation: 0,
  flipX: false,
  opacity: 1,
  easing: 'linear',
  ...overrides
});

const prop = (id: string): Layer => ({
  id,
  name: `Prop ${id}`,
  source: { kind: 'prop', assetId: `cutout-for-${id}` },
  keyframes: [keyframeAtZero()]
});

/** The sample project's first scene, with three known prop layers appended. */
function withThreeLayers(doc: ProjectDocument): ProjectDocument {
  const sceneId = doc.scenes[0]!.id;
  let next = addLayer(doc, sceneId, prop('a'));
  next = addLayer(next, sceneId, prop('b'));
  next = addLayer(next, sceneId, prop('c'));
  return next;
}

function firstScene(doc: ProjectDocument): Scene {
  return doc.scenes[0]!;
}

function layerIn(doc: ProjectDocument, layerId: string): Layer | undefined {
  return firstScene(doc).layers.find((l) => l.id === layerId);
}

describe('layer and scene edits', () => {
  it('reorders layers within the scene, clamped, ignoring unknown ids', () => {
    const doc = withThreeLayers(sampleProject());
    const sceneId = firstScene(doc).id;
    const ids = (d: ProjectDocument): string[] => firstScene(d).layers.map((l) => l.id);
    const existing = firstScene(sampleProject()).layers.length; // the sample's own layer(s)
    expect(ids(doc).slice(existing)).toEqual(['a', 'b', 'c']);

    // 'c' (front-most) sent to the back; 'a' pushed past the end clamps to front.
    const toBack = reorderLayer(doc, sceneId, 'c', 0);
    expect(ids(toBack)[0]).toBe('c');
    const toFront = reorderLayer(doc, sceneId, 'a', 99);
    expect(ids(toFront)[ids(toFront).length - 1]).toBe('a');

    expect(reorderLayer(doc, sceneId, 'nope', 0)).toEqual(doc);
    expect(reorderLayer(doc, 'nope', 'a', 0).scenes).toEqual(doc.scenes);
    // Unrelated layers are untouched objects (structural sharing).
    expect(layerIn(toBack, 'a')).toBe(layerIn(doc, 'a'));
  });

  it('hides, locks, and sets the background fit', () => {
    let doc = withThreeLayers(sampleProject());
    const sceneId = firstScene(doc).id;

    // Absent by default: older documents never carry the fields.
    expect(layerIn(doc, 'b')?.hidden).toBeUndefined();
    expect(layerIn(doc, 'b')?.locked).toBeUndefined();
    expect(firstScene(doc).backgroundFit).toBeUndefined();

    doc = setLayerHidden(doc, sceneId, 'b', true);
    doc = setLayerLocked(doc, sceneId, 'c', true);
    doc = setSceneBackgroundFit(doc, sceneId, 'stretch');
    expect(layerIn(doc, 'b')?.hidden).toBe(true);
    expect(layerIn(doc, 'c')?.locked).toBe(true);
    expect(firstScene(doc).backgroundFit).toBe('stretch');

    doc = setLayerHidden(doc, sceneId, 'b', false);
    expect(layerIn(doc, 'b')?.hidden).toBe(false);
  });

  it('placement edits replace the time-0 keyframe in place, never multiply it', () => {
    let doc = withThreeLayers(sampleProject());
    const sceneId = firstScene(doc).id;

    // A drag commit, a resize, a flip, and an opacity change, all at time 0.
    doc = setKeyframe(doc, sceneId, 'a', keyframeAtZero({ x: 100, y: 200 }));
    doc = setKeyframe(doc, sceneId, 'a', keyframeAtZero({ x: 100, y: 200, scale: 0.5 }));
    doc = setKeyframe(doc, sceneId, 'a', keyframeAtZero({ x: 100, y: 200, scale: 0.5, flipX: true }));
    doc = setKeyframe(
      doc,
      sceneId,
      'a',
      keyframeAtZero({ x: 100, y: 200, scale: 0.5, flipX: true, opacity: 0.7 })
    );

    const frames = layerIn(doc, 'a')!.keyframes;
    expect(frames).toHaveLength(1);
    expect(frames[0]).toEqual(
      keyframeAtZero({ x: 100, y: 200, scale: 0.5, flipX: true, opacity: 0.7 })
    );
  });

  it('every operation is exactly one undo step', () => {
    const start = withThreeLayers(sampleProject());
    const sceneId = firstScene(start).id;
    let history = createHistory(start);
    history = applyEdit(history, setLayerHidden(history.present, sceneId, 'a', true));
    history = applyEdit(history, setLayerLocked(history.present, sceneId, 'b', true));
    history = applyEdit(history, reorderLayer(history.present, sceneId, 'c', 0));
    history = applyEdit(history, setSceneBackgroundFit(history.present, sceneId, 'stretch'));
    history = applyEdit(
      history,
      setKeyframe(history.present, sceneId, 'a', keyframeAtZero({ x: 5, y: 5 }))
    );

    history = undo(history);
    expect(layerIn(history.present, 'a')?.keyframes[0]?.x).toBe(540);
    history = undo(history);
    expect(firstScene(history.present).backgroundFit).toBeUndefined();
    history = undo(history);
    expect(firstScene(history.present).layers[0]?.id).not.toBe('c');
    history = undo(history);
    expect(layerIn(history.present, 'b')?.locked).toBeUndefined();
    history = undo(history);
    expect(history.present).toEqual(start);
  });

  it('layer edits survive save and reopen field for field', () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'Scene', '9:16');
    let doc = withThreeLayers(loadProject(projectDir));
    const sceneId = firstScene(doc).id;
    doc = setLayerHidden(doc, sceneId, 'a', true);
    doc = setLayerLocked(doc, sceneId, 'b', true);
    doc = setSceneBackgroundFit(doc, sceneId, 'cover');
    doc = setKeyframe(doc, sceneId, 'c', keyframeAtZero({ x: 123, y: 456, scale: 0.25 }));
    saveProject(projectDir, doc);
    expect(loadProject(projectDir)).toEqual(doc);
  });

  it('a project.json from before these fields existed loads unchanged', () => {
    // sampleProject() carries none of the Phase 4 optional fields — it IS
    // the older format. It must validate and come back identical.
    const older = JSON.parse(JSON.stringify(sampleProject())) as unknown;
    const loaded = validateProjectDocument(older);
    expect(loaded).toEqual(older);
  });

  it('bad values for the new fields are refused in plain language', () => {
    const doc = withThreeLayers(sampleProject());
    const damaged = JSON.parse(JSON.stringify(doc)) as {
      scenes: { backgroundFit?: unknown; layers: { hidden?: unknown }[] }[];
    };
    damaged.scenes[0]!.backgroundFit = 'zoom';
    expect(() => validateProjectDocument(damaged)).toThrow(/backgroundFit/);

    const damaged2 = JSON.parse(JSON.stringify(doc)) as {
      scenes: { layers: { hidden?: unknown }[] }[];
    };
    damaged2.scenes[0]!.layers[0]!.hidden = 'yes';
    expect(() => validateProjectDocument(damaged2)).toThrow(/hidden/);
  });
});
