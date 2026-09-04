// The timeline's snap function (Phase 6 decision d): whole frames always;
// while snap extras are on, a dragged time within a small screen-pixel
// tolerance of the playhead, another keyframe of the same track, a clip
// edge, or a whole second lands exactly there instead. The result says
// WHAT it snapped to so the UI can show it.

import { snapToFrame } from '../animation/time';

/** What a time snapped to, for the UI to name. */
export type SnapTarget = 'frame' | 'playhead' | 'keyframe' | 'clip-edge' | 'second';

export interface SnapResult {
  readonly time: number;
  readonly snappedTo: SnapTarget;
}

/** The extra magnets beyond whole frames (decision d), all in seconds. */
export interface SnapCandidates {
  readonly playhead?: number;
  /** Other keyframe times of the SAME track (never the dragged one's own). */
  readonly keyframeTimes?: readonly number[];
  readonly clipEdges?: readonly number[];
}

/** How close (on screen) a magnet must be to catch the drag (decision d). */
export const SNAP_TOLERANCE_PX = 6;

interface Candidate {
  readonly time: number;
  readonly target: SnapTarget;
  /** Lower wins a distance tie: playhead > keyframe > clip edge > second. */
  readonly rank: number;
}

/**
 * Snaps a raw dragged time. With extras off (the Snap toggle), or with no
 * magnet within SNAP_TOLERANCE_PX at this zoom, the time lands on the
 * nearest whole frame. The nearest magnet wins; on an exact distance tie
 * the playhead beats a keyframe beats a clip edge beats a whole second.
 */
export function snapDraggedTime(
  rawSeconds: number,
  fps: number,
  pxPerSecond: number,
  extrasOn: boolean,
  candidates: SnapCandidates = {}
): SnapResult {
  if (extrasOn && pxPerSecond > 0) {
    const toleranceSeconds = SNAP_TOLERANCE_PX / pxPerSecond;
    const magnets: Candidate[] = [];
    if (candidates.playhead !== undefined) {
      magnets.push({ time: candidates.playhead, target: 'playhead', rank: 0 });
    }
    for (const t of candidates.keyframeTimes ?? []) {
      magnets.push({ time: t, target: 'keyframe', rank: 1 });
    }
    for (const t of candidates.clipEdges ?? []) {
      magnets.push({ time: t, target: 'clip-edge', rank: 2 });
    }
    magnets.push({ time: Math.round(rawSeconds), target: 'second', rank: 3 });

    let best: Candidate | undefined;
    let bestDistance = toleranceSeconds;
    for (const magnet of magnets) {
      const distance = Math.abs(magnet.time - rawSeconds);
      if (
        distance < bestDistance ||
        (distance === bestDistance && best !== undefined && magnet.rank < best.rank)
      ) {
        best = magnet;
        bestDistance = distance;
      }
    }
    if (best !== undefined) return { time: best.time, snappedTo: best.target };
  }
  return { time: snapToFrame(rawSeconds, fps), snappedTo: 'frame' };
}
