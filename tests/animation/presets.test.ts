// Motion presets (Phase 5 decisions d/e): each produces the expected
// ordinary keyframes — frame-snapped, deterministic, seeded from the
// layer's own motion for everything the preset does not drive — baked in
// through applyKeyframes as ONE undo step, on top of existing keyframes,
// replacing only same-time ones.

import { describe, expect, it } from 'vitest';
import {
  bobKeyframes,
  buildPresetKeyframes,
  popKeyframes,
  shakeKeyframes,
  walkKeyframes
} from '../../app/shared/animation/presets';
import { applyKeyframes } from '../../app/shared/document/edits';
import { applyEdit, createHistory, undo } from '../../app/shared/document/history';
import type { EasingType, Keyframe, Layer, ProjectDocument } from '../../app/shared/document/types';
import { sampleProject } from '../helpers/sampleProject';

const FPS = 30;

function keyframe(
  time: number,
  x: number,
  easing: EasingType = 'linear',
  extra: Partial<Keyframe> = {}
): Keyframe {
  return { time, x, y: 500, scale: 1, rotation: 0, flipX: false, opacity: 1, easing, ...extra };
}

function layerWith(keyframes: Keyframe[]): Layer {
  return { id: 'l1', name: 'test', source: { kind: 'prop', assetId: 'a1' }, keyframes };
}

const still = layerWith([keyframe(0, 500)]);

describe('bob', () => {
  it('alternates below and above the layer’s own y every half period, settling back', () => {
    const made = bobKeyframes(still, { startTime: 0, endTime: 1.2, fps: FPS, amount: 20 });
    expect(made.map((k) => k.time)).toEqual([0, 0.3, 0.6, 0.9, 1.2]);
    expect(made.map((k) => k.y)).toEqual([500, 480, 520, 480, 500]);
    expect(made.slice(0, -1).every((k) => k.easing === 'ease-in-out')).toBe(true);
    // The end keyframe puts the layer back exactly on its own motion.
    expect(made[made.length - 1]).toMatchObject({ y: 500, x: 500, easing: 'linear' });
  });

  it('rides on top of the layer’s existing motion', () => {
    const moving = layerWith([keyframe(0, 0), keyframe(1.2, 300)]);
    const made = bobKeyframes(moving, { startTime: 0, endTime: 1.2, fps: FPS, amount: 20 });
    expect(made.map((k) => k.x)).toEqual([0, 75, 150, 225, 300]);
  });

  it('an empty or backwards range produces nothing', () => {
    expect(bobKeyframes(still, { startTime: 1, endTime: 1, fps: FPS, amount: 20 })).toEqual([]);
    expect(bobKeyframes(layerWith([]), { startTime: 0, endTime: 1, fps: FPS, amount: 20 })).toEqual(
      []
    );
  });
});

describe('shake', () => {
  it('jitters x right and left every two frames, linear, back on its motion at the end', () => {
    const made = shakeKeyframes(still, { startTime: 0, endTime: 0.2, fps: FPS, amount: 12 });
    expect(made.map((k) => k.time)).toEqual([0, 2 / 30, 4 / 30, 0.2]);
    expect(made.map((k) => k.x)).toEqual([500, 512, 488, 500]);
    expect(made.slice(0, -1).every((k) => k.easing === 'linear')).toBe(true);
  });
});

describe('walk', () => {
  it('travels straight to the destination with a hop each step', () => {
    const made = walkKeyframes(still, {
      startTime: 0,
      endTime: 1.2,
      fps: FPS,
      destination: { x: 800, y: 500 },
      bobAmount: 15
    });
    expect(made.map((k) => k.x)).toEqual([500, 575, 650, 725, 800]);
    expect(made.map((k) => k.y)).toEqual([500, 485, 500, 485, 500]);
    // Walking right keeps the picture's facing.
    expect(made.every((k) => k.flipX === false)).toBe(true);
    expect(made[made.length - 1]).toMatchObject({ x: 800, y: 500 });
  });

  it('walking left mirrors the facing, kept at the end', () => {
    const made = walkKeyframes(still, {
      startTime: 0,
      endTime: 0.6,
      fps: FPS,
      destination: { x: 200, y: 500 },
      bobAmount: 15
    });
    expect(made.every((k) => k.flipX === true)).toBe(true);
  });
});

describe('pop', () => {
  it('scale 0 → 1.15× → the layer’s own size, fading in, easing out', () => {
    const made = popKeyframes(still, { startTime: 0, durationSeconds: 0.4, fps: FPS });
    expect(made.map((k) => k.time)).toEqual([0, 8 / 30, 0.4]);
    expect(made[0]).toMatchObject({ scale: 0, opacity: 0, easing: 'ease-out' });
    expect(made[1]).toMatchObject({ scale: 1.15, opacity: 1, easing: 'ease-out' });
    expect(made[2]).toMatchObject({ scale: 1, opacity: 1 });
  });

  it('is never shorter than two frames', () => {
    const made = popKeyframes(still, { startTime: 0, durationSeconds: 0, fps: FPS });
    expect(made.map((k) => k.time)).toEqual([0, 1 / 30, 2 / 30]);
  });
});

