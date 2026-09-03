// The scene's pure geometry (Phase 4, ADR-015): background cover/stretch,
// the default placement of a newly added layer, and the canvas ↔ reference
// point mapping. These are the exact functions the live canvas and the
// export renderer call, so placement maps to the document exactly.

import { describe, expect, it } from 'vitest';
import type { Layer } from '../../app/shared/document/types';
import {
  backgroundPlacement,
  canvasToReference,
  defaultPlacementKeyframe,
  fitCanvas,
  referenceSize,
  referenceToCanvas,
  referenceToLayerPixel,
  resizeScale,
  timeZeroKeyframe
} from '../../app/shared/scene/geometry';

describe('reference space', () => {
  it('matches the Phase 2 export sizes per format', () => {
    expect(referenceSize('16:9')).toEqual({ width: 1920, height: 1080 });
    expect(referenceSize('9:16')).toEqual({ width: 1080, height: 1920 });
    expect(referenceSize('1:1')).toEqual({ width: 1080, height: 1080 });
  });
});

describe('background placement', () => {
  const frame = { width: 1080, height: 1920 }; // 9:16

  it('stretch fills the frame exactly, distorting', () => {
    expect(backgroundPlacement('stretch', { width: 4000, height: 3000 }, frame)).toEqual({
      x: 0,
      y: 0,
      width: 1080,
      height: 1920
    });
  });

  it('cover scales a landscape photo to the frame height and crops the sides, centred', () => {
    // 4000×3000 into 1080×1920: height rules (1920/3000 > 1080/4000).
    const p = backgroundPlacement('cover', { width: 4000, height: 3000 }, frame);
    expect(p.height).toBeCloseTo(1920);
    expect(p.width).toBeCloseTo(4000 * (1920 / 3000)); // 2560, wider than the frame
    expect(p.y).toBeCloseTo(0);
    expect(p.x).toBeCloseTo((1080 - 2560) / 2); // equal crop both sides
  });

  it('cover scales a portrait photo to the frame width and crops top and bottom, centred', () => {
    const wide = { width: 1920, height: 1080 }; // 16:9 frame
    const p = backgroundPlacement('cover', { width: 1000, height: 2000 }, wide);
    expect(p.width).toBeCloseTo(1920);
    expect(p.height).toBeCloseTo(2000 * (1920 / 1000)); // 3840
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo((1080 - 3840) / 2);
  });

  it('an exactly matching picture fills the frame with no crop either way', () => {
    for (const fit of ['cover', 'stretch'] as const) {
      expect(backgroundPlacement(fit, { width: 540, height: 960 }, frame)).toEqual({
        x: 0,
        y: 0,
        width: 1080,
        height: 1920
      });
    }
  });
});

describe('default placement of a new layer', () => {
  it('centres the layer and caps it at half the frame height', () => {
    const k = defaultPlacementKeyframe({ width: 1500, height: 3000 }, '9:16');
    expect(k.time).toBe(0);
    expect(k.x).toBe(540);
    expect(k.y).toBe(960);
    expect(k.scale).toBeCloseTo(960 / 3000); // 1920/2 = 960 tall on screen
    expect(k.rotation).toBe(0);
    expect(k.flipX).toBe(false);
    expect(k.opacity).toBe(1);
  });

  it('never enlarges a small picture past its natural size', () => {
    const k = defaultPlacementKeyframe({ width: 200, height: 300 }, '16:9');
    expect(k.scale).toBe(1); // 300 < 1080/2, so no scaling either way
  });

  it('records the given pose for character layers and omits it otherwise', () => {
    expect(defaultPlacementKeyframe({ width: 100, height: 100 }, '1:1', 'pose-1').poseId).toBe(
      'pose-1'
    );
    expect('poseId' in defaultPlacementKeyframe({ width: 100, height: 100 }, '1:1')).toBe(false);
  });
});

describe('the time-0 keyframe (static placement)', () => {
  const layer = (keyframes: Layer['keyframes']): Layer => ({
    id: 'l1',
    name: 'Layer',
    source: { kind: 'prop', assetId: 'cut1' },
    keyframes
  });
  const k = defaultPlacementKeyframe({ width: 100, height: 100 }, '1:1');

  it('is the first keyframe when it sits at time 0', () => {
    expect(timeZeroKeyframe(layer([k]))).toBe(k);
  });

  it('is built from how the layer looks at time 0 when the first keyframe sits later', () => {
    const later = { ...k, time: 2, x: 77, opacity: 0.5, poseId: 'p1' };
    const zero = timeZeroKeyframe(layer([later]));
    expect(zero).toEqual({ ...later, time: 0, easing: 'linear' });
  });

  it('is undefined for a layer with no keyframes', () => {
    expect(timeZeroKeyframe(layer([]))).toBeUndefined();
  });
});

