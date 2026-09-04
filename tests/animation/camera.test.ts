// The camera as arithmetic (Phase 5 decision g and step 6): sampling with
// easing, the clamp that never shows black edges, the transform sceneStage
// applies, the view↔world mapping picking runs through — and the camera
// edits round-tripping save/reopen and undo.

import { describe, expect, it } from 'vitest';
import {
  cameraKeyframeAtPlayhead,
  cameraTransform,
  clampCamera,
  defaultCamera,
  panCamera,
  sampleCamera,
  viewToWorld,
  worldToView,
  zoomCamera
} from '../../app/shared/animation/camera';
import { removeCameraKeyframe, setCameraKeyframe } from '../../app/shared/document/edits';
import { applyEdit, createHistory, undo } from '../../app/shared/document/history';
import type { CameraKeyframe, Scene } from '../../app/shared/document/types';
import { validateProjectDocument } from '../../app/shared/document/validate';
import { createProject, loadProject, saveProject } from '../../app/main/projectStore';
import { sampleProject } from '../helpers/sampleProject';
import { suiteOutputDirs } from '../helpers/testOutput';

const tempDir = suiteOutputDirs('camera');
const FRAME = { width: 1920, height: 1080 };

function cameraScene(cameraKeyframes: CameraKeyframe[]): Scene {
  return {
    id: 's1',
    name: 'Scene',
    durationSeconds: 5,
    cameraKeyframes,
    layers: [],
    audioClips: []
  };
}

const centred = { x: 960, y: 540 };

describe('pan and zoom steps (the camera authoring UI’s arithmetic)', () => {
  it('a pan drag moves the centre against the drag, scaled by the zoom', () => {
    const start = { x: 960, y: 540, zoom: 2 };
    // Dragging the picture 100 right / 50 down: the camera looks 50/25 left/up.
    expect(panCamera(start, { x: 100, y: 50 }, FRAME)).toEqual({ x: 910, y: 515, zoom: 2 });
  });

  it('a pan can never leave the frame', () => {
    const start = { x: 960, y: 540, zoom: 2 };
    // At zoom 2 the centre may travel x 480..1440, y 270..810.
    expect(panCamera(start, { x: 99999, y: 99999 }, FRAME)).toEqual({ x: 480, y: 270, zoom: 2 });
    expect(panCamera(start, { x: -99999, y: -99999 }, FRAME)).toEqual({
      x: 1440,
      y: 810,
      zoom: 2
    });
  });

  it('at zoom 1 a pan does nothing — the whole frame is already shown', () => {
    expect(panCamera({ x: 960, y: 540, zoom: 1 }, { x: 300, y: 200 }, FRAME)).toEqual({
      x: 960,
      y: 540,
      zoom: 1
    });
  });

  it('a zoom step multiplies the zoom and keeps the centre where it can', () => {
    expect(zoomCamera({ x: 960, y: 540, zoom: 2 }, 1.5, FRAME)).toEqual({
      x: 960,
      y: 540,
      zoom: 3
    });
  });

  it('zooming out near an edge slides the view back inside the frame', () => {
    // At zoom 4 the centre may sit at x 240; at zoom 2 it must be ≥ 480.
    expect(zoomCamera({ x: 240, y: 135, zoom: 4 }, 0.5, FRAME)).toEqual({
      x: 480,
      y: 270,
      zoom: 2
    });
    // Zooming below 1 lands exactly on the whole centred frame.
    expect(zoomCamera({ x: 960, y: 540, zoom: 1.1 }, 0.5, FRAME)).toEqual({
      x: 960,
      y: 540,
      zoom: 1
    });
  });
});

describe('camera sampling and clamping', () => {
  it('no camera keyframes means centred at zoom 1', () => {
    expect(defaultCamera(FRAME)).toEqual({ ...centred, zoom: 1 });
    expect(sampleCamera(cameraScene([]), 2, FRAME)).toEqual({ ...centred, zoom: 1 });
  });

  it('clamps zoom to at least 1 and forces the centre at zoom 1', () => {
    expect(clampCamera({ x: 100, y: 2000, zoom: 0.5 }, FRAME)).toEqual({ ...centred, zoom: 1 });
  });

  it('holds the view inside the frame at any zoom', () => {
    // At zoom 2 the view is 960×540; its centre may sit 480..1440 / 270..810.
    expect(clampCamera({ x: 100, y: 100, zoom: 2 }, FRAME)).toEqual({ x: 480, y: 270, zoom: 2 });
    expect(clampCamera({ x: 5000, y: 5000, zoom: 2 }, FRAME)).toEqual({
      x: 1440,
      y: 810,
      zoom: 2
    });
    // A legal position is untouched.
    expect(clampCamera({ x: 700, y: 500, zoom: 2 }, FRAME)).toEqual({ x: 700, y: 500, zoom: 2 });
  });

  it('interpolates between keyframes with the segment-start easing, then clamps', () => {
    const scene = cameraScene([
      { time: 0, x: 480, y: 270, zoom: 2, easing: 'ease-in' },
      { time: 4, x: 1440, y: 810, zoom: 2, easing: 'linear' }
    ]);
    // Midpoint progress 0.5 eases (ease-in) to 0.25.
    expect(sampleCamera(scene, 2, FRAME)).toEqual({ x: 720, y: 405, zoom: 2 });
    // Before the first and after the last keyframe those apply.
    expect(sampleCamera(scene, -1, FRAME)).toEqual({ x: 480, y: 270, zoom: 2 });
    expect(sampleCamera(scene, 99, FRAME)).toEqual({ x: 1440, y: 810, zoom: 2 });
  });

  it('a keyframe outside the frame renders clamped — no black edges ever', () => {
    const scene = cameraScene([{ time: 0, x: 0, y: 0, zoom: 2, easing: 'linear' }]);
    expect(sampleCamera(scene, 0, FRAME)).toEqual({ x: 480, y: 270, zoom: 2 });
  });
});