describe('buildPresetKeyframes (the preset panel’s one door)', () => {
  it('maps each preset name to exactly the preset function’s keyframes', () => {
    const base = { startTime: 0, durationSeconds: 1.2, amount: 20, fps: FPS } as const;
    expect(buildPresetKeyframes(still, { ...base, preset: 'bob' })).toEqual(
      bobKeyframes(still, { startTime: 0, endTime: 1.2, fps: FPS, amount: 20 })
    );
    expect(buildPresetKeyframes(still, { ...base, preset: 'shake' })).toEqual(
      shakeKeyframes(still, { startTime: 0, endTime: 1.2, fps: FPS, amount: 20 })
    );
    expect(
      buildPresetKeyframes(still, { ...base, preset: 'walk', destination: { x: 800, y: 500 } })
    ).toEqual(
      walkKeyframes(still, {
        startTime: 0,
        endTime: 1.2,
        fps: FPS,
        destination: { x: 800, y: 500 },
        bobAmount: 20
      })
    );
    expect(buildPresetKeyframes(still, { ...base, preset: 'pop', durationSeconds: 0.4 })).toEqual(
      popKeyframes(still, { startTime: 0, durationSeconds: 0.4, fps: FPS })
    );
  });

  it('snaps a mid-frame start and end onto the frame grid', () => {
    const made = buildPresetKeyframes(still, {
      preset: 'bob',
      startTime: 0.301, // not a frame time at 30 fps
      durationSeconds: 0.6, // end 0.901 s, which snaps to frame 27 = 0.9 s
      amount: 20,
      fps: FPS
    });
    expect(made.map((k) => k.time)).toEqual([0.3, 0.6, 0.9]);
  });

  it('nonsense fields produce an empty list, and applyKeyframes then changes nothing', () => {
    const base = { startTime: 0, amount: 20, fps: FPS } as const;
    expect(buildPresetKeyframes(still, { ...base, preset: 'walk', durationSeconds: 1 })).toEqual(
      [] // walk without a destination
    );
    expect(buildPresetKeyframes(still, { ...base, preset: 'bob', durationSeconds: 0 })).toEqual([]);
    expect(buildPresetKeyframes(still, { ...base, preset: 'bob', durationSeconds: -2 })).toEqual([]);
    expect(
      buildPresetKeyframes(still, { preset: 'shake', startTime: 0, durationSeconds: 1, amount: Number.NaN, fps: FPS })
    ).toEqual([]);
    const base2 = sampleProject();
    expect(applyKeyframes(base2, base2.scenes[0]!.id, 'l1', [])).toBe(base2);
  });
});

describe('baking through applyKeyframes', () => {
  function docWithLayer(layer: Layer): { doc: ProjectDocument; sceneId: string } {
    const base = sampleProject();
    const scene = base.scenes[0]!;
    return {
      doc: { ...base, scenes: [{ ...scene, layers: [layer] }, ...base.scenes.slice(1)] },
      sceneId: scene.id
    };
  }

  it('adds on top of existing keyframes, replacing only same-time ones', () => {
    // One keyframe on the bob grid (0.3) and one off it (0.5, frame 15).
    const offGrid = keyframe(0.5, 500);
    const { doc, sceneId } = docWithLayer(layerWith([keyframe(0, 500), keyframe(0.3, 999), offGrid]));
    const layer = doc.scenes[0]!.layers[0]!;
    const made = bobKeyframes(layer, { startTime: 0, endTime: 1.2, fps: FPS, amount: 20 });
    const baked = applyKeyframes(doc, sceneId, layer.id, made);
    const keyframes = baked.scenes[0]!.layers[0]!.keyframes;
    expect(keyframes.map((k) => k.time)).toEqual([0, 0.3, 0.5, 0.6, 0.9, 1.2]);
    expect(keyframes.find((k) => k.time === 0.3)?.y).toBe(480); // replaced by the bob
    expect(keyframes.find((k) => k.time === 0.5)).toBe(offGrid); // untouched object
  });

  it('a whole preset is ONE undo step back to the exact starting document', () => {
    const { doc, sceneId } = docWithLayer(still);
    const layer = doc.scenes[0]!.layers[0]!;
    const made = bobKeyframes(layer, { startTime: 0, endTime: 1.2, fps: FPS, amount: 20 });
    let history = createHistory(doc);
    history = applyEdit(history, applyKeyframes(history.present, sceneId, layer.id, made));
    expect(history.present.scenes[0]!.layers[0]!.keyframes).toHaveLength(5);
    history = undo(history);
    expect(history.present).toEqual(doc);
    expect(history.past).toHaveLength(0);
  });
});
