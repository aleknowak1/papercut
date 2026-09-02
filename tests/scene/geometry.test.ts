// The scene's pure geometry (Phase 4, ADR-015): background cover/stretch,
// the default placement of a newly added layer, and the canvas ↔ reference
// point mapping. These are the exact functions the live canvas and the
// export renderer call, so placement maps to the document exactly.

import { describe, expect, it } from 'vitest';
import {
  backgroundPlacement,
  canvasToReference,
  defaultPlacementKeyframe,
  fitCanvas,
  referenceSize,
  referenceToCanvas
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
