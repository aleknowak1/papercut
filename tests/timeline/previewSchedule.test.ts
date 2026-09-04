// previewSchedule (Phase 6, ADR-015): the one translation from "the scene
// plus a start time" to "what sounds, when, how loud". Verified at known
// times with trim, fades, overlap, a mid-clip start, and the scene-end
// cut — the same entries feed the Web Audio preview and the export mixer.

import { describe, expect, it } from 'vitest';
import type { AudioClip, Scene } from '../../app/shared/document/types';
import { previewSchedule } from '../../app/shared/timeline/previewSchedule';

const SOUND = 'sound-1';
const durations = new Map([[SOUND, 4]]); // one 4-second sound

function makeScene(clips: readonly Partial<AudioClip>[], durationSeconds = 10): Scene {
  return {
    id: 'scene-1',
    name: 'Scene',
    durationSeconds,
    cameraKeyframes: [],
    layers: [],
    audioClips: clips.map((overrides, i) => ({
      id: `clip-${i}`,
      source: { kind: 'asset', assetId: SOUND },
      startSeconds: 0,
      volume: 1,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      ...overrides
    }))
  };
}

describe('previewSchedule', () => {
  it('an untrimmed clip plays whole, from its start, at its volume', () => {
    const scene = makeScene([{ startSeconds: 2, volume: 0.5 }]);
    const [entry] = previewSchedule(scene, 0, durations);
    expect(entry).toEqual({
      clipId: 'clip-0',
      assetId: SOUND,
      delaySeconds: 2,
      sourceOffsetSeconds: 0,
      playSeconds: 4,
      gainPoints: [
        { atSeconds: 0, gain: 0.5 },
        { atSeconds: 4, gain: 0.5 }
      ]
    });
  });

  it('trim becomes the source offset and the played length', () => {
    const scene = makeScene([{ startSeconds: 1, trimStartSeconds: 0.5, durationSeconds: 2 }]);
    const [entry] = previewSchedule(scene, 0, durations);
    expect(entry!.delaySeconds).toBe(1);
    expect(entry!.sourceOffsetSeconds).toBe(0.5);
    expect(entry!.playSeconds).toBe(2);
  });

  it('starting mid-clip advances the source offset and drops the delay', () => {
    // Clip at 2 s, trimmed to begin 0.5 s into its sound. From t = 3 the
    // clip has already played 1 s, so the source continues from 1.5 s.
    const scene = makeScene([{ startSeconds: 2, trimStartSeconds: 0.5 }]);
    const [entry] = previewSchedule(scene, 3, durations);
    expect(entry!.delaySeconds).toBe(0);
    expect(entry!.sourceOffsetSeconds).toBe(1.5);
    expect(entry!.playSeconds).toBe(2.5); // 3.5 s of trimmed sound, 1 s gone
  });

  it('the scene end cuts a clip short', () => {
    const scene = makeScene([{ startSeconds: 8 }]); // 4 s sound, scene ends at 10
    const [entry] = previewSchedule(scene, 0, durations);
    expect(entry!.playSeconds).toBe(2);
  });

  it('fades become envelope corners; a start inside a fade begins part-way up', () => {
    const scene = makeScene([
      { startSeconds: 0, volume: 0.8, fadeInSeconds: 1, fadeOutSeconds: 2 }
    ]);
    const [whole] = previewSchedule(scene, 0, durations);
    expect(whole!.gainPoints).toEqual([
      { atSeconds: 0, gain: 0 },
      { atSeconds: 1, gain: 0.8 }, // fade-in done
      { atSeconds: 2, gain: 0.8 }, // fade-out begins (4 s - 2 s)
      { atSeconds: 4, gain: 0 }
    ]);
    // From t = 0.5 the fade-in is half way up: the first point starts there.
    const [mid] = previewSchedule(scene, 0.5, durations);
    expect(mid!.gainPoints).toEqual([
      { atSeconds: 0, gain: 0.4 },
      { atSeconds: 0.5, gain: 0.8 },
      { atSeconds: 1.5, gain: 0.8 },
      { atSeconds: 3.5, gain: 0 }
    ]);
  });

  it('fades from a hand-edited file are held inside the played length', () => {
    // 10 s of claimed fades on 4 s of sound: fade-in clamps to 4 s, the
    // fade-out to the room that remains (none) — never a negative ramp.
    const scene = makeScene([{ fadeInSeconds: 10, fadeOutSeconds: 10 }]);
    const [entry] = previewSchedule(scene, 0, durations);
    expect(entry!.gainPoints).toEqual([
      { atSeconds: 0, gain: 0 },
      { atSeconds: 4, gain: 1 }
    ]);
  });

  it('overlapping clips are all scheduled, in scene order', () => {
    const scene = makeScene([{ startSeconds: 0 }, { startSeconds: 1 }]);
    const entries = previewSchedule(scene, 0, durations);
    expect(entries.map((e) => e.clipId)).toEqual(['clip-0', 'clip-1']);
    expect(entries.map((e) => e.delaySeconds)).toEqual([0, 1]);
  });

  it('skips what cannot sound: finished clips, unstarted TTS, unknown sounds', () => {
    const scene = makeScene([
      { startSeconds: 0 }, // over by t = 5
      { startSeconds: 20 }, // starts after the scene ends
      { source: { kind: 'asset', assetId: 'never-imported' } },
      {
        source: {
          kind: 'tts',
          ttsLine: { characterId: 'c', text: 'hi', delivery: 'flat', voice: 'v' }
        }
      }
    ]);
    expect(previewSchedule(scene, 5, durations)).toEqual([]);
  });
});
