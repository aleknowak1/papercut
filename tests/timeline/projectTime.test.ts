// The project-wide timing model as arithmetic (Phase 7, ADR-015): the
// shared transition-length clamp, each scene's global start under the
// overlap model, the total, both global ↔ local mappings, and which
// scene(s) show with what transition progress.

import { describe, expect, it } from 'vitest';
import { secondsOf } from '../../app/shared/animation/time';
import type { ProjectDocument, Scene, TransitionType } from '../../app/shared/document/types';
import {
  clampTransitionLength,
  effectiveTransitionSeconds,
  localToGlobal,
  projectDurationSeconds,
  sceneStartSeconds,
  scenesAtGlobalTime
} from '../../app/shared/timeline/projectTime';

/** A bare scene for timing tests: nothing in it but a length and a transition. */
function scene(
  id: string,
  durationSeconds: number,
  transitionOut?: TransitionType,
  transitionOutSeconds?: number
): Scene {
  return {
    id,
    name: id,
    durationSeconds,
    cameraKeyframes: [],
    layers: [],
    audioClips: [],
    ...(transitionOut !== undefined ? { transitionOut } : {}),
    ...(transitionOutSeconds !== undefined ? { transitionOutSeconds } : {})
  };
}

function doc(scenes: Scene[]): ProjectDocument {
  return {
    schemaVersion: 1,
    name: 'Timing',
    format: '16:9',
    fps: 30,
    assets: [],
    characters: [],
    scenes
  };
}

// The plan's worked example: A = 10 s with a 0.5 s crossfade out,
// B = 4 s with a 1 s slide out, C = 6 s.
const WORKED = doc([
  scene('A', 10, 'crossfade', 0.5),
  scene('B', 4, 'slide-left', 1),
  scene('C', 6)
]);

describe('clampTransitionLength (clamp first, then snap DOWN to a frame)', () => {
  it('holds a legal frame-aligned value exactly', () => {
    expect(clampTransitionLength(0.5, 10, 4, 30)).toBe(0.5);
    expect(clampTransitionLength(1, 10, 4, 30)).toBe(1);
  });

  it('clamps to 0.1 and 3 seconds', () => {
    expect(clampTransitionLength(0.001, 10, 4, 30)).toBe(0.1);
    expect(clampTransitionLength(99, 10, 10, 30)).toBe(3); // half-shorter (5) allows the cap

    // 0.1 s is exactly 3 frames at 30 fps; the floor must not lose one
    // to floating-point dust.
    expect(clampTransitionLength(0.1, 10, 4, 30)).toBe(0.1);
  });

  it('clamps to half the SHORTER neighbouring scene', () => {
    expect(clampTransitionLength(3, 10, 4, 30)).toBe(2); // min(10, 4) / 2
    expect(clampTransitionLength(3, 4, 10, 30)).toBe(2); // either side may be shorter
  });

  it('snaps DOWN to a whole frame, never up past a clamp', () => {
    // Half of 4.9 s is 2.45 s = 73.5 frames: down to 73, never 74.
    expect(clampTransitionLength(3, 10, 4.9, 30)).toBe(secondsOf(73, 30));
    // Half of 0.9 s is 0.45 s = 13.5 frames: down to 13.
    expect(clampTransitionLength(0.5, 10, 0.9, 30)).toBe(secondsOf(13, 30));
  });

  it('without a next scene only 0.1–3 s applies (the last scene keeps its value)', () => {
    expect(clampTransitionLength(99, 10, undefined, 30)).toBe(3);
    expect(clampTransitionLength(1.5, 10, undefined, 30)).toBe(1.5);
  });

  it('an overlap shorter than one frame vanishes to zero', () => {
    // A hand-edited 0.05 s neighbour allows only 0.025 s — under one
    // frame at 30 fps, so the effective length is 0 (no overlap).
    expect(clampTransitionLength(0.5, 10, 0.05, 30)).toBe(0);
  });
});

describe('effectiveTransitionSeconds', () => {
  it('is zero for the last scene, a cut, and an absent transition', () => {
    expect(effectiveTransitionSeconds(WORKED, 2)).toBe(0); // last scene
    expect(effectiveTransitionSeconds(doc([scene('A', 5, 'cut', 1), scene('B', 5)]), 0)).toBe(0);
    expect(effectiveTransitionSeconds(doc([scene('A', 5), scene('B', 5)]), 0)).toBe(0);
  });

  it('an absent length means the default 0.5 s', () => {
    expect(
      effectiveTransitionSeconds(doc([scene('A', 5, 'crossfade'), scene('B', 5)]), 0)
    ).toBe(0.5);
  });

  it('clamps a stored length again, so a shortened neighbour can never break the arithmetic', () => {
    // 2 s was legal when the neighbour was long; at 3 s it allows 1.5.
    expect(
      effectiveTransitionSeconds(doc([scene('A', 10, 'wipe', 2), scene('B', 3)]), 0)
    ).toBe(1.5);
    // And the floor still lands on a whole frame: half of 4.9 is 73.5 frames.
    expect(
      effectiveTransitionSeconds(doc([scene('A', 10, 'wipe', 3), scene('B', 4.9)]), 0)
    ).toBe(secondsOf(73, 30));
  });
});

