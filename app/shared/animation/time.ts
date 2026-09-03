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

/** A time as the strip shows it: minutes:seconds.milliseconds, e.g. 0:01.500. */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  return `${mins}:${(seconds - mins * 60).toFixed(3).padStart(6, '0')}`;
}
