// Time <-> pixel arithmetic for the timeline panel (Phase 6 decision e).
// Pure functions of the zoom (pixels per second) and the horizontal scroll
// (seconds hidden off the left edge); the React component only draws what
// these compute, so the mapping is tested as arithmetic under plain Node.

/** The closest the timeline zooms in: 200 px per second (decision e). */
export const MAX_ZOOM_PX_PER_SECOND = 200;

/**
 * The zoom at which the whole scene exactly fits the panel — the zoom
 * slider's minimum. Falls back to 1 px/s when the panel has no width yet
 * (first layout) so nothing divides by zero.
 */
export function fitZoom(panelWidthPx: number, durationSeconds: number): number {
  if (!(panelWidthPx > 0) || !(durationSeconds > 0)) return 1;
  return panelWidthPx / durationSeconds;
}

/** A zoom kept between "whole scene fits" and the 200 px/s maximum. */
export function clampZoom(
  pxPerSecond: number,
  panelWidthPx: number,
  durationSeconds: number
): number {
  const min = Math.min(fitZoom(panelWidthPx, durationSeconds), MAX_ZOOM_PX_PER_SECOND);
  return Math.min(Math.max(pxPerSecond, min), MAX_ZOOM_PX_PER_SECOND);
}

/** Where a time lands on the panel, in pixels from its left edge. */
export function timeToPixel(
  seconds: number,
  pxPerSecond: number,
  scrollSeconds: number
): number {
  return (seconds - scrollSeconds) * pxPerSecond;
}

/** The time under a panel pixel — the exact inverse of timeToPixel. */
export function pixelToTime(px: number, pxPerSecond: number, scrollSeconds: number): number {
  return px / pxPerSecond + scrollSeconds;
}

/**
 * A scroll offset kept inside the scene: never negative, and never past
 * the point where the scene's end reaches the panel's right edge. When
 * the whole scene fits, the only valid scroll is 0.
 */
export function clampScroll(
  scrollSeconds: number,
  pxPerSecond: number,
  panelWidthPx: number,
  durationSeconds: number
): number {
  const visibleSeconds = panelWidthPx / pxPerSecond;
  const max = Math.max(0, durationSeconds - visibleSeconds);
  return Math.min(Math.max(scrollSeconds, 0), max);
}

/**
 * The scroll that keeps the playhead in view during play (decision e):
 * unchanged while the playhead is visible; once it would leave the right
 * edge, the view jumps so the playhead re-enters at the left quarter —
 * the familiar "page along" behaviour rather than a constant creep.
 */
export function scrollToFollowPlayhead(
  scrollSeconds: number,
  playheadSeconds: number,
  pxPerSecond: number,
  panelWidthPx: number,
  durationSeconds: number
): number {
  const visibleSeconds = panelWidthPx / pxPerSecond;
  const clamp = (s: number): number =>
    clampScroll(s, pxPerSecond, panelWidthPx, durationSeconds);
  if (playheadSeconds < scrollSeconds || playheadSeconds > scrollSeconds + visibleSeconds) {
    return clamp(playheadSeconds - visibleSeconds / 4);
  }
  return clamp(scrollSeconds);
}

/**
 * The spacing of ruler labels for a zoom level: the smallest "nice" step
 * (a tenth, a fifth, half a second, seconds, then 5/10/15/30/60) that
 * keeps labels at least minLabelPx apart; beyond a minute, whole minutes.
 */
export function rulerStepSeconds(pxPerSecond: number, minLabelPx: number): number {
  const ladder = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60];
  for (const step of ladder) {
    if (step * pxPerSecond >= minLabelPx) return step;
  }
  const minutes = Math.ceil(minLabelPx / (60 * pxPerSecond));
  return minutes * 60;
}
