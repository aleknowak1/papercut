// Phase 7 step 1 (ADR-015): the scene-list edits — insert after,
// duplicate with fresh ids, reorder by one place, remove refusing the
// last scene, and the transition length through the one shared clamp.
// Every edit round-trips save/reopen and undo, every refused or pointless
// edit returns the SAME document, and the new fields validate in plain
// language while older files load unchanged.

import { describe, expect, it } from 'vitest';
import { createProject, loadProject, saveProject } from '../../app/main/projectStore';
import {
  duplicateScene,
  insertScene,
  removeScene,
  reorderScene,
  setSceneDuration,
  setSceneTransition,
  setSceneTransitionLength
} from '../../app/shared/document/edits';
import { applyEdit, createHistory, undo } from '../../app/shared/document/history';
import type { ProjectDocument, Scene } from '../../app/shared/document/types';
import { validateProjectDocument } from '../../app/shared/document/validate';
import { secondsOf } from '../../app/shared/animation/time';
import { sampleProject } from '../helpers/sampleProject';
import { suiteOutputDirs } from '../helpers/testOutput';

const tempDir = suiteOutputDirs('scene-list');

/** A deterministic id maker: dup-1, dup-2, … */
function countingIds(): () => string {
  let n = 0;
  return () => `dup-${++n}`;
}

function emptyScene(id: string, name: string): Scene {
  return { id, name, durationSeconds: 5, cameraKeyframes: [], layers: [], audioClips: [] };
}

function sceneIds(doc: ProjectDocument): string[] {
  return doc.scenes.map((s) => s.id);
}

describe('insertScene', () => {
  it('inserts right after the named scene', () => {
    const doc = sampleProject();
    const [first, second] = sceneIds(doc);
    const next = insertScene(doc, first!, emptyScene('new', 'Scene 3'));
    expect(sceneIds(next)).toEqual([first, 'new', second]);
    // Untouched scenes are the same objects (structural sharing).
    expect(next.scenes[0]).toBe(doc.scenes[0]);
    expect(next.scenes[2]).toBe(doc.scenes[1]);
  });

  it('an unknown afterSceneId returns the SAME document', () => {
    const doc = sampleProject();
    expect(insertScene(doc, 'nope', emptyScene('new', 'X'))).toBe(doc);
  });
});

describe('duplicateScene', () => {
  it('copies the whole scene with fresh ids, right after the original', () => {
    const doc = sampleProject();
    const original = doc.scenes[0]!;
    const next = duplicateScene(doc, original.id, countingIds());
    expect(next.scenes).toHaveLength(3);
    const copy = next.scenes[1]!;

    // Fresh ids for the scene, its layers, and its clips.
    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe(`${original.name} copy`);
    expect(copy.layers.map((l) => l.id)).not.toContain(original.layers[0]!.id);
    expect(copy.audioClips.map((c) => c.id)).not.toContain(original.audioClips[0]!.id);

    // Everything else copied exactly: keyframes, camera, background,
    // transition, clip timings.
    expect(copy.layers[0]!.keyframes).toEqual(original.layers[0]!.keyframes);
    expect(copy.cameraKeyframes).toEqual(original.cameraKeyframes);
    expect(copy.backgroundAssetId).toBe(original.backgroundAssetId);
    expect(copy.transitionOut).toBe(original.transitionOut);
    expect(copy.durationSeconds).toBe(original.durationSeconds);
    expect(copy.audioClips[0]!.startSeconds).toBe(original.audioClips[0]!.startSeconds);

    // A clip attached to one of the scene's own layers follows the new id.
    const attachedOriginal = original.audioClips.find((c) => c.attachedToLayerId !== undefined)!;
    const attachedCopy = copy.audioClips.find((c) => c.attachedToLayerId !== undefined)!;
    expect(attachedOriginal.attachedToLayerId).toBe(original.layers[0]!.id);
    expect(attachedCopy.attachedToLayerId).toBe(copy.layers[0]!.id);

    // The original scene is untouched — the same object.
    expect(next.scenes[0]).toBe(original);
    // The copy still validates as a document.
    expect(() => validateProjectDocument(JSON.parse(JSON.stringify(next)))).not.toThrow();
  });

  it('an unknown scene returns the SAME document', () => {
    const doc = sampleProject();
    expect(duplicateScene(doc, 'nope', countingIds())).toBe(doc);
  });
});

describe('reorderScene', () => {
  it('moves a scene one place either way, taking its transition with it', () => {
    const doc = sampleProject();
    const [first, second] = sceneIds(doc);
    const later = reorderScene(doc, first!, 1);
    expect(sceneIds(later)).toEqual([second, first]);
    // The transition lives on the scene, so it travelled with it.
    expect(later.scenes[1]!.transitionOut).toBe('crossfade');
    const back = reorderScene(later, first!, -1);
    expect(sceneIds(back)).toEqual([first, second]);
  });

  it('a move past either end, or of an unknown scene, returns the SAME document', () => {
    const doc = sampleProject();
    const [first, second] = sceneIds(doc);
    expect(reorderScene(doc, first!, -1)).toBe(doc);
    expect(reorderScene(doc, second!, 1)).toBe(doc);
    expect(reorderScene(doc, 'nope', 1)).toBe(doc);
  });
});

describe('removeScene', () => {
  it('removes a scene, but REFUSES the last one', () => {
    const doc = sampleProject();
    const [first, second] = sceneIds(doc);
    const one = removeScene(doc, second!);
    expect(sceneIds(one)).toEqual([first]);
    // A project always has a scene: the last one cannot go.
    expect(removeScene(one, first!)).toBe(one);
  });

  it('an unknown scene returns the SAME document', () => {
    const doc = sampleProject();
    expect(removeScene(doc, 'nope')).toBe(doc);
  });
});

