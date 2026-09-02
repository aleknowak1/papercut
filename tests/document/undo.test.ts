// ADR-015 check "Undo": twenty random edits followed by twenty undos return
// the project to its exact starting state; twenty redos return it to the
// final state. Also proves the structural sharing the history relies on.
import { describe, expect, it } from 'vitest';
import { newId, newScene } from '../../app/shared/document/create';
import {
  addAsset,
  addAudioClip,
  addCharacter,
  addLayer,
  addScene,
  removeLayer,
  removeScene,
  renameScene,
  setKeyframe,
  setProjectName,
  setSceneDuration
} from '../../app/shared/document/edits';
import {
  applyEdit,
  canRedo,
  canUndo,
  createHistory,
  redo,
  undo
} from '../../app/shared/document/history';
import type { Keyframe, Layer, ProjectDocument } from '../../app/shared/document/types';
import { sampleProject } from '../helpers/sampleProject';

// Small seeded random generator so a failure is reproducible run to run.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomKeyframe(rand: () => number): Keyframe {
  return {
    time: Math.round(rand() * 100) / 10,
    x: Math.round(rand() * 1000),
    y: Math.round(rand() * 1000),
    scale: 1 + rand(),
    rotation: rand() * 360,
    flipX: rand() < 0.5,
    opacity: rand(),
    easing: 'linear'
  };
}

function newLayer(name: string): Layer {
  return { id: newId(), name, source: { kind: 'text', text: name }, keyframes: [] };
}

/** Picks and applies one random, always-valid edit. */
function randomEdit(doc: ProjectDocument, rand: () => number, step: number): ProjectDocument {
  const scenes = doc.scenes;
  const scene = scenes[Math.floor(rand() * scenes.length)];
  const choice = Math.floor(rand() * 10);
  switch (choice) {
    case 0:
      return setProjectName(doc, `Renamed ${step}`);
    case 1:
      return addScene(doc, newScene(`Scene ${step}`));
    case 2:
      return scene ? renameScene(doc, scene.id, `Scene renamed ${step}`) : doc;
    case 3:
      return scene ? setSceneDuration(doc, scene.id, 1 + Math.round(rand() * 30)) : doc;
    case 4:
      return scene ? addLayer(doc, scene.id, newLayer(`Layer ${step}`)) : doc;
    case 5: {
      if (!scene || scene.layers.length === 0) return setProjectName(doc, `Fallback ${step}`);
      const layer = scene.layers[Math.floor(rand() * scene.layers.length)];
      return layer ? setKeyframe(doc, scene.id, layer.id, randomKeyframe(rand)) : doc;
    }
    case 6: {
      if (!scene || scene.layers.length === 0) return setProjectName(doc, `Fallback ${step}`);
      const layer = scene.layers[Math.floor(rand() * scene.layers.length)];
      return layer ? removeLayer(doc, scene.id, layer.id) : doc;
    }
    case 7:
      return addAsset(doc, {
        id: newId(),
        type: 'image',
        file: `assets/images/${step}.jpg`,
        metadata: {}
      });
    case 8:
      return addCharacter(doc, { id: newId(), name: `Character ${step}`, poses: [] });
    default: {
      if (scenes.length > 1 && scene && rand() < 0.5) return removeScene(doc, scene.id);
      return scene
        ? addAudioClip(doc, scene.id, {
            id: newId(),
            source: { kind: 'asset', assetId: newId() },
            startSeconds: rand() * 10,
            volume: 1,
            fadeInSeconds: 0,
            fadeOutSeconds: 0
          })
        : doc;
    }
  }
}

describe('undo / redo', () => {
  it('20 random edits then 20 undos return the exact starting document', () => {
    const rand = mulberry32(20260902);
    const start = sampleProject();
    let history = createHistory(start);

    for (let step = 0; step < 20; step++) {
      history = applyEdit(history, randomEdit(history.present, rand, step));
    }
    const final = history.present;
    expect(final).not.toBe(start);

    for (let step = 0; step < 20; step++) {
      expect(canUndo(history)).toBe(true);
      history = undo(history);
    }
    // Not just equal in content — it is the very same object we started with.
    expect(history.present).toBe(start);
    expect(history.present).toEqual(start);
    expect(canUndo(history)).toBe(false);

    for (let step = 0; step < 20; step++) {
      expect(canRedo(history)).toBe(true);
      history = redo(history);
    }
    expect(history.present).toBe(final);
    expect(canRedo(history)).toBe(false);
  });

  it('an edit copies only the changed path and shares the rest (structural sharing)', () => {
    const start = sampleProject();
    const sceneToEdit = start.scenes[1];
    if (!sceneToEdit) throw new Error('sample project should have two scenes');

    const edited = setSceneDuration(start, sceneToEdit.id, 99);

    // The edited scene is a new object; everything untouched is the SAME object.
    expect(edited.scenes[1]).not.toBe(start.scenes[1]);
    expect(edited.scenes[0]).toBe(start.scenes[0]);
    expect(edited.assets).toBe(start.assets);
    expect(edited.characters).toBe(start.characters);
  });

  it('undoing with nothing to undo is a harmless no-op', () => {
    const history = createHistory(sampleProject());
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it('a new edit after undo clears the redo branch', () => {
    const start = sampleProject();
    let history = createHistory(start);
    history = applyEdit(history, setProjectName(history.present, 'A'));
    history = applyEdit(history, setProjectName(history.present, 'B'));
    history = undo(history);
    history = applyEdit(history, setProjectName(history.present, 'C'));
    expect(canRedo(history)).toBe(false);
    expect(history.present.name).toBe('C');
  });
});