describe('picking: reference point → layer pixel', () => {
  const image = { width: 200, height: 400 };
  const plain = { x: 500, y: 600, scale: 1, rotation: 0, flipX: false };

  it('maps the layer centre to the picture centre and corners to corners', () => {
    expect(referenceToLayerPixel(plain, image, { x: 500, y: 600 })).toEqual({ x: 100, y: 200 });
    expect(referenceToLayerPixel(plain, image, { x: 400, y: 400 })).toEqual({ x: 0, y: 0 });
    expect(referenceToLayerPixel(plain, image, { x: 599, y: 799 })).toEqual({ x: 199, y: 399 });
  });

  it('misses outside the picture', () => {
    expect(referenceToLayerPixel(plain, image, { x: 399, y: 600 })).toBeUndefined();
    expect(referenceToLayerPixel(plain, image, { x: 500, y: 801 })).toBeUndefined();
  });

  it('honours scale', () => {
    const half = { ...plain, scale: 0.5 };
    // 25 reference px right of centre = 50 picture px right of centre.
    expect(referenceToLayerPixel(half, image, { x: 525, y: 600 })).toEqual({ x: 150, y: 200 });
    // The picture now spans only ±50 horizontally.
    expect(referenceToLayerPixel(half, image, { x: 551, y: 600 })).toBeUndefined();
  });

  it('honours flip', () => {
    const flipped = { ...plain, flipX: true };
    expect(referenceToLayerPixel(flipped, image, { x: 525, y: 600 })).toEqual({ x: 75, y: 200 });
  });

  it('honours rotation', () => {
    const turned = { ...plain, rotation: 90 }; // picture turned clockwise
    // 90° clockwise sends the picture's "up" to the right: a point to the
    // right of centre was ABOVE the centre in picture space (smaller y).
    const hit = referenceToLayerPixel(turned, image, { x: 550, y: 600 });
    expect(hit?.x).toBeCloseTo(100);
    expect(hit?.y).toBeCloseTo(150);
  });
});

describe('uniform corner resize', () => {
  const center = { x: 500, y: 600 };

  it('doubles the scale when the pointer moves twice as far from the centre', () => {
    expect(resizeScale(0.4, center, { x: 600, y: 600 }, { x: 700, y: 600 })).toBeCloseTo(0.8);
  });

  it('shrinks when the pointer moves closer', () => {
    expect(resizeScale(1, center, { x: 500, y: 800 }, { x: 500, y: 700 })).toBeCloseTo(0.5);
  });

  it('never collapses to zero or explodes', () => {
    expect(resizeScale(1, center, { x: 600, y: 600 }, { x: 500, y: 600 })).toBe(0.01);
    expect(resizeScale(50, center, { x: 501, y: 600 }, { x: 900, y: 600 })).toBe(100);
    expect(resizeScale(1, center, center, { x: 900, y: 600 })).toBe(1); // degenerate start
  });
});

describe('canvas fit and point mapping', () => {
  it('fits the reference frame into the available space without distortion', () => {
    // 9:16 into a 400×800 hole: width rules (400/1080 < 800/1920).
    const fit = fitCanvas('9:16', { width: 400, height: 800 });
    expect(fit.scale).toBeCloseTo(400 / 1080);
    expect(fit.width).toBeCloseTo(400);
    expect(fit.height).toBeCloseTo(1920 * (400 / 1080));
    expect(fit.height).toBeLessThanOrEqual(800);
  });

  it('maps canvas points to reference points and back exactly', () => {
    const fit = fitCanvas('16:9', { width: 960, height: 700 }); // scale 0.5
    expect(fit.scale).toBeCloseTo(0.5);
    const ref = canvasToReference({ x: 480, y: 270 }, fit);
    expect(ref.x).toBeCloseTo(960);
    expect(ref.y).toBeCloseTo(540);
    const back = referenceToCanvas(ref, fit);
    expect(back.x).toBeCloseTo(480);
    expect(back.y).toBeCloseTo(270);
  });
});
