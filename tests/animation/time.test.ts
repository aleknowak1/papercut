// Frame/second conversion (Phase 5 decision b): exact both ways, so "a
// keyframe at exactly the playhead" is plain === equality, never a
// rounding question.

import { describe, expect, it } from 'vitest';
import { formatTime, frameOf, secondsOf, snapToFrame } from '../../app/shared/animation/time';

describe('frame time', () => {
  it('is exact both ways for every frame of a two-minute scene at 30 and 60 fps', () => {
    for (const fps of [30, 60]) {
      for (let frame = 0; frame <= 120 * fps; frame++) {
        const seconds = secondsOf(frame, fps);
        expect(frameOf(seconds, fps)).toBe(frame);
        // A frame time is already snapped: snapping is the identity on it.
        expect(snapToFrame(seconds, fps)).toBe(seconds);
      }
    }
  });

  it('snaps an arbitrary time to the nearest whole frame', () => {
    // 0.3333 s at 30 fps is 9.999 frames — frame 10, which is 1/3 s exactly.
    expect(snapToFrame(0.3333, 30)).toBe(secondsOf(10, 30));
    expect(snapToFrame(0.3333, 30)).not.toBe(0.3333);
    // Rounds to nearest: 0.48 frames down, 0.51 frames up.
    expect(frameOf(0.016, 30)).toBe(0);
    expect(frameOf(0.017, 30)).toBe(1);
  });

  it('formats readout times as minutes:seconds.milliseconds', () => {
    expect(formatTime(0)).toBe('0:00.000');
    expect(formatTime(1.5)).toBe('0:01.500');
    expect(formatTime(secondsOf(45, 30))).toBe('0:01.500');
    expect(formatTime(61.25)).toBe('1:01.250');
  });

  it('two times meaning the same frame are the same number', () => {
    const a = snapToFrame(1.4999, 30);
    const b = snapToFrame(1.5001, 30);
    expect(a).toBe(b);
    expect(a).toBe(secondsOf(45, 30));
  });
});
