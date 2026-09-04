// Timeline time <-> pixel mapping (Phase 6 decision e, ADR-015): the zoom
// bounds, the exact round trip, scroll clamping, the follow-the-playhead
// paging, and the ruler label spacing — all as arithmetic.

import { describe, expect, it } from 'vitest';
import {
  MAX_ZOOM_PX_PER_SECOND,
  clampScroll,
  clampZoom,
  fitZoom,
  pixelToTime,
  rulerStepSeconds,
  scrollToFollowPlayhead,
  timeToPixel
} from '../../app/shared/timeline/mapping';

describe('zoom bounds', () => {
  it('fitZoom makes the whole scene exactly fill the panel', () => {
    expect(fitZoom(800, 10)).toBe(80); // 10 s across 800 px
    expect(timeToPixel(10, fitZoom(800, 10), 0)).toBe(800);
  });

  it('fitZoom survives a panel or scene with no size yet', () => {
    expect(fitZoom(0, 10)).toBe(1);
    expect(fitZoom(800, 0)).toBe(1);
  });

  it('clampZoom keeps the zoom between "scene fits" and 200 px/s', () => {
    expect(clampZoom(5, 800, 10)).toBe(80); // below fit: raised to fit
    expect(clampZoom(120, 800, 10)).toBe(120); // inside the range: untouched
    expect(clampZoom(999, 800, 10)).toBe(MAX_ZOOM_PX_PER_SECOND);
    // A very short scene would "fit" above 200 px/s; the maximum still wins.
    expect(clampZoom(999, 800, 1)).toBe(MAX_ZOOM_PX_PER_SECOND);
  });
});

describe('time <-> pixel', () => {
  it('maps and unmaps exactly, scroll included', () => {
    // At 100 px/s scrolled 2 s in, 3.5 s sits 150 px from the left edge.
    expect(timeToPixel(3.5, 100, 2)).toBe(150);
    expect(pixelToTime(150, 100, 2)).toBe(3.5);
    expect(pixelToTime(timeToPixel(7.25, 64, 1.5), 64, 1.5)).toBeCloseTo(7.25, 12);
  });
});

describe('scrolling', () => {
  it('clampScroll never shows past either end of the scene', () => {
    // 10 s scene, 100 px/s, 800 px panel: 8 s visible, so scroll tops out at 2 s.
    expect(clampScroll(-1, 100, 800, 10)).toBe(0);
    expect(clampScroll(1.5, 100, 800, 10)).toBe(1.5);
    expect(clampScroll(5, 100, 800, 10)).toBe(2);
    // Whole scene fits: the only valid scroll is 0.
    expect(clampScroll(3, 50, 800, 10)).toBe(0);
  });

  it('the view follows the playhead by paging, not creeping', () => {
    // 8 s visible; playhead inside the view leaves the scroll alone.
    expect(scrollToFollowPlayhead(0, 5, 100, 800, 20)).toBe(0);
    // Playhead past the right edge: it re-enters at the left quarter (2 s in).
    expect(scrollToFollowPlayhead(0, 9, 100, 800, 20)).toBe(7);
    // Playhead jumped back before the view: same rule.
    expect(scrollToFollowPlayhead(10, 3, 100, 800, 20)).toBe(1);
    // Near the scene end the page still clamps inside the scene.
    expect(scrollToFollowPlayhead(0, 19.5, 100, 800, 20)).toBe(12);
  });
});

describe('ruler labels', () => {
  it('picks the smallest nice step that keeps labels apart', () => {
    expect(rulerStepSeconds(200, 60)).toBe(0.5); // zoomed right in
    expect(rulerStepSeconds(100, 60)).toBe(1);
    expect(rulerStepSeconds(20, 60)).toBe(5);
    expect(rulerStepSeconds(2, 60)).toBe(30);
    expect(rulerStepSeconds(0.5, 60)).toBe(120); // far out: whole minutes
  });
});
