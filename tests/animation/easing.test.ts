// The four easing curves hit known values (ADR-015): endpoints are exact,
// midpoints match the quadratic curves, and out-of-range progress clamps.

import { describe, expect, it } from 'vitest';
import { ease } from '../../app/shared/animation/easing';
import type { EasingType } from '../../app/shared/document/types';

const ALL: EasingType[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];

describe('easing curves', () => {
  it('every curve starts at 0 and ends at 1 exactly', () => {
    for (const type of ALL) {
      expect(ease(type, 0)).toBe(0);
      expect(ease(type, 1)).toBe(1);
    }
  });

  it('hits known values', () => {
    expect(ease('linear', 0.25)).toBe(0.25);
    expect(ease('ease-in', 0.5)).toBe(0.25);
    expect(ease('ease-out', 0.5)).toBe(0.75);
    expect(ease('ease-in-out', 0.25)).toBe(0.125);
    expect(ease('ease-in-out', 0.5)).toBe(0.5);
    expect(ease('ease-in-out', 0.75)).toBe(0.875);
  });

  it('clamps progress outside 0..1', () => {
    for (const type of ALL) {
      expect(ease(type, -0.5)).toBe(0);
      expect(ease(type, 1.5)).toBe(1);
    }
  });

  it('ease-in starts slower than linear, ease-out faster', () => {
    expect(ease('ease-in', 0.25)).toBeLessThan(0.25);
    expect(ease('ease-out', 0.25)).toBeGreaterThan(0.25);
  });
});
