// The ONE place a time becomes a frame number and back. The playhead and
// every keyframe time the app writes pass through snapToFrame, so two
// times that mean "frame 45" are the same number and plain === works —
// "a keyframe at exactly the playhead" is exact equality, never a
// rounding question (Phase 5 decision b).

/** The nearest whole frame to a time in seconds. */
export function frameOf(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

/** The time of a whole frame, in seconds. */
export function secondsOf(frame: number, fps: number): number {
  return frame / fps;
}

/** A time in seconds, snapped to the nearest whole frame. */
export function snapToFrame(seconds: number, fps: number): number {
  return secondsOf(frameOf(seconds, fps), fps);
}
