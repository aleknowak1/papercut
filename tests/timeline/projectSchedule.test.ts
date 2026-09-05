// projectSchedule as arithmetic (Phase 7 decision i, ADR-015): every
// scene's previewSchedule shifted by its global start under the overlap
// model — the one translation the export mixer and the Web Audio preview
// both consume. Known global times, an overlap where both scenes sound,
// and each scene's clips still cut at their OWN scene's end.

import { describe, expect, it } from 'vitest';
import type { AudioClip, ProjectDocument, Scene, TransitionType } from '../../app/shared/document/types';
import { projectSchedule } from '../../app/shared/timeline/projectSchedule';

const BEEP = 'asset-beep';
const LONG = 'asset-long';
// The beep is 0.2 s, the long sound 5 s.
const DURATIONS = new Map([
  [BEEP, 0.2],
  [LONG, 5]
]);

function clip(id: string, assetId: string, startSeconds: number): AudioClip {
  return {
    id,
    source: { kind: 'asset', assetId },
    startSeconds,
    volume: 1,
    fadeInSeconds: 0,
    fadeOutSeconds: 0
  };
}

function scene(
  id: string,
  durationSeconds: number,
  audioClips: AudioClip[],
  transitionOut?: TransitionType,
  transitionOutSeconds?: number
): Scene {
  return {
    id,
    name: id,
    durationSeconds,
    cameraKeyframes: [],
    layers: [],
    audioClips,
    ...(transitionOut !== undefined ? { transitionOut } : {}),
    ...(transitionOutSeconds !== undefined ? { transitionOutSeconds } : {})
  };
}

function doc(scenes: Scene[]): ProjectDocument {
  return {
    schemaVersion: 1,
    name: 'Schedule',
    format: '16:9',
    fps: 30,
    assets: [],
    characters: [],
    scenes
  };
}

// Scene A (10 s, 0.5 s crossfade out): a beep at 2.5 and a LONG sound at
// 8 that its own scene end cuts at 10. Scene B (4 s, starts globally at
// 9.5): a beep at local 0.2 — inside the overlap — and one at local 1.5.
const PROJECT = doc([
  scene('A', 10, [clip('a-beep', BEEP, 2.5), clip('a-long', LONG, 8)], 'crossfade', 0.5),
  scene('B', 4, [clip('b-overlap', BEEP, 0.2), clip('b-later', BEEP, 1.5)])
]);

function entry(schedule: ReturnType<typeof projectSchedule>, clipId: string) {
  const found = schedule.find((e) => e.clipId === clipId);
  expect(found).toBeDefined();
  return found!;
}

describe('projectSchedule', () => {
  it('from 0: every clip appears at its global time, scene by scene', () => {
    const schedule = projectSchedule(PROJECT, 0, DURATIONS);
    expect(schedule.map((e) => e.clipId)).toEqual(['a-beep', 'a-long', 'b-overlap', 'b-later']);
    expect(entry(schedule, 'a-beep').delaySeconds).toBe(2.5);
    expect(entry(schedule, 'a-long').delaySeconds).toBe(8);
    expect(entry(schedule, 'b-overlap').delaySeconds).toBe(9.7); // 9.5 + 0.2
    expect(entry(schedule, 'b-later').delaySeconds).toBe(11); // 9.5 + 1.5
  });

  it("a clip is still cut at its OWN scene's end, not the video's", () => {
    const schedule = projectSchedule(PROJECT, 0, DURATIONS);
    // The 5 s sound starting at local 8 in a 10 s scene plays 2 s — the
    // overlap does not extend it and no fade is added (decision j).
    const long = entry(schedule, 'a-long');
    expect(long.playSeconds).toBe(2);
    expect(long.gainPoints.every((p) => p.gain === 1)).toBe(true);
  });

  it('during the overlap both scenes sound', () => {
    // Global 9.75 sits inside the 9.5–10 crossfade: scene A's long sound
    // is mid-play and scene B's first beep is still to come.
    const schedule = projectSchedule(PROJECT, 9.75, DURATIONS);
    expect(schedule.map((e) => e.clipId)).toEqual(['a-long', 'b-overlap', 'b-later']);
    const long = entry(schedule, 'a-long');
    expect(long.delaySeconds).toBe(0); // already sounding
    expect(long.sourceOffsetSeconds).toBe(1.75); // 9.75 − 8 into its sound
    expect(long.playSeconds).toBe(0.25); // to its scene's end at 10
    // Scene B's first beep began at global 9.7, so it is 0.05 s in.
    const overlap = entry(schedule, 'b-overlap');
    expect(overlap.delaySeconds).toBe(0);
    expect(overlap.sourceOffsetSeconds).toBeCloseTo(0.05, 10);
    expect(overlap.playSeconds).toBeCloseTo(0.15, 10);
  });

  it('starting inside a later scene skips everything already over', () => {
    const schedule = projectSchedule(PROJECT, 10.5, DURATIONS);
    expect(schedule.map((e) => e.clipId)).toEqual(['b-later']);
    expect(entry(schedule, 'b-later').delaySeconds).toBe(0.5); // 11 − 10.5
  });

  it('with one scene it is exactly previewSchedule', () => {
    const one = doc([scene('only', 10, [clip('c', BEEP, 2.5)])]);
    const schedule = projectSchedule(one, 0, DURATIONS);
    expect(schedule).toHaveLength(1);
    expect(entry(schedule, 'c').delaySeconds).toBe(2.5);
  });
});
