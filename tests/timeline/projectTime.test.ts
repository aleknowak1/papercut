// The project-wide timing model as arithmetic (Phase 7, ADR-015): the
// shared transition-length clamp, each scene's global start under the
// overlap model, the total, both global ↔ local mappings, and which
// scene(s) show with what transition progress.

import { describe, expect, it } from 'vitest';
import { secondsOf } from '../../app/shared/animation/time';
import { clampTransitionLength } from '../../app/shared/timeline/projectTime';

describe('clampTransitionLength (clamp first, then snap DOWN to a frame)', () => {
  it('holds a legal frame-aligned value exactly', () => {
    expect(clampTransitionLength(0.5, 10, 4, 30)).toBe(0.5);
    expect(clampTransitionLength(1, 10, 4, 30)).toBe(1);
  });

  it('clamps to 0.1 and 3 seconds', () => {
    expect(clampTransitionLength(0.001, 10, 4, 30)).toBe(0.1);
    expect(clampTransitionLength(99, 10, 10, 30)).toBe(3); // half-shorter (5) allows the cap

    // 0.1 s is exactly 3 frames at 30 fps; the floor must not lose one
    // to floating-point dust.
    expect(clampTransitionLength(0.1, 10, 4, 30)).toBe(0.1);
  });

  it('clamps to half the SHORTER neighbouring scene', () => {
    expect(clampTransitionLength(3, 10, 4, 30)).toBe(2); // min(10, 4) / 2
    expect(clampTransitionLength(3, 4, 10, 30)).toBe(2); // either side may be shorter
  });

  it('snaps DOWN to a whole frame, never up past a clamp', () => {
    // Half of 4.9 s is 2.45 s = 73.5 frames: down to 73, never 74.
    expect(clampTransitionLength(3, 10, 4.9, 30)).toBe(secondsOf(73, 30));
    // Half of 0.9 s is 0.45 s = 13.5 frames: down to 13.
    expect(clampTransitionLength(0.5, 10, 0.9, 30)).toBe(secondsOf(13, 30));
  });

  it('without a next scene only 0.1–3 s applies (the last scene keeps its value)', () => {
    expect(clampTransitionLength(99, 10, undefined, 30)).toBe(3);
    expect(clampTransitionLength(1.5, 10, undefined, 30)).toBe(1.5);
  });

  it('an overlap shorter than one frame vanishes to zero', () => {
    // A hand-edited 0.05 s neighbour allows only 0.025 s — under one
    // frame at 30 fps, so the effective length is 0 (no overlap).
    expect(clampTransitionLength(0.5, 10, 0.05, 30)).toBe(0);
  });
});
