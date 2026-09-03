// Motion presets (M-4.4): bob, walk, shake, pop as functions returning
// ORDINARY keyframes — nothing new in the document, on purpose: the agent
// (Phase 12, ADR-011) only ever emits ordinary edits, and once applied a
// preset is just keyframes the user can edit one by one. The edit layer
// bakes the whole list in ONE undo step through applyKeyframes.
//
// Rules (Phase 5 decisions d/e): every time is frame-snapped; keyframes
// are added on top of the layer's existing ones (same-time ones are
// replaced by applyKeyframes); values a preset does not drive are taken
// from the layer's own motion at that time — sampled from the layer as it
// is BEFORE the preset. Everything is deterministic, so the checks and
// snapshots are exact.

import type { Keyframe, Layer } from '../document/types';
import { keyframeAtPlayhead } from './keyframes';
import { frameOf, secondsOf, snapToFrame } from './time';

/** One full up-down bob cycle, in seconds (bob and walk share it). */
export const BOB_PERIOD_SECONDS = 0.6;

/** Field defaults the preset UI starts from, in reference pixels/seconds. */
export const PRESET_DEFAULTS = {
  bobAmount: 20,
  shakeAmount: 12,
  walkBobAmount: 15,
  popDurationSeconds: 0.4
} as const;

export interface RangeOptions {
  /** Snapped to whole frames; endTime usually defaults to the scene end. */
  readonly startTime: number;
  readonly endTime: number;
  readonly fps: number;
}

/** The half-period time grid bob and walk place their keyframes on. */
function bobGrid(startFrame: number, endFrame: number, fps: number): number[] {
  const stepFrames = Math.max(1, frameOf(BOB_PERIOD_SECONDS / 2, fps));
  const frames: number[] = [];
  for (let f = startFrame; f < endFrame; f += stepFrames) frames.push(f);
  frames.push(endFrame);
  return frames;
}

/**
 * Bob: the layer floats gently up and down around its own motion —
 * keyframes every half period alternating amount below and above the
 * layer's own y, easing in and out of each turn, settling back exactly on
 * its motion at the end.
 */
export function bobKeyframes(
  layer: Layer,
  options: RangeOptions & { readonly amount: number }
): Keyframe[] {
  const { fps, amount } = options;
  const startFrame = frameOf(options.startTime, fps);
  const endFrame = frameOf(options.endTime, fps);
  if (endFrame <= startFrame) return [];
  const grid = bobGrid(startFrame, endFrame, fps);
  const result: Keyframe[] = [];
  for (let i = 0; i < grid.length; i++) {
    const frame = grid[i]!;
    const time = secondsOf(frame, fps);
    const seed = keyframeAtPlayhead(layer, time);
    if (seed === undefined) return [];
    const isEdge = i === 0 || i === grid.length - 1;
    const offset = isEdge ? 0 : i % 2 === 1 ? -amount : amount;
    result.push(
      i === grid.length - 1
        ? seed // the end keyframe: back on the layer's own motion
        : { ...seed, y: seed.y + offset, easing: 'ease-in-out' }
    );
  }
  return result;
}

/**
 * Shake: rapid side-to-side jitter — the layer's own x nudged alternately
 * right and left every two frames, linear, back on its motion at the end.
 */
export function shakeKeyframes(
  layer: Layer,
  options: RangeOptions & { readonly amount: number }
): Keyframe[] {
  const { fps, amount } = options;
  const startFrame = frameOf(options.startTime, fps);
  const endFrame = frameOf(options.endTime, fps);
  if (endFrame <= startFrame) return [];
  const frames: number[] = [];
  for (let f = startFrame; f < endFrame; f += 2) frames.push(f);
  frames.push(endFrame);
  const result: Keyframe[] = [];
  for (let i = 0; i < frames.length; i++) {
    const time = secondsOf(frames[i]!, fps);
    const seed = keyframeAtPlayhead(layer, time);
    if (seed === undefined) return [];
    const isEdge = i === 0 || i === frames.length - 1;
    const offset = isEdge ? 0 : i % 2 === 1 ? amount : -amount;
    result.push(
      i === frames.length - 1 ? seed : { ...seed, x: seed.x + offset, easing: 'linear' }
    );
  }
  return result;
}

export interface WalkOptions extends RangeOptions {
  /** Where the layer's centre ends up, in reference pixels. */
  readonly destination: { readonly x: number; readonly y: number };
  /** How high each step hops. */
  readonly bobAmount: number;
}

/**
 * Walk: the layer travels in a straight line to the destination with a
 * little hop each half bob period and a facing flip — walking left mirrors
 * how the picture faces now; walking right keeps it. The layer keeps
 * facing its walking direction at the end.
 */
export function walkKeyframes(layer: Layer, options: WalkOptions): Keyframe[] {
  const { fps, destination, bobAmount } = options;
  const startFrame = frameOf(options.startTime, fps);
  const endFrame = frameOf(options.endTime, fps);
  if (endFrame <= startFrame) return [];
  const startSeed = keyframeAtPlayhead(layer, secondsOf(startFrame, fps));
  if (startSeed === undefined) return [];
  const facing = destination.x < startSeed.x ? !startSeed.flipX : startSeed.flipX;
  const grid = bobGrid(startFrame, endFrame, fps);
  const result: Keyframe[] = [];
  for (let i = 0; i < grid.length; i++) {
    const frame = grid[i]!;
    const time = secondsOf(frame, fps);
    const seed = keyframeAtPlayhead(layer, time);
    if (seed === undefined) return [];
    const progress = (frame - startFrame) / (endFrame - startFrame);
    const hop = i === 0 || i === grid.length - 1 ? 0 : i % 2 === 1 ? -bobAmount : 0;
    const along: Keyframe = {
      ...seed,
      x: startSeed.x + (destination.x - startSeed.x) * progress,
      y: startSeed.y + (destination.y - startSeed.y) * progress + hop,
      flipX: facing,
      easing: 'ease-in-out'
    };
    result.push(i === grid.length - 1 ? { ...along, easing: seed.easing } : along);
  }
  return result;
}

export interface PopOptions {
  readonly startTime: number;
  readonly durationSeconds: number;
  readonly fps: number;
}

/**
 * Pop: the layer appears — scale 0 to a 1.15× overshoot back to its own
 * size, fading in, easing out. Three keyframes; at least two frames long.
 */
export function popKeyframes(layer: Layer, options: PopOptions): Keyframe[] {
  const { fps } = options;
  const startFrame = frameOf(options.startTime, fps);
  const endFrame = Math.max(startFrame + 2, frameOf(options.startTime + options.durationSeconds, fps));
  const midFrame = Math.min(
    endFrame - 1,
    Math.max(startFrame + 1, Math.round(startFrame + 0.7 * (endFrame - startFrame)))
  );
  const seedAt = (frame: number): Keyframe | undefined =>
    keyframeAtPlayhead(layer, secondsOf(frame, fps));
  const start = seedAt(startFrame);
  const mid = seedAt(midFrame);
  const end = seedAt(endFrame);
  if (start === undefined || mid === undefined || end === undefined) return [];
  return [
    { ...start, scale: 0, opacity: 0, easing: 'ease-out' },
    { ...mid, scale: mid.scale * 1.15, easing: 'ease-out' },
    end
  ];
}

/** Snaps a preset range into the scene: start at the playhead, end by default at the scene end. */
export function presetRange(
  playhead: number,
  endTime: number,
  fps: number
): { startTime: number; endTime: number } {
  return { startTime: snapToFrame(playhead, fps), endTime: snapToFrame(endTime, fps) };
}
