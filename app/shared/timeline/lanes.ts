// Lane packing for overlapping audio clips (Phase 6 decision g): clips
// that overlap in time are drawn in separate lanes so nothing hides
// behind anything. First-fit over clips sorted by start time (id breaks
// ties), so the same document always packs the same way.

export interface LaneClip {
  readonly id: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
}

export interface LanePacking {
  /** Lane index (0 = the top lane) per clip id. */
  readonly laneOf: ReadonlyMap<string, number>;
  /** How many lanes are needed; at least 1 so an empty track still draws. */
  readonly laneCount: number;
}

/**
 * Packs clips into lanes: each clip takes the first lane where it fits.
 * Two clips overlap when their spans truly cross — clips that only touch
 * (one ends exactly where the next starts) share a lane.
 */
export function packLanes(clips: readonly LaneClip[]): LanePacking {
  const sorted = [...clips].sort(
    (a, b) => a.startSeconds - b.startSeconds || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  const laneEnds: number[] = []; // where each lane's last clip ends
  const laneOf = new Map<string, number>();
  for (const clip of sorted) {
    let lane = laneEnds.findIndex((end) => end <= clip.startSeconds);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(clip.endSeconds);
    } else {
      laneEnds[lane] = clip.endSeconds;
    }
    laneOf.set(clip.id, lane);
  }
  return { laneOf, laneCount: Math.max(1, laneEnds.length) };
}
