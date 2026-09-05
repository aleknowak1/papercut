// The seven transitions as arithmetic (Phase 7 decision g, ADR-015):
// every type at progress 0, 0.5 and 1 — the exact numbers projectStage
// applies, so the whole look of a transition is pinned here.

import { describe, expect, it } from 'vitest';
import {
  transitionPose,
  ZOOM_TRANSITION_SCALE
} from '../../app/shared/transitions/transition';

const W = 1920;
const H = 1080;
const at = (type: Parameters<typeof transitionPose>[0], p: number) =>
  transitionPose(type, p, W, H);

const REST = { alpha: 1, offsetX: 0, offsetY: 0, scale: 1 };

describe('crossfade (linear)', () => {
  it('fades the incoming scene in over the unchanged outgoing one', () => {
    expect(at('crossfade', 0)).toEqual({ outgoing: REST, incoming: { ...REST, alpha: 0 }, onTop: 'incoming' });
    expect(at('crossfade', 0.5).incoming.alpha).toBe(0.5);
    expect(at('crossfade', 0.5).outgoing).toEqual(REST);
    expect(at('crossfade', 1).incoming.alpha).toBe(1);
  });
});

describe('the four slides (ease-in-out pushes)', () => {
  it('slide-left pushes everything left, the incoming scene following from the right', () => {
    expect(at('slide-left', 0).outgoing.offsetX).toBe(0);
    expect(at('slide-left', 0).incoming.offsetX).toBe(W);
    // ease-in-out(0.5) = 0.5: half-way, exactly one half-frame each.
    expect(at('slide-left', 0.5).outgoing.offsetX).toBe(-W / 2);
    expect(at('slide-left', 0.5).incoming.offsetX).toBe(W / 2);
    expect(at('slide-left', 1).outgoing.offsetX).toBe(-W);
    expect(at('slide-left', 1).incoming.offsetX).toBe(0);
    // The vertical axis never moves, nothing fades or scales.
    expect(at('slide-left', 0.5).outgoing.offsetY).toBe(0);
    expect(at('slide-left', 0.5).incoming.alpha).toBe(1);
    expect(at('slide-left', 0.5).outgoing.scale).toBe(1);
  });

  it('the easing is ease-in-out: a quarter of the time is an eighth of the way', () => {
    expect(at('slide-left', 0.25).outgoing.offsetX).toBe(-0.125 * W);
    expect(at('slide-left', 0.25).incoming.offsetX).toBe((1 - 0.125) * W);
  });

  it('the other three directions mirror it', () => {
    expect(at('slide-right', 0.5).outgoing.offsetX).toBe(W / 2);
    expect(at('slide-right', 0.5).incoming.offsetX).toBe(-W / 2);
    expect(at('slide-up', 0.5).outgoing.offsetY).toBe(-H / 2);
    expect(at('slide-up', 0.5).incoming.offsetY).toBe(H / 2);
    expect(at('slide-down', 0.5).outgoing.offsetY).toBe(H / 2);
    expect(at('slide-down', 0.5).incoming.offsetY).toBe(-H / 2);
    // The incoming scene always lands exactly at rest.
    for (const type of ['slide-right', 'slide-up', 'slide-down'] as const) {
      expect(at(type, 1).incoming).toEqual(REST);
    }
  });
});

describe('the zooms (linear scale and fade, about the frame centre)', () => {
  it('zoom-in grows the outgoing scene to 2.5x and fades it out on top', () => {
    expect(at('zoom-in', 0).outgoing).toEqual(REST);
    expect(at('zoom-in', 0.5).outgoing.scale).toBe(1.75);
    expect(at('zoom-in', 0.5).outgoing.alpha).toBe(0.5);
    expect(at('zoom-in', 1).outgoing.scale).toBe(ZOOM_TRANSITION_SCALE);
    expect(at('zoom-in', 1).outgoing.alpha).toBe(0);
    // The incoming scene sits beneath, untouched.
    expect(at('zoom-in', 0.5).incoming).toEqual(REST);
    expect(at('zoom-in', 0.5).onTop).toBe('outgoing');
  });

  it('zoom-out lands the incoming scene from 2.5x, fading in on top', () => {
    expect(at('zoom-out', 0).incoming.scale).toBe(ZOOM_TRANSITION_SCALE);
    expect(at('zoom-out', 0).incoming.alpha).toBe(0);
    expect(at('zoom-out', 0.5).incoming.scale).toBe(1.75);
    expect(at('zoom-out', 0.5).incoming.alpha).toBe(0.5);
    expect(at('zoom-out', 1).incoming).toEqual(REST);
    expect(at('zoom-out', 0.5).outgoing).toEqual(REST);
    expect(at('zoom-out', 0.5).onTop).toBe('incoming');
  });
});

describe('wipe (hard edge, left to right)', () => {
  it('reveals the incoming scene by a widening left slice', () => {
    expect(at('wipe', 0).wipeRevealPx).toBe(0);
    expect(at('wipe', 0.5).wipeRevealPx).toBe(W / 2);
    expect(at('wipe', 1).wipeRevealPx).toBe(W);
    // Neither scene moves, fades or scales — only the edge travels.
    expect(at('wipe', 0.5).outgoing).toEqual(REST);
    expect(at('wipe', 0.5).incoming).toEqual(REST);
    expect(at('wipe', 0.5).onTop).toBe('incoming');
  });

  it('only the wipe carries a reveal width', () => {
    for (const type of ['crossfade', 'slide-left', 'zoom-in', 'zoom-out'] as const) {
      expect(at(type, 0.5).wipeRevealPx).toBeUndefined();
    }
  });
});

describe('progress is clamped to 0..1', () => {
  it('values outside the range behave as the nearest end', () => {
    expect(at('crossfade', -1)).toEqual(at('crossfade', 0));
    expect(at('slide-left', 2)).toEqual(at('slide-left', 1));
  });
});
