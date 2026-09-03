// keyframeAtPlayhead (Phase 5 decision a): an edit at an existing
// keyframe's time rewrites it in place; anywhere else it gets a new
// keyframe seeded from the layer's motion at that instant. Also covers
// the older-file rule: a project.json whose keyframes carry times that do
// not sit on whole frames loads unchanged, and an edit there creates a new
// frame-snapped keyframe BESIDE the old one — never rewriting it.

import { describe, expect, it } from 'vitest';
import {
  keyframeAtPlayhead,
  nextKeyframeTime,
  prevKeyframeTime
} from '../../app/shared/animation/keyframes';
import { secondsOf, snapToFrame } from '../../app/shared/animation/time';
import { setKeyframe } from '../../app/shared/document/edits';
import type { EasingType, Keyframe, Layer } from '../../app/shared/document/types';
import { validateProjectDocument } from '../../app/shared/document/validate';
import { sampleProject } from '../helpers/sampleProject';

function keyframe(
  time: number,
  x: number,
  easing: EasingType = 'linear',
  extra: Partial<Keyframe> = {}
): Keyframe {
  return { time, x, y: 100, scale: 1, rotation: 0, flipX: false, opacity: 1, easing, ...extra };
}

function layerWith(keyframes: Keyframe[]): Layer {
  return { id: 'l1', name: 'test', source: { kind: 'prop', assetId: 'a1' }, keyframes };
}

describe('keyframeAtPlayhead', () => {
  it('returns the layer’s own keyframe at an exact keyframe time', () => {
    const k = keyframe(2, 100);
    const layer = layerWith([k, keyframe(4, 300)]);
    expect(keyframeAtPlayhead(layer, 2)).toBe(k); // the very object — edited in place
  });

  it('seeds a new keyframe from the motion between keyframes, inheriting the segment’s easing', () => {
    const layer = layerWith([keyframe(2, 100, 'ease-in', { poseId: 'p1' }), keyframe(4, 300)]);
    const made = keyframeAtPlayhead(layer, 3);
    expect(made).not.toBe(layer.keyframes[0]);
    // Position sampled at t=3 through the ease-in curve (progress 0.5 → 0.25).
    expect(made?.x).toBe(150);
    expect(made?.time).toBe(3);
    expect(made?.easing).toBe('ease-in'); // the segment it splits
    expect(made?.poseId).toBe('p1'); // the pose that was showing keeps showing
  });

  it('before the first keyframe, seeds from the first with linear easing', () => {
    const layer = layerWith([keyframe(2, 100, 'ease-out')]);
    const made = keyframeAtPlayhead(layer, 1);
    expect(made?.x).toBe(100);
    expect(made?.time).toBe(1);
    expect(made?.easing).toBe('linear'); // no segment before it to inherit from
  });

  it('a layer with no keyframes has no placement', () => {
    expect(keyframeAtPlayhead(layerWith([]), 0)).toBeUndefined();
  });

  it('with the playhead at 0 a time-0 layer behaves exactly as Phase 4 did', () => {
    const k = keyframe(0, 540);
    expect(keyframeAtPlayhead(layerWith([k]), 0)).toBe(k);
  });
});

describe('prev/next keyframe for the time strip', () => {
  const layer = layerWith([keyframe(0, 0), keyframe(2, 100), keyframe(4, 300)]);

  it('finds strict neighbours, skipping the keyframe under the playhead', () => {
    expect(prevKeyframeTime(layer, 2)).toBe(0);
    expect(nextKeyframeTime(layer, 2)).toBe(4);
    expect(prevKeyframeTime(layer, 3)).toBe(2);
    expect(nextKeyframeTime(layer, 3)).toBe(4);
  });

  it('answers undefined past the ends', () => {
    expect(prevKeyframeTime(layer, 0)).toBeUndefined();
    expect(nextKeyframeTime(layer, 4)).toBeUndefined();
  });
});

describe('older project.json with non-frame-aligned keyframe times', () => {
  // A hand-made or pre-Phase-5 file may carry keyframes at times like
  // 0.3333 s, which sit on no whole frame at 30 fps. The file must load
  // unchanged, and an edit at the (snapped) playhead must create a new
  // keyframe beside the old one — never crash or silently rewrite it.
  function olderDoc() {
    const doc = sampleProject();
    const scene = doc.scenes[0]!;
    const layer = scene.layers[0]!;
    const offGrid = keyframe(0.3333, 100);
    return {
      doc: {
        ...doc,
        scenes: [{ ...scene, layers: [{ ...layer, keyframes: [offGrid] }] }]
      },
      sceneId: scene.id,
      layerId: layer.id,
      offGrid
    };
  }

  it('loads unchanged, field for field', () => {
    const { doc } = olderDoc();
    const parsed = JSON.parse(JSON.stringify(doc)) as unknown;
    expect(validateProjectDocument(parsed)).toEqual(doc);
  });

  it('an edit at the snapped playhead adds a frame-snapped keyframe beside the old one', () => {
    const { doc, sceneId, layerId, offGrid } = olderDoc();
    const layer = doc.scenes[0]!.layers[0]!;
    const playhead = snapToFrame(0.3333, 30); // frame 10 = 1/3 s, not 0.3333
    expect(playhead).toBe(secondsOf(10, 30));
    expect(playhead).not.toBe(offGrid.time);

    const seed = keyframeAtPlayhead(layer, playhead);
    expect(seed).toBeDefined();
    const edited = setKeyframe(doc, sceneId, layerId, { ...seed!, x: 999 });
    const keyframes = edited.scenes[0]!.layers[0]!.keyframes;
    expect(keyframes).toHaveLength(2);
    expect(keyframes[0]).toEqual(offGrid); // the old keyframe is untouched
    expect(keyframes[1]?.time).toBe(playhead);
    expect(keyframes[1]?.x).toBe(999);
  });
});