describe('cameraKeyframeAtPlayhead', () => {
  it('returns the scene’s own keyframe at an exact time', () => {
    const k: CameraKeyframe = { time: 1, x: 700, y: 500, zoom: 2, easing: 'ease-out' };
    expect(cameraKeyframeAtPlayhead(cameraScene([k]), 1, FRAME)).toBe(k);
  });

  it('seeds from the camera at that instant, inheriting the segment’s easing', () => {
    const scene = cameraScene([
      { time: 0, x: 480, y: 270, zoom: 2, easing: 'ease-in' },
      { time: 4, x: 1440, y: 810, zoom: 2, easing: 'linear' }
    ]);
    const made = cameraKeyframeAtPlayhead(scene, 2, FRAME);
    expect(made).toEqual({ time: 2, x: 720, y: 405, zoom: 2, easing: 'ease-in' });
  });

  it('with no keyframes seeds the default camera', () => {
    expect(cameraKeyframeAtPlayhead(cameraScene([]), 1.5, FRAME)).toEqual({
      time: 1.5,
      ...centred,
      zoom: 1,
      easing: 'linear'
    });
  });
});

describe('camera transform and view↔world mapping', () => {
  it('the default camera is the identity transform', () => {
    expect(cameraTransform(defaultCamera(FRAME), FRAME)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('zoom about the centre scales and shifts so the camera point lands centred', () => {
    expect(cameraTransform({ ...centred, zoom: 2 }, FRAME)).toEqual({
      scale: 2,
      x: -960,
      y: -540
    });
  });

  it('viewToWorld and worldToView invert each other and hit known values', () => {
    const camera = { x: 700, y: 400, zoom: 2 };
    // The view's top-left corner shows the world point half a view away.
    expect(viewToWorld({ x: 0, y: 0 }, camera, FRAME)).toEqual({ x: 220, y: 130 });
    // The frame centre always shows the camera's own point.
    expect(viewToWorld({ x: 960, y: 540 }, camera, FRAME)).toEqual({ x: 700, y: 400 });
    const p = { x: 123, y: 456 };
    expect(worldToView(viewToWorld(p, camera, FRAME), camera, FRAME)).toEqual(p);
    // With the default camera both mappings are the identity.
    expect(viewToWorld(p, defaultCamera(FRAME), FRAME)).toEqual(p);
  });
});

describe('camera keyframe edits', () => {
  const k = (time: number, x = 960): CameraKeyframe => ({
    time,
    x,
    y: 540,
    zoom: 1.5,
    easing: 'linear'
  });

  it('keeps keyframes sorted and replaces one at the same time', () => {
    const doc = sampleProject();
    const scene = doc.scenes[1]!; // the scene with no camera keyframes
    let next = setCameraKeyframe(doc, scene.id, k(2));
    next = setCameraKeyframe(next, scene.id, k(1));
    next = setCameraKeyframe(next, scene.id, k(2, 700)); // same time replaces
    const times = next.scenes[1]!.cameraKeyframes;
    expect(times.map((c) => c.time)).toEqual([1, 2]);
    expect(times[1]?.x).toBe(700);
    // Removing leaves the other untouched; unknown times change nothing.
    const removed = removeCameraKeyframe(next, scene.id, 1);
    expect(removed.scenes[1]!.cameraKeyframes.map((c) => c.time)).toEqual([2]);
    // Removing a time with no keyframe returns the SAME document — no
    // empty undo step. The LAST camera keyframe may go (whole frame shows).
    expect(removeCameraKeyframe(removed, scene.id, 99)).toBe(removed);
    expect(removeCameraKeyframe(removed, scene.id, 2).scenes[1]!.cameraKeyframes).toEqual([]);
  });

  it('each edit is one undo step back to the exact starting document', () => {
    const start = sampleProject();
    const sceneId = start.scenes[1]!.id;
    let history = createHistory(start);
    history = applyEdit(history, setCameraKeyframe(history.present, sceneId, k(1)));
    history = applyEdit(history, removeCameraKeyframe(history.present, sceneId, 1));
    history = undo(history);
    expect(history.present.scenes[1]!.cameraKeyframes).toHaveLength(1);
    history = undo(history);
    expect(history.present).toEqual(start);
  });

  it('camera edits survive save and reopen field for field', () => {
    const projectDir = createProject(tempDir(), 'Camera', '16:9');
    let doc = loadProject(projectDir);
    const sceneId = doc.scenes[0]!.id;
    doc = setCameraKeyframe(doc, sceneId, k(0));
    doc = setCameraKeyframe(doc, sceneId, { time: 2, x: 700, y: 400, zoom: 2, easing: 'ease-in' });
    saveProject(projectDir, doc);
    expect(loadProject(projectDir)).toEqual(doc);
  });

  it('a damaged camera keyframe is refused in plain language', () => {
    const doc = JSON.parse(JSON.stringify(sampleProject())) as {
      scenes: { cameraKeyframes: Record<string, unknown>[] }[];
    };
    doc.scenes[0]!.cameraKeyframes[0]!['zoom'] = 'big';
    expect(() => validateProjectDocument(doc)).toThrow(
      /scenes\[0\]\.cameraKeyframes\[0\]\.zoom should be a number/
    );
  });
});
