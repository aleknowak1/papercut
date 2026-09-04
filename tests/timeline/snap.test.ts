// The timeline snap function (Phase 6 decision d, ADR-015): whole frames
// always; with the extras on, the playhead, the track's other keyframes,
// clip edges and whole seconds catch a drag within six screen pixels —
// and the result names what it snapped to.

import { describe, expect, it } from 'vitest';
import { snapDraggedTime, SNAP_TOLERANCE_PX } from '../../app/shared/timeline/snap';

const FPS = 30;

describe('snapDraggedTime', () => {
  it('lands on the nearest whole frame when the extras are off', () => {
    const result = snapDraggedTime(1.234, FPS, 100, false, { playhead: 1.24 });
    expect(result).toEqual({ time: 37 / 30, snappedTo: 'frame' });
  });

  it('catches the playhead within six screen pixels, and names it', () => {
    // At 100 px/s the tolerance is 0.06 s: 2.05 is 0.05 s from a playhead at 2.
    const caught = snapDraggedTime(2.05, FPS, 100, true, { playhead: 2 });
    expect(caught).toEqual({ time: 2, snappedTo: 'playhead' });
    // At 200 px/s the same distance is 10 px away — out of reach: frame snap.
    const missed = snapDraggedTime(2.05, FPS, 200, true, { playhead: 2 });
    expect(missed).toEqual({ time: snapDraggedTime(2.05, FPS, 200, false).time, snappedTo: 'frame' });
  });

  it('the tolerance is exactly SNAP_TOLERANCE_PX on screen', () => {
    const justInside = 2 + (SNAP_TOLERANCE_PX - 0.01) / 100;
    expect(snapDraggedTime(justInside, FPS, 100, true, { playhead: 2 }).snappedTo).toBe('playhead');
    const atTheEdge = 2 + SNAP_TOLERANCE_PX / 100;
    expect(snapDraggedTime(atTheEdge, FPS, 100, true, { playhead: 2 }).snappedTo).not.toBe('playhead');
  });

  it('keyframes of the same track and clip edges are magnets too', () => {
    const keyframe = snapDraggedTime(3.02, FPS, 100, true, { keyframeTimes: [3, 8] });
    expect(keyframe).toEqual({ time: 3, snappedTo: 'keyframe' });
    const edge = snapDraggedTime(4.457, FPS, 100, true, { clipEdges: [4.5] });
    expect(edge).toEqual({ time: 4.5, snappedTo: 'clip-edge' });
  });

  it('whole seconds pull even with nothing else nearby', () => {
    expect(snapDraggedTime(4.96, FPS, 100, true, {})).toEqual({ time: 5, snappedTo: 'second' });
    // But 4.8 s is 20 px from the second at 100 px/s: plain frame snap.
    expect(snapDraggedTime(4.8, FPS, 100, true, {})).toEqual({ time: 4.8, snappedTo: 'frame' });
  });

  it('the nearest magnet wins; on a tie the playhead outranks the rest', () => {
    // Exact binary fractions so the distances compare exactly. At 20 px/s
    // the tolerance is 0.3 s.
    const nearest = snapDraggedTime(2.5, FPS, 20, true, {
      playhead: 2.25, // 0.25 s away
      keyframeTimes: [2.4375] // 0.0625 s away — nearer, so it wins
    });
    expect(nearest).toEqual({ time: 2.4375, snappedTo: 'keyframe' });
    const tie = snapDraggedTime(2.5, FPS, 20, true, {
      playhead: 2.25, // both exactly 0.25 s away — the playhead outranks
      keyframeTimes: [2.75]
    });
    expect(tie).toEqual({ time: 2.25, snappedTo: 'playhead' });
  });
});
