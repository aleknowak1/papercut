// Pure geometry for the scene: the reference space keyframes live in, how
// a background image fills the frame, where a newly added layer starts,
// and how canvas pixels map to reference coordinates. The live scene
// canvas and the export renderer both use exactly these functions, so
// "placement maps to the document exactly" is checkable arithmetic, not a
// promise (ADR-006: what you see is what exports).

import type { BackgroundFit, Keyframe, Layer, ProjectFormat } from '../document/types';
import { sampleLayer } from '../export/interpolate';

/** The coordinate space keyframes are authored in, per project format. */
export const REFERENCE_SIZE: Record<ProjectFormat, readonly [number, number]> = {
  '16:9': [1920, 1080],
  '9:16': [1080, 1920],
  '1:1': [1080, 1080]
};

export interface Size {
  readonly width: number;
  readonly height: number;
}

export function referenceSize(format: ProjectFormat): Size {
  const [width, height] = REFERENCE_SIZE[format];
  return { width, height };
}

export interface Placement {
  /** Top-left corner and size, in reference pixels. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where a background image sits in the frame. 'cover' scales it uniformly
 * until it fills the frame and centres it, cropping the overflow (the
 * default); 'stretch' distorts it to fit exactly.
 */
export function backgroundPlacement(
  fit: BackgroundFit,
  image: Size,
  frame: Size
): Placement {
  if (fit === 'stretch' || image.width <= 0 || image.height <= 0) {
    return { x: 0, y: 0, width: frame.width, height: frame.height };
  }
  const scale = Math.max(frame.width / image.width, frame.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { x: (frame.width - width) / 2, y: (frame.height - height) / 2, width, height };
}

/**
 * The keyframe a newly added layer starts with: time 0, centred in the
 * frame, uniform scale chosen so the picture stands at most half the frame
 * height (a small picture keeps its natural size; nothing is blown up).
 */
export function defaultPlacementKeyframe(
  image: Size,
  format: ProjectFormat,
  poseId?: string
): Keyframe {
  const frame = referenceSize(format);
  const scale =
    image.height > 0 ? Math.min(1, frame.height / 2 / image.height) : 1;
  return {
    time: 0,
    x: frame.width / 2,
    y: frame.height / 2,
    scale,
    rotation: 0,
    flipX: false,
    opacity: 1,
    easing: 'linear',
    ...(poseId !== undefined ? { poseId } : {})
  };
}

/**
 * The layer's static placement: its keyframe at time 0, which every
 * placement edit rewrites in place through setKeyframe (full keyframing is
 * Phase 5). A layer from an older project whose first keyframe sits later
 * gets one made from how it looks at time 0; a layer with no keyframes has
 * no placement (undefined — it is not shown).
 */
export function timeZeroKeyframe(layer: Layer): Keyframe | undefined {
  const first = layer.keyframes[0];
  if (first === undefined) return undefined;
  if (first.time === 0) return first;
  const sample = sampleLayer(layer, 0);
  if (sample === undefined) return undefined;
  return {
    time: 0,
    x: sample.x,
    y: sample.y,
    scale: sample.scale,
    rotation: sample.rotation,
    flipX: sample.flipX,
    opacity: sample.opacity,
    easing: 'linear',
    ...(sample.poseId !== undefined ? { poseId: sample.poseId } : {})
  };
}

export interface CanvasFit {
  /** Canvas size in screen pixels, and reference-pixels → screen-pixels scale. */
  readonly width: number;
  readonly height: number;
  readonly scale: number;
}

/**
 * Fits the reference frame into the screen space available to the canvas,
 * as large as possible without cropping or distortion.
 */
export function fitCanvas(format: ProjectFormat, available: Size): CanvasFit {
  const frame = referenceSize(format);
  const scale = Math.max(
    0,
    Math.min(available.width / frame.width, available.height / frame.height)
  );
  return { width: frame.width * scale, height: frame.height * scale, scale };
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A point on the canvas (screen pixels from its top-left) in reference pixels. */
export function canvasToReference(point: Point, fit: CanvasFit): Point {
  return { x: point.x / fit.scale, y: point.y / fit.scale };
}

/** A point in reference pixels on the canvas (screen pixels from its top-left). */
export function referenceToCanvas(point: Point, fit: CanvasFit): Point {
  return { x: point.x * fit.scale, y: point.y * fit.scale };
}
