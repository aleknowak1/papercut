// The mask editor's pure operations (M-2.4, ADR-015): a known brush stroke
// and a known feather on a known mask give the expected pixels; the patch
// mechanism its local undo uses restores bytes exactly.

import { describe, expect, it } from 'vitest';
import {
  applyPatch,
  extractPatch,
  featherMask,
  stampBrush
} from '../../app/shared/segmentation/mask';

const W = 32;
const H = 32;
const at = (mask: Uint8Array, x: number, y: number): number => mask[y * W + x] ?? -1;

describe('stampBrush', () => {
  it('an add dab fills the centre, fades at the rim, leaves outside alone', () => {
    const mask = new Uint8Array(W * H); // all removed
    const rect = stampBrush(mask, W, H, 16, 16, 8, 'add');
    expect(rect).toEqual({ x: 8, y: 8, width: 17, height: 17 });
    expect(at(mask, 16, 16)).toBe(255); // centre fully kept
    expect(at(mask, 16, 10)).toBe(255); // well inside
    expect(at(mask, 16, 2)).toBe(0); // outside untouched
    // The rim fades: a pixel just inside the radius is partial.
    const rim = at(mask, 16, 16 - 7);
    expect(rim).toBeGreaterThan(0);
    expect(rim).toBeLessThanOrEqual(255);
  });

  it('an erase dab removes from a kept mask', () => {
    const mask = new Uint8Array(W * H).fill(255);
    stampBrush(mask, W, H, 10, 10, 5, 'erase');
    expect(at(mask, 10, 10)).toBe(0);
    expect(at(mask, 25, 25)).toBe(255);
  });

  it('clamps at the mask border without touching other rows', () => {
    const mask = new Uint8Array(W * H);
    const rect = stampBrush(mask, W, H, 0, 0, 6, 'add');
    expect(rect?.x).toBe(0);
    expect(rect?.y).toBe(0);
    expect(at(mask, 0, 0)).toBe(255);
    expect(at(mask, 31, 31)).toBe(0);
  });

  it('a dab entirely off the mask does nothing', () => {
    const mask = new Uint8Array(W * H);
    expect(stampBrush(mask, W, H, -50, -50, 4, 'add')).toBeUndefined();
    expect(mask.every((v) => v === 0)).toBe(true);
  });
});

describe('featherMask', () => {
  it('softens a hard vertical edge symmetrically around the midpoint', () => {
    const mask = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 16; x < W; x++) mask[y * W + x] = 255; // right half kept
    }
    featherMask(mask, W, H, 3);
    const row = 16;
    // Far from the edge: unchanged.
    expect(at(mask, 2, row)).toBe(0);
    expect(at(mask, 29, row)).toBe(255);
    // At the edge: a gradient, roughly half at the boundary pixels.
    expect(at(mask, 15, row)).toBeGreaterThan(60);
    expect(at(mask, 15, row)).toBeLessThan(195);
    expect(at(mask, 16, row)).toBeGreaterThan(60);
    // Monotonic across the edge.
    for (let x = 10; x < 21; x++) {
      expect(at(mask, x + 1, row)).toBeGreaterThanOrEqual(at(mask, x, row));
    }
  });

  it('radius 0 changes nothing', () => {
    const mask = new Uint8Array(W * H).fill(37);
    const copy = new Uint8Array(mask);
    featherMask(mask, W, H, 0);
    expect(Buffer.from(mask).equals(Buffer.from(copy))).toBe(true);
  });
});

describe('patches (the local undo)', () => {
  it('extract before, change, apply — bytes restored exactly', () => {
    const mask = new Uint8Array(W * H);
    for (let i = 0; i < mask.length; i++) mask[i] = i % 251;
    const original = new Uint8Array(mask);

    const rect = { x: 5, y: 7, width: 11, height: 9 };
    const patch = extractPatch(mask, W, rect);
    stampBrush(mask, W, H, 10, 11, 4, 'add');
    expect(Buffer.from(mask).equals(Buffer.from(original))).toBe(false);

    applyPatch(mask, W, patch);
    expect(Buffer.from(mask).equals(Buffer.from(original))).toBe(true);
  });
});
