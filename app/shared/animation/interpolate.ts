// Samples a layer's keyframes at a point in time: "where is this layer,
// how big, how transparent, at second t?" The one sampling function the
// live canvas and the export both render through (via sceneStage), so what
// the user sees is what exports (ADR-006/013).
//
// Behaviour: before the first keyframe the first applies; after the last
// the last applies; between two keyframes every numeric value moves along
// the easing curve recorded on the keyframe the segment STARTS from.
// On/off values (flip, pose) are steps: they hold from their keyframe
// until the next keyframe is reached.

import type { Keyframe, Layer } from '../document/types';
import { ease } from './easing';

export interface LayerSample {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly rotation: number;
  readonly flipX: boolean;
  readonly opacity: number;
  readonly poseId?: string;
}

function toSample(k: Keyframe): LayerSample {
  return {
    x: k.x,
    y: k.y,
    scale: k.scale,
    rotation: k.rotation,
    flipX: k.flipX,
    opacity: k.opacity,
    poseId: k.poseId
  };
}

/** Returns undefined for a layer with no keyframes (it is not shown). */
export function sampleLayer(layer: Layer, time: number): LayerSample | undefined {
  const frames = layer.keyframes; // kept sorted by time by setKeyframe()
  const first = frames[0];
  if (first === undefined) return undefined;
  if (time <= first.time) return toSample(first);

  const last = frames[frames.length - 1];
  if (last === undefined || time >= last.time) return last && toSample(last);

  for (let i = 0; i + 1 < frames.length; i++) {
    const a = frames[i];
    const b = frames[i + 1];
    if (a === undefined || b === undefined) break;
    if (time < a.time || time > b.time) continue;
    const span = b.time - a.time;
    const t = span <= 0 ? 0 : ease(a.easing, (time - a.time) / span);
    const mix = (from: number, to: number): number => from + (to - from) * t;
    return {
      x: mix(a.x, b.x),
      y: mix(a.y, b.y),
      scale: mix(a.scale, b.scale),
      rotation: mix(a.rotation, b.rotation),
      // On/off values switch when the next keyframe is reached.
      flipX: a.flipX,
      opacity: mix(a.opacity, b.opacity),
      poseId: a.poseId
    };
  }
  return toSample(last);
}
