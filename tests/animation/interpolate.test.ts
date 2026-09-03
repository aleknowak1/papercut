// Keyframe sampling with easing (Phase 5): between two keyframes every
// numeric value moves along the curve recorded on the keyframe the segment
// starts from; on/off values (flip, pose) hold until the next keyframe.

import { describe, expect, it } from 'vitest';
import { sampleLayer } from '../../app/shared/animation/interpolate';
import type { EasingType, Keyframe, Layer } from '../../app/shared/document/types';

function keyframe(
  time: number,
  x: number,
  opacity = 1,
  easing: EasingType = 'linear',
  extra: Partial<Keyframe> = {}
): Keyframe {
  return { time, x, y: 100, scale: 1, rotation: 0, flipX: false, opacity, easing, ...extra };
}

function layerWith(keyframes: Keyframe[]): Layer {
  return { id: 'l1', name: 'test', source: { kind: 'prop', assetId: 'a1' }, keyframes };
}

const layer = layerWith([keyframe(2, 100), keyframe(4, 300, 0.5)]);

describe('sampleLayer', () => {
  it('a layer with no keyframes is not shown', () => {
    expect(sampleLayer(layerWith([]), 1)).toBeUndefined();
  });

  it('before the first keyframe, the first keyframe applies', () => {
    expect(sampleLayer(layer, 0)?.x).toBe(100);
  });

  it('after the last keyframe, the last keyframe applies', () => {
    expect(sampleLayer(layer, 9)?.x).toBe(300);
  });

  it('between linear keyframes, values move linearly', () => {
    const mid = sampleLayer(layer, 3);
    expect(mid?.x).toBe(200);
    expect(mid?.opacity).toBe(0.75);
  });

  it('lands exactly on keyframe values at keyframe times', () => {
    expect(sampleLayer(layer, 2)?.x).toBe(100);
    expect(sampleLayer(layer, 4)?.x).toBe(300);
  });

  it('applies the easing of the keyframe the segment starts from', () => {
    // ease-in at midpoint: progress 0.5 eases to 0.25 → x = 100 + 200·0.25.
    const easeIn = layerWith([keyframe(2, 100, 1, 'ease-in'), keyframe(4, 300)]);
    expect(sampleLayer(easeIn, 3)?.x).toBe(150);
    const easeOut = layerWith([keyframe(2, 100, 1, 'ease-out'), keyframe(4, 300)]);
    expect(sampleLayer(easeOut, 3)?.x).toBe(250);
    // ease-in-out at quarter progress (t = 2.5): 0.25 eases to 0.125.
    const easeBoth = layerWith([keyframe(2, 100, 1, 'ease-in-out'), keyframe(4, 300)]);
    expect(sampleLayer(easeBoth, 2.5)?.x).toBe(125);
    // The second keyframe's easing does not affect this segment.
    const secondEased = layerWith([keyframe(2, 100), keyframe(4, 300, 1, 'ease-in')]);
    expect(sampleLayer(secondEased, 3)?.x).toBe(200);
  });

  it('flip and pose are steps: they hold until the next keyframe is reached', () => {
    const steps = layerWith([
      keyframe(2, 100, 1, 'linear', { flipX: false, poseId: 'p1' }),
      keyframe(4, 300, 1, 'linear', { flipX: true, poseId: 'p2' })
    ]);
    expect(sampleLayer(steps, 3.9)?.flipX).toBe(false);
    expect(sampleLayer(steps, 3.9)?.poseId).toBe('p1');
    expect(sampleLayer(steps, 4)?.flipX).toBe(true);
    expect(sampleLayer(steps, 4)?.poseId).toBe('p2');
  });
});
