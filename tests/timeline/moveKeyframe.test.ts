// moveKeyframe and moveCameraKeyframe (Phase 6 decision c, ADR-015): a
// keyframe moves in time keeping every other value, the destination snaps
// to a whole frame, an occupied frame is refused with the SAME document
// back (no empty undo step), and moves round-trip save/reopen and undo.

import { describe, expect, it } from 'vitest';
import { createProject, loadProject, saveProject } from '../../app/main/projectStore';
import { moveCameraKeyframe, moveKeyframe } from '../../app/shared/document/edits';
import { applyEdit, createHistory, undo } from '../../app/shared/document/history';
import type { ProjectDocument } from '../../app/shared/document/types';
import { sampleProject } from '../helpers/sampleProject';
import { suiteOutputDirs } from '../helpers/testOutput';

const tempDir = suiteOutputDirs('timeline');

// The sample's first scene: one layer with keyframes at 0 and 2 s, and
// camera keyframes at 0 and 5 s.
function setup(): { doc: ProjectDocument; sceneId: string; layerId: string } {
  const doc = sampleProject();
  const scene = doc.scenes[0]!;
  return { doc, sceneId: scene.id, layerId: scene.layers[0]!.id };
}

describe('moveKeyframe', () => {
  it('moves the keyframe in time and keeps every other value', () => {
    const { doc, sceneId, layerId } = setup();
    const before = doc.scenes[0]!.layers[0]!.keyframes[1]!;
    const moved = moveKeyframe(doc, sceneId, layerId, 2, 3.5);
    const frames = moved.scenes[0]!.layers[0]!.keyframes;
    expect(frames.map((k) => k.time)).toEqual([0, 3.5]);
    expect(frames[1]).toEqual({ ...before, time: 3.5 });
  });

  it('snaps the destination to a whole frame and keeps the list sorted', () => {
    const { doc, sceneId, layerId } = setup();
    // Moving the 2 s keyframe to 0.512 s snaps to frame 15 (0.5 s) and
    // lands BEFORE nothing new — but moving the 0 s keyframe past 2 s must
    // re-sort the list.
    const snapped = moveKeyframe(doc, sceneId, layerId, 2, 0.512);
    expect(snapped.scenes[0]!.layers[0]!.keyframes.map((k) => k.time)).toEqual([0, 0.5]);
    const reordered = moveKeyframe(doc, sceneId, layerId, 0, 3);
    expect(reordered.scenes[0]!.layers[0]!.keyframes.map((k) => k.time)).toEqual([2, 3]);
    // A negative destination clamps to 0 — here 0 is free after moving 0 away.
    const clamped = moveKeyframe(reordered, sceneId, layerId, 3, -1);
    expect(clamped.scenes[0]!.layers[0]!.keyframes.map((k) => k.time)).toEqual([0, 2]);
  });

  it('refuses a destination frame that already holds a keyframe', () => {
    const { doc, sceneId, layerId } = setup();
    // 0.01 s snaps to frame 0 — occupied by the keyframe at 0.
    expect(moveKeyframe(doc, sceneId, layerId, 2, 0.01)).toBe(doc);
    expect(moveKeyframe(doc, sceneId, layerId, 2, 0)).toBe(doc);
  });

  it('a pointless or impossible move returns the same document', () => {
    const { doc, sceneId, layerId } = setup();
    expect(moveKeyframe(doc, sceneId, layerId, 2, 2)).toBe(doc);
    expect(moveKeyframe(doc, sceneId, layerId, 1.234, 3)).toBe(doc); // nothing at 1.234
    expect(moveKeyframe(doc, sceneId, 'nope', 2, 3)).toBe(doc);
    expect(moveKeyframe(doc, 'nope', layerId, 2, 3)).toBe(doc);
  });
});

describe('moveCameraKeyframe', () => {
  it('moves, snaps, refuses occupied frames, and skips pointless moves', () => {
    const { doc, sceneId } = setup();
    const before = doc.scenes[0]!.cameraKeyframes[1]!;
    const moved = moveCameraKeyframe(doc, sceneId, 5, 7.512);
    expect(moved.scenes[0]!.cameraKeyframes.map((k) => k.time)).toEqual([0, 7.5]);
    expect(moved.scenes[0]!.cameraKeyframes[1]).toEqual({ ...before, time: 7.5 });

    expect(moveCameraKeyframe(doc, sceneId, 5, 0.01)).toBe(doc); // frame 0 occupied
    expect(moveCameraKeyframe(doc, sceneId, 5, 5)).toBe(doc);
    expect(moveCameraKeyframe(doc, sceneId, 4, 6)).toBe(doc); // nothing at 4
  });
});

describe('history and files', () => {
  it('a move is one undo step and round-trips save/reopen', () => {
    const start = sampleProject();
    const sceneId = start.scenes[0]!.id;
    const layerId = start.scenes[0]!.layers[0]!.id;
    let history = createHistory(start);
    history = applyEdit(history, moveKeyframe(history.present, sceneId, layerId, 2, 4));
    history = applyEdit(history, moveCameraKeyframe(history.present, sceneId, 5, 8));
    expect(history.present.scenes[0]!.layers[0]!.keyframes[1]!.time).toBe(4);
    expect(history.present.scenes[0]!.cameraKeyframes[1]!.time).toBe(8);

    const projectDir = createProject(tempDir(), 'Moves', '9:16');
    const onDisk = { ...loadProject(projectDir), scenes: history.present.scenes };
    saveProject(projectDir, onDisk);
    expect(loadProject(projectDir)).toEqual(onDisk);

    history = undo(history);
    expect(history.present.scenes[0]!.cameraKeyframes[1]!.time).toBe(5);
    history = undo(history);
    expect(history.present).toEqual(start);
  });
});
