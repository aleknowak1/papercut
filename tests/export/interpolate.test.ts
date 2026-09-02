// Keyframe sampling for the export prototype (linear; easing curves are
// Phase 5).
import { describe, expect, it } from 'vitest';
import { sampleLayer } from '../../app/shared/export/interpolate';
import type { Keyframe, Layer } from '../../app/shared/document/types';

function keyframe(time: number, x: number, opacity = 1): Keyframe {
  return { time, x, y: 100, scale: 1, rotation: 0, flipX: false, opacity, easing: 'linear' };
}

const layer: Layer = {
  id: 'l1',
  name: 'test',
  source: { kind: 'prop', assetId: 'a1' },
  keyframes: [keyframe(2, 100), keyframe(4, 300, 0.5)]
};

describe('sampleLayer', () => {
  it('a layer with no keyframes is not shown', () => {
    expect(sampleLayer({ ...layer, keyframes: [] }, 1)).toBeUndefined();
  });

  it('before the first keyframe, the first keyframe applies', () => {
    expect(sampleLayer(layer, 0)?.x).toBe(100);
  });

  it('after the last keyframe, the last keyframe applies', () => {
    expect(sampleLayer(layer, 9)?.x).toBe(300);
  });

  it('between keyframes, values move linearly', () => {
    const mid = sampleLayer(layer, 3);
    expect(mid?.x).toBe(200);
    expect(mid?.opacity).toBe(0.75);
  });

  it('lands exactly on keyframe values at keyframe times', () => {
    expect(sampleLayer(layer, 2)?.x).toBe(100);
    expect(sampleLayer(layer, 4)?.x).toBe(300);
  });
});
