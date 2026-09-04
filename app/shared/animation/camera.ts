// The scene camera as pure arithmetic: what the camera shows at second t
// (from Scene.cameraKeyframes, eased like layer keyframes), the clamp that
// keeps the view inside the frame (Phase 5 decision g: zoom >= 1, a camera
// move never shows black edges), the transform sceneStage applies so the
// camera's x/y lands at the frame centre, and the view <-> world mapping
// the editor's picking and dragging run through. The clamp runs here, at
// the sampling entry point, so even a hand-edited project.json can never
// render past the frame's edges.

import type { CameraKeyframe, Scene } from '../document/types';
import type { Size } from '../scene/geometry';
import { ease } from './easing';

export interface CameraSample {
  /** The reference-space point at the centre of the view. */
  readonly x: number;
  readonly y: number;
  /** How magnified the view is; 1 shows the whole frame. */
  readonly zoom: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The camera when a scene has no camera keyframes: whole frame, centred. */
export function defaultCamera(frame: Size): CameraSample {
  return { x: frame.width / 2, y: frame.height / 2, zoom: 1 };
}

/**
 * Keeps the view inside the frame: zoom at least 1, and the centre held
 * far enough from the edges that the view's rectangle never leaves it.
 * At zoom 1 the centre is forced to exactly the frame centre.
 */
export function clampCamera(sample: CameraSample, frame: Size): CameraSample {
  const zoom = Math.max(1, sample.zoom);
  const halfWidth = frame.width / (2 * zoom);
  const halfHeight = frame.height / (2 * zoom);
  return {
    x: Math.min(Math.max(sample.x, halfWidth), frame.width - halfWidth),
    y: Math.min(Math.max(sample.y, halfHeight), frame.height - halfHeight),
    zoom
  };
}

/**
 * The camera at second t, clamped. Before the first keyframe the first
 * applies; after the last the last; between two, values move along the
 * easing recorded on the keyframe the segment starts from — the same
 * rules as layer keyframes.
 */
export function sampleCamera(scene: Scene, time: number, frame: Size): CameraSample {
  const frames = scene.cameraKeyframes; // kept sorted by setCameraKeyframe()
  const first = frames[0];
  if (first === undefined) return defaultCamera(frame);
  if (time <= first.time) return clampCamera(first, frame);
  const last = frames[frames.length - 1];
  if (last === undefined || time >= last.time) return clampCamera(last ?? first, frame);
  for (let i = 0; i + 1 < frames.length; i++) {
    const a = frames[i];
    const b = frames[i + 1];
    if (a === undefined || b === undefined) break;
    if (time < a.time || time > b.time) continue;
    const span = b.time - a.time;
    const t = span <= 0 ? 0 : ease(a.easing, (time - a.time) / span);
    const mix = (from: number, to: number): number => from + (to - from) * t;
    return clampCamera(
      { x: mix(a.x, b.x), y: mix(a.y, b.y), zoom: mix(a.zoom, b.zoom) },
      frame
    );
  }
  return clampCamera(last, frame);
}

/**
 * The camera keyframe an edit writes at time t (the layer rule, decision
 * a, applied to the camera): the scene's own keyframe when one sits at
 * exactly t, otherwise a new one seeded from the camera at that instant,
 * copying the easing of the segment it splits.
 */
export function cameraKeyframeAtPlayhead(
  scene: Scene,
  time: number,
  frame: Size
): CameraKeyframe {
  const exact = scene.cameraKeyframes.find((k) => k.time === time);
  if (exact !== undefined) return exact;
  const sample = sampleCamera(scene, time, frame);
  let before: CameraKeyframe | undefined;
  for (const k of scene.cameraKeyframes) if (k.time < time) before = k;
  return {
    time,
    x: sample.x,
    y: sample.y,
    zoom: sample.zoom,
    easing: before?.easing ?? 'linear'
  };
}

/**
 * The camera after a pan drag: the world under the cursor follows the
 * cursor, so the centre moves AGAINST the drag, scaled by the zoom (a
 * drag of d view pixels is d/zoom world pixels). Clamped like every
 * camera value.
 */
export function panCamera(
  start: CameraSample,
  viewDelta: Point,
  frame: Size
): CameraSample {
  return clampCamera(
    {
      x: start.x - viewDelta.x / start.zoom,
      y: start.y - viewDelta.y / start.zoom,
      zoom: start.zoom
    },
    frame
  );
}

/**
 * The camera after a zoom step (wheel or slider): the zoom multiplied by
 * the factor, the centre kept and then clamped — so zooming out near an
 * edge slides the view back inside the frame, never past it.
 */
export function zoomCamera(sample: CameraSample, factor: number, frame: Size): CameraSample {
  return clampCamera({ x: sample.x, y: sample.y, zoom: sample.zoom * factor }, frame);
}

export interface CameraTransform {
  /** Scale for the world container, and where its origin goes. */
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

/**
 * The transform sceneStage applies to the picture: scaled by the zoom and
 * shifted so the camera's x/y sits at the frame centre. With the default
 * camera this is the identity.
 */
export function cameraTransform(sample: CameraSample, frame: Size): CameraTransform {
  return {
    scale: sample.zoom,
    x: frame.width / 2 - sample.x * sample.zoom,
    y: frame.height / 2 - sample.y * sample.zoom
  };
}

/**
 * A point in the VIEWED frame (reference pixels of what is on screen)
 * mapped to WORLD coordinates (where layer keyframes live). Picking and
 * drag deltas run through this so clicks land on the right layer at any
 * zoom. The inverse of worldToView.
 */
export function viewToWorld(point: Point, sample: CameraSample, frame: Size): Point {
  return {
    x: sample.x + (point.x - frame.width / 2) / sample.zoom,
    y: sample.y + (point.y - frame.height / 2) / sample.zoom
  };
}

/** A world point (layer space) mapped to the viewed frame. */
export function worldToView(point: Point, sample: CameraSample, frame: Size): Point {
  return {
    x: frame.width / 2 + (point.x - sample.x) * sample.zoom,
    y: frame.height / 2 + (point.y - sample.y) * sample.zoom
  };
}
