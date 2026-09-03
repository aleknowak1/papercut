// The keyframe an edit writes at the playhead (Phase 5 decision a), and
// the keyframe-jumping helpers the time strip uses. Keyframe creation is
// automatic: an edit at a time with no keyframe makes one there, seeded
// from how the layer looks at that instant, so nothing jumps and the
// properties the edit did not touch keep their motion. An edit at an
// existing keyframe's time rewrites it in place — with the playhead at 0
// the app behaves exactly as it did in Phase 4.

import type { Keyframe, Layer } from '../document/types';
import { sampleLayer } from './interpolate';

/**
 * The keyframe for an edit at time t: the layer's own keyframe when one
 * sits at exactly t (times are frame-snapped by time.ts, so equality is
 * exact), otherwise a new one at t seeded from sampleLayer. The seeded
 * keyframe copies the easing of the segment it splits, so the feel of the
 * motion after it changes as little as the four curves allow. A layer with
 * no keyframes has no placement (undefined).
 */
export function keyframeAtPlayhead(layer: Layer, time: number): Keyframe | undefined {
  const exact = layer.keyframes.find((k) => k.time === time);
  if (exact !== undefined) return exact;
  const sample = sampleLayer(layer, time);
  if (sample === undefined) return undefined;
  let before: Keyframe | undefined;
  for (const k of layer.keyframes) if (k.time < time) before = k;
  return {
    time,
    x: sample.x,
    y: sample.y,
    scale: sample.scale,
    rotation: sample.rotation,
    flipX: sample.flipX,
    opacity: sample.opacity,
    easing: before?.easing ?? 'linear',
    ...(sample.poseId !== undefined ? { poseId: sample.poseId } : {})
  };
}

/** The layer's nearest keyframe time strictly before t, or undefined. */
export function prevKeyframeTime(layer: Layer, time: number): number | undefined {
  let found: number | undefined;
  for (const k of layer.keyframes) if (k.time < time) found = k.time;
  return found;
}

/** The layer's nearest keyframe time strictly after t, or undefined. */
export function nextKeyframeTime(layer: Layer, time: number): number | undefined {
  for (const k of layer.keyframes) if (k.time > time) return k.time;
  return undefined;
}