describe('the worked example: starts, total, both mappings', () => {
  it('each scene begins t seconds before the previous one ends', () => {
    expect(sceneStartSeconds(WORKED)).toEqual([0, 9.5, 12.5]);
  });

  it('the total is the durations minus the transitions', () => {
    expect(projectDurationSeconds(WORKED)).toBe(18.5); // 10 + 4 + 6 − 0.5 − 1
    expect(projectDurationSeconds(doc([scene('only', 7)]))).toBe(7);
    expect(projectDurationSeconds(doc([]))).toBe(0);
  });

  it('local time maps to global by the scene start', () => {
    expect(localToGlobal(WORKED, 0, 5)).toBe(5);
    expect(localToGlobal(WORKED, 1, 1.5)).toBe(11);
    expect(localToGlobal(WORKED, 2, 0)).toBe(12.5);
  });
});

describe('scenesAtGlobalTime', () => {
  it('one scene outside any overlap', () => {
    const at = scenesAtGlobalTime(WORKED, 5)!;
    expect(at.scene.id).toBe('A');
    expect(at.localSeconds).toBe(5);
    expect(at.incoming).toBeUndefined();
  });

  it('two scenes during an overlap, with progress 0..1', () => {
    const begin = scenesAtGlobalTime(WORKED, 9.5)!;
    expect(begin.scene.id).toBe('A');
    expect(begin.incoming?.scene.id).toBe('B');
    expect(begin.incoming?.localSeconds).toBe(0);
    expect(begin.incoming?.progress).toBe(0);

    const mid = scenesAtGlobalTime(WORKED, 9.8)!;
    expect(mid.scene.id).toBe('A');
    expect(mid.localSeconds).toBeCloseTo(9.8, 10);
    expect(mid.incoming?.localSeconds).toBeCloseTo(0.3, 10);
    expect(mid.incoming?.progress).toBeCloseTo(0.6, 10);
  });

  it('the moment the outgoing scene ends, only the incoming one shows', () => {
    const at = scenesAtGlobalTime(WORKED, 10)!;
    expect(at.scene.id).toBe('B');
    expect(at.localSeconds).toBe(0.5);
    expect(at.incoming).toBeUndefined();
  });

  it('the second transition of the example', () => {
    const mid = scenesAtGlobalTime(WORKED, 13)!;
    expect(mid.scene.id).toBe('B');
    expect(mid.incoming?.scene.id).toBe('C');
    expect(mid.incoming?.progress).toBe(0.5);
  });

  it('a cut boundary belongs to the incoming scene', () => {
    const cutDoc = doc([scene('A', 2, 'cut'), scene('B', 2)]);
    const at = scenesAtGlobalTime(cutDoc, 2)!;
    expect(at.scene.id).toBe('B');
    expect(at.localSeconds).toBe(0);
    expect(at.incoming).toBeUndefined();
  });

  it('before 0 and past the end, the nearest end clamps', () => {
    expect(scenesAtGlobalTime(WORKED, -1)!.localSeconds).toBe(0);
    const past = scenesAtGlobalTime(WORKED, 99)!;
    expect(past.scene.id).toBe('C');
    expect(past.localSeconds).toBe(6);
    expect(scenesAtGlobalTime(doc([]), 0)).toBeUndefined();
  });

  it('overlaps can touch but never chain: at most two scenes ever show', () => {
    // The middle scene's transition-in and -out windows both take their
    // maximum (half its 4 s), so they touch at its midpoint.
    const tight = doc([scene('A', 10, 'crossfade', 2), scene('B', 4, 'crossfade', 2), scene('C', 10)]);
    expect(sceneStartSeconds(tight)).toEqual([0, 8, 10]);
    const justBefore = scenesAtGlobalTime(tight, 9.99)!;
    expect(justBefore.scene.id).toBe('A');
    expect(justBefore.incoming?.scene.id).toBe('B');
    const justAfter = scenesAtGlobalTime(tight, 10)!;
    expect(justAfter.scene.id).toBe('B');
    expect(justAfter.incoming?.scene.id).toBe('C');
  });
});
