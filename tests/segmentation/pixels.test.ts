// The cutout pipeline's pure pixel rules (ADR-017, DOC-01 §5).

import { describe, expect, it } from 'vitest';
import {
  MODEL_INPUT_SIZE,
  WORKING_COPY_MAX_LONG_EDGE,
  cappedWorkingSize,
  composeCutout,
  logitsToMask,
  resizeMaskBilinear,
  resizeRgbaBilinear,
  rgbaToModelInput
} from '../../app/shared/segmentation/pixels';

describe('cappedWorkingSize (the 4096 rule)', () => {
  it('leaves photos at or under the cap untouched', () => {
    expect(cappedWorkingSize(4096, 3072)).toEqual({ width: 4096, height: 3072 });
    expect(cappedWorkingSize(3000, 4000)).toEqual({ width: 3000, height: 4000 });
    expect(cappedWorkingSize(10, 10)).toEqual({ width: 10, height: 10 });
  });

  it('caps a 48-megapixel photo to 4096 on the long edge, keeping proportions', () => {
    expect(cappedWorkingSize(8000, 6000)).toEqual({ width: 4096, height: 3072 });
    expect(cappedWorkingSize(6000, 8000)).toEqual({ width: 3072, height: 4096 });
  });

  it('never scales up', () => {
    const size = cappedWorkingSize(100, 50);
    expect(size.width).toBe(100);
    expect(size.height).toBe(50);
  });

  it('the cap constant matches ADR-017', () => {
    expect(WORKING_COPY_MAX_LONG_EDGE).toBe(4096);
  });
});

describe('resizeRgbaBilinear', () => {
  it('same size in, identical bytes out', () => {
    const src = new Uint8Array([10, 20, 30, 255, 200, 100, 50, 128]);
    const out = resizeRgbaBilinear(src, 2, 1, 2, 1);
    expect(Array.from(out)).toEqual(Array.from(src));
  });

  it('a solid colour stays solid at any size', () => {
    const src = new Uint8Array(8 * 8 * 4);
    for (let i = 0; i < 64; i++) src.set([7, 77, 177, 255], i * 4);
    const out = resizeRgbaBilinear(src, 8, 8, 3, 5);
    for (let i = 0; i < 15; i++) {
      expect(Array.from(out.subarray(i * 4, i * 4 + 4))).toEqual([7, 77, 177, 255]);
    }
  });
});

describe('resizeMaskBilinear', () => {
  it('interpolates between mask values', () => {
    const src = new Float32Array([0, 1]);
    const out = resizeMaskBilinear(src, 2, 1, 4, 1);
    expect(out[0]).toBeCloseTo(0, 2);
    expect(out[3]).toBeCloseTo(1, 2);
    expect(out[1]).toBeGreaterThan(0);
    expect(out[2]).toBeLessThan(1);
  });
});

describe('rgbaToModelInput', () => {
  it('produces planar CHW with ImageNet normalisation', () => {
    const n = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
    const rgba = new Uint8Array(n * 4);
    // All pixels mid-grey 128.
    for (let i = 0; i < n; i++) rgba.set([128, 128, 128, 255], i * 4);
    const input = rgbaToModelInput(rgba);
    expect(input.length).toBe(3 * n);
    // (128/255 - mean) / std for the red channel.
    expect(input[0]).toBeCloseTo((128 / 255 - 0.485) / 0.229, 5);
    // Blue plane starts at 2n.
    expect(input[2 * n]).toBeCloseTo((128 / 255 - 0.406) / 0.225, 5);
  });
});

describe('logitsToMask', () => {
  it('is a sigmoid: 0 → 0.5, large → 1, small → 0', () => {
    const mask = logitsToMask(new Float32Array([0, 10, -10]));
    expect(mask[0]).toBeCloseTo(0.5, 5);
    expect(mask[1]).toBeGreaterThan(0.99);
    expect(mask[2]).toBeLessThan(0.01);
  });
});

describe('composeCutout (the original-pixels rule, DOC-01 §5)', () => {
  it('copies RGB byte-for-byte and writes only alpha', () => {
    const rgba = new Uint8Array([1, 2, 3, 255, 200, 150, 100, 255]);
    const mask = new Float32Array([1, 0.25]);
    const out = composeCutout(rgba, mask);
    expect(Array.from(out)).toEqual([1, 2, 3, 255, 200, 150, 100, 64]);
  });

  it('clamps mask values outside 0..1', () => {
    const rgba = new Uint8Array([9, 9, 9, 255, 9, 9, 9, 255]);
    const out = composeCutout(rgba, new Float32Array([1.7, -0.5]));
    expect(out[3]).toBe(255);
    expect(out[7]).toBe(0);
  });
});
