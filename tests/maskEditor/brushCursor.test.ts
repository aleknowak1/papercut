// The brush cursor (CL-0035): its ring's diameter equals the brush's
// diameter on the photo at every zoom level, the feather ring marks the
// soft edge's real outer extent, and computing cursor geometry never
// touches the mask.

import { describe, expect, it } from 'vitest';
import {
  brushCursorDiameterPx,
  featherCursorDiameterPx
} from '../../app/shared/segmentation/brushCursor';
import { featherMask } from '../../app/shared/segmentation/mask';

describe('brush ring diameter', () => {
  it('equals the brush diameter scaled by zoom, at several zoom levels', () => {
    for (const zoom of [0.1, 0.5, 1, 2, 4, 8]) {
      expect(brushCursorDiameterPx(40, zoom)).toBeCloseTo(40 * zoom, 10);
      expect(brushCursorDiameterPx(4, zoom)).toBeCloseTo(4 * zoom, 10);
    }
  });

  it('grows and shrinks with the picture, not the screen', () => {
    // Doubling zoom doubles the ring; the brush's photo coverage is constant.
    expect(brushCursorDiameterPx(64, 2)).toBe(2 * brushCursorDiameterPx(64, 1));
    expect(brushCursorDiameterPx(64, 0.5)).toBe(0.5 * brushCursorDiameterPx(64, 1));
  });
});

describe('feather ring diameter', () => {
  it('marks the soft edge where featherMask actually reaches', () => {
    // Two box-blur passes of radius r spread a hard edge by up to 2r per
    // side. Prove it on a real mask: a kept disc's influence must be zero
    // at the feather ring's radius and beyond.
    const W = 64;
    const H = 64;
    const mask = new Uint8Array(W * H);
    const brushRadius = 8;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - 32;
        const dy = y - 32;
        if (dx * dx + dy * dy <= brushRadius * brushRadius) mask[y * W + x] = 255;
      }
    }
    const feather = 3;
    featherMask(mask, W, H, feather);
    const ringRadiusPhotoPx = featherCursorDiameterPx(brushRadius * 2, feather, 1) / 2;
    // Just beyond the ring: nothing.
    const beyond = Math.ceil(ringRadiusPhotoPx) + 1;
    expect(mask[32 * W + 32 + beyond]).toBe(0);
    // Inside the ring but outside the brush: the soft edge is visible.
    expect(mask[32 * W + 32 + brushRadius + 1]).toBeGreaterThan(0);
  });

  it('scales with zoom like the brush ring', () => {
    expect(featherCursorDiameterPx(40, 5, 2)).toBeCloseTo((40 + 20) * 2, 10);
    expect(featherCursorDiameterPx(40, 0, 3)).toBe(brushCursorDiameterPx(40, 3));
  });
});

describe('the overlay contract', () => {
  it('computing cursor geometry leaves mask pixels untouched', () => {
    const mask = new Uint8Array(256);
    for (let i = 0; i < mask.length; i++) mask[i] = (i * 37) % 251;
    const before = new Uint8Array(mask);
    for (const zoom of [0.25, 1, 4]) {
      brushCursorDiameterPx(48, zoom);
      featherCursorDiameterPx(48, 6, zoom);
    }
    expect(Buffer.from(mask).equals(Buffer.from(before))).toBe(true);
  });
});
