// Lane packing (Phase 6 decision g, ADR-015): overlapping clips take
// separate lanes, touching clips share one, and the packing is
// deterministic — the same clips always land in the same lanes.

import { describe, expect, it } from 'vitest';
import { packLanes, type LaneClip } from '../../app/shared/timeline/lanes';

const clip = (id: string, startSeconds: number, endSeconds: number): LaneClip => ({
  id,
  startSeconds,
  endSeconds
});

describe('packLanes', () => {
  it('clips that do not overlap share the first lane', () => {
    const packed = packLanes([clip('a', 0, 2), clip('b', 3, 5), clip('c', 6, 7)]);
    expect(packed.laneCount).toBe(1);
    expect([...packed.laneOf.values()]).toEqual([0, 0, 0]);
  });

  it('overlapping clips go to separate lanes; a later gap reuses lane 0', () => {
    const packed = packLanes([clip('a', 0, 4), clip('b', 2, 6), clip('c', 5, 8)]);
    expect(packed.laneOf.get('a')).toBe(0);
    expect(packed.laneOf.get('b')).toBe(1); // overlaps a
    expect(packed.laneOf.get('c')).toBe(0); // a has ended: back to the top lane
    expect(packed.laneCount).toBe(2);
  });

  it('clips that only touch (one ends where the next starts) share a lane', () => {
    const packed = packLanes([clip('a', 0, 2), clip('b', 2, 4)]);
    expect(packed.laneCount).toBe(1);
  });

  it('three clips sounding at once need three lanes', () => {
    const packed = packLanes([clip('a', 0, 10), clip('b', 1, 9), clip('c', 2, 8)]);
    expect([packed.laneOf.get('a'), packed.laneOf.get('b'), packed.laneOf.get('c')]).toEqual([
      0, 1, 2
    ]);
    expect(packed.laneCount).toBe(3);
  });

  it('packing ignores the order the clips are given in', () => {
    const clips = [clip('a', 0, 4), clip('b', 2, 6), clip('c', 5, 8)];
    const shuffled = [clips[2]!, clips[0]!, clips[1]!];
    expect(packLanes(shuffled)).toEqual(packLanes(clips));
  });

  it('an empty track still has one lane to draw', () => {
    expect(packLanes([]).laneCount).toBe(1);
  });
});