describe('setSceneTransition and setSceneTransitionLength', () => {
  it('setting the same transition type returns the SAME document', () => {
    const doc = sampleProject();
    const sceneId = doc.scenes[0]!.id;
    expect(setSceneTransition(doc, sceneId, 'crossfade')).toBe(doc);
    expect(setSceneTransition(doc, sceneId, 'wipe').scenes[0]!.transitionOut).toBe('wipe');
  });

  it('sets a legal length as given (already a whole number of frames)', () => {
    const doc = sampleProject(); // scenes of 10 s and 4 s at 30 fps
    const sceneId = doc.scenes[0]!.id;
    expect(setSceneTransitionLength(doc, sceneId, 1).scenes[0]!.transitionOutSeconds).toBe(1);
  });

  it('clamps to 0.1–3 s and to half the shorter neighbour', () => {
    const doc = sampleProject(); // scenes of 10 s and 4 s: half the shorter is 2 s
    const sceneId = doc.scenes[0]!.id;
    expect(setSceneTransitionLength(doc, sceneId, 99).scenes[0]!.transitionOutSeconds).toBe(2);
    expect(setSceneTransitionLength(doc, sceneId, 0.001).scenes[0]!.transitionOutSeconds).toBe(0.1);
  });

  it('clamps to half the shorter neighbouring scene, then snaps DOWN to a whole frame', () => {
    // Neighbour of 4.9 s: half is 2.45 s = 73.5 frames at 30 fps — the
    // snap must go DOWN to 73 frames, never up past the clamp.
    let doc = sampleProject();
    const [first, second] = doc.scenes;
    doc = setSceneDuration(doc, second!.id, 4.9);
    const set = setSceneTransitionLength(doc, first!.id, 3);
    expect(set.scenes[0]!.transitionOutSeconds).toBe(secondsOf(73, 30));
  });

  it('on the last scene only the 0.1–3 s clamp applies', () => {
    const doc = sampleProject();
    const lastId = doc.scenes[1]!.id;
    expect(setSceneTransitionLength(doc, lastId, 99).scenes[1]!.transitionOutSeconds).toBe(3);
  });

  it('a pointless or nonsense length returns the SAME document', () => {
    const doc = sampleProject();
    const sceneId = doc.scenes[0]!.id;
    const set = setSceneTransitionLength(doc, sceneId, 1);
    expect(setSceneTransitionLength(set, sceneId, 1)).toBe(set);
    expect(setSceneTransitionLength(doc, sceneId, Number.NaN)).toBe(doc);
    expect(setSceneTransitionLength(doc, 'nope', 1)).toBe(doc);
  });
});

describe('history, save and reopen', () => {
  it('every new edit is exactly one undo step', () => {
    const start = sampleProject();
    const [first] = sceneIds(start);
    let history = createHistory(start);
    history = applyEdit(history, insertScene(history.present, first!, emptyScene('new', 'S')));
    history = applyEdit(history, duplicateScene(history.present, first!, countingIds()));
    history = applyEdit(history, reorderScene(history.present, first!, 1));
    history = applyEdit(history, removeScene(history.present, 'new'));
    history = applyEdit(history, setSceneTransitionLength(history.present, first!, 1));

    history = undo(history);
    expect(history.present.scenes.find((s) => s.id === first)!.transitionOutSeconds).toBeUndefined();
    history = undo(history);
    expect(sceneIds(history.present)).toContain('new');
    history = undo(history);
    expect(sceneIds(history.present)[0]).toBe(first);
    history = undo(history);
    expect(history.present.scenes).toHaveLength(3);
    history = undo(history);
    expect(history.present).toEqual(start);
  });

  it('the new fields survive save and reopen field for field', () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'Scenes', '16:9');
    let doc = loadProject(projectDir);
    const sceneId = doc.scenes[0]!.id;
    doc = insertScene(doc, sceneId, emptyScene('second', 'Scene 2'));
    doc = setSceneTransition(doc, sceneId, 'slide-left');
    doc = setSceneTransitionLength(doc, sceneId, 1.5);
    doc = duplicateScene(doc, sceneId, countingIds());
    saveProject(projectDir, doc);
    expect(loadProject(projectDir)).toEqual(doc);
  });

  it('an older project.json without the new field loads unchanged', () => {
    // sampleProject() carries transitionOut but no transitionOutSeconds —
    // exactly what a pre-Phase-7 file looks like.
    const older = JSON.parse(JSON.stringify(sampleProject())) as unknown;
    const loaded = validateProjectDocument(older);
    expect(loaded).toEqual(older);
    expect(loaded.scenes[0]!.transitionOutSeconds).toBeUndefined();
  });

  it('bad transition types and lengths are refused by name', () => {
    const damage = (change: (scene: Record<string, unknown>) => void): unknown => {
      const doc = JSON.parse(JSON.stringify(sampleProject())) as {
        scenes: Record<string, unknown>[];
      };
      change(doc.scenes[0]!);
      return doc;
    };
    expect(() =>
      validateProjectDocument(damage((s) => (s['transitionOut'] = 'dissolve')))
    ).toThrow(/transitionOut/);
    expect(() =>
      validateProjectDocument(damage((s) => (s['transitionOutSeconds'] = 0)))
    ).toThrow(/transitionOutSeconds/);
    expect(() =>
      validateProjectDocument(damage((s) => (s['transitionOutSeconds'] = 'fast')))
    ).toThrow(/transitionOutSeconds/);
  });
});
