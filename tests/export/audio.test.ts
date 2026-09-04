// The export pipeline's audio arithmetic (Phase 2 + Phase 6): WAV parsing,
// the beep fixtures, and the mixer that renders previewSchedule entries
// sample-for-sample — trim as the source offset, the envelope as the
// gain. The full export check (npm run check:export) proves the encoded
// .mp4; these tests prove the numbers going into it.
import { describe, expect, it } from 'vitest';
import {
  EXPORT_SAMPLE_RATE,
  gainAtTime,
  mixSchedule,
  type AudioSource
} from '../../app/shared/export/audioMix';
import { previewSchedule, type ScheduledClip } from '../../app/shared/timeline/previewSchedule';
import type { Scene } from '../../app/shared/document/types';
import { parseWav } from '../../app/shared/export/wav';
import { EXPORT_TEST, beepWav, trimmedWavBytes } from '../fixtures/exportTestProject';

const RATE = EXPORT_SAMPLE_RATE;

/** A schedule entry playing one whole sound at constant volume. */
function plainEntry(assetId: string, delaySeconds: number, playSeconds: number): ScheduledClip {
  return {
    clipId: 'clip',
    assetId,
    delaySeconds,
    sourceOffsetSeconds: 0,
    playSeconds,
    gainPoints: [
      { atSeconds: 0, gain: 1 },
      { atSeconds: playSeconds, gain: 1 }
    ]
  };
}

describe('WAV parsing and the beep fixtures', () => {
  it('the generated beep parses back with the right rate, length, and loudness', () => {
    const beep = parseWav(beepWav());
    expect(beep.sampleRate).toBe(RATE);
    expect(beep.samples.length).toBe(Math.round(EXPORT_TEST.beepSeconds * RATE));
    const peak = beep.samples.reduce((max, s) => Math.max(max, Math.abs(s)), 0);
    expect(peak).toBeGreaterThan(0.45);
    expect(peak).toBeLessThanOrEqual(0.5);
    // Loud almost immediately (the fade-in is 3 ms), so onsets are sharp.
    const early = beep.samples.subarray(0, Math.round(0.01 * RATE));
    expect(Math.max(...early.map(Math.abs))).toBeGreaterThan(0.3);
  });

  it('the trimmed-WAV fixture hides its beeps exactly where the trim expects', () => {
    const t = EXPORT_TEST.trimmedWav;
    const audio = parseWav(trimmedWavBytes());
    expect(audio.samples.length).toBe(Math.round(t.sourceSeconds * RATE));
    const level = (from: number, seconds: number): number => {
      const slice = audio.samples.subarray(Math.round(from * RATE), Math.round((from + seconds) * RATE));
      return Math.max(...slice.map(Math.abs));
    };
    expect(level(0, t.trimStart)).toBe(0); // silence before the chosen beep
    expect(level(t.trimStart, t.duration)).toBeGreaterThan(0.4); // the beep the trim selects
    const gapStart = t.trimStart + t.duration;
    expect(level(gapStart, 0.15)).toBe(0); // the gap…
    expect(level(gapStart + 0.15, 0.2)).toBeGreaterThan(0.4); // …then the beep that must be cut
  });

  it('rejects files that are not WAV', () => {
    expect(() => parseWav(new Uint8Array(100))).toThrow(/RIFF/);
  });
});

describe('gainAtTime', () => {
  const points = [
    { atSeconds: 0, gain: 0 },
    { atSeconds: 1, gain: 0.8 },
    { atSeconds: 3, gain: 0.8 },
    { atSeconds: 4, gain: 0 }
  ];

  it('ramps linearly between points and holds beyond the ends', () => {
    expect(gainAtTime(points, -1)).toBe(0);
    expect(gainAtTime(points, 0.5)).toBeCloseTo(0.4, 12);
    expect(gainAtTime(points, 2)).toBeCloseTo(0.8, 12);
    expect(gainAtTime(points, 3.5)).toBeCloseTo(0.4, 12);
    expect(gainAtTime(points, 9)).toBe(0);
    expect(gainAtTime([], 1)).toBe(1); // no envelope means unity gain
  });
});

describe('mixSchedule', () => {
  const ramp = (seconds: number): AudioSource => {
    // Samples carry their own index (scaled tiny) so any offset error shows.
    const samples = new Float32Array(Math.round(seconds * RATE));
    for (let i = 0; i < samples.length; i++) samples[i] = i * 1e-6;
    return { sampleRate: RATE, samples };
  };

  it('places an entry at its exact start sample', () => {
    const beep = parseWav(beepWav());
    const startSeconds = 2.5;
    const mixed = mixSchedule(
      [plainEntry('a', startSeconds, EXPORT_TEST.beepSeconds)],
      new Map([['a', beep]]),
      10
    );
    expect(mixed.length).toBe(10 * RATE);
    const startSample = startSeconds * RATE;
    const before = mixed.subarray(0, startSample);
    expect(Math.max(...before.map(Math.abs))).toBe(0);
    const after = mixed.subarray(startSample, startSample + 480);
    expect(Math.max(...after.map(Math.abs))).toBeGreaterThan(0.3);
  });

  it('trim is sample-for-sample: the source offset picks the exact samples', () => {
    const source = ramp(1);
    const entry: ScheduledClip = {
      clipId: 'clip',
      assetId: 'a',
      delaySeconds: 0.25,
      sourceOffsetSeconds: 0.5,
      playSeconds: 0.125,
      gainPoints: [
        { atSeconds: 0, gain: 1 },
        { atSeconds: 0.125, gain: 1 }
      ]
    };
    const mixed = mixSchedule([entry], new Map([['a', source]]), 1);
    const startSample = 0.25 * RATE;
    const offsetSample = 0.5 * RATE;
    const count = 0.125 * RATE;
    for (const i of [0, 1, count / 2, count - 1]) {
      expect(mixed[startSample + i]).toBe(source.samples[offsetSample + i]);
    }
    expect(mixed[startSample - 1]).toBe(0); // silent right before the entry
    expect(mixed[startSample + count]).toBe(0); // and right after its length
  });

  it('the gain envelope shapes the sound: half-way up a fade is half as loud', () => {
    const constant: AudioSource = {
      sampleRate: RATE,
      samples: new Float32Array(RATE).fill(0.5)
    };
    const entry: ScheduledClip = {
      clipId: 'clip',
      assetId: 'a',
      delaySeconds: 0,
      sourceOffsetSeconds: 0,
      playSeconds: 1,
      gainPoints: [
        { atSeconds: 0, gain: 0 },
        { atSeconds: 0.5, gain: 1 },
        { atSeconds: 1, gain: 1 }
      ]
    };
    const mixed = mixSchedule([entry], new Map([['a', constant]]), 1);
    expect(mixed[0]).toBe(0);
    expect(mixed[Math.round(0.25 * RATE)]).toBeCloseTo(0.25, 6);
    expect(mixed[Math.round(0.75 * RATE)]).toBeCloseTo(0.5, 6);
  });

  it('drops sound past the end of the timeline instead of stretching it', () => {
    const beep = parseWav(beepWav());
    const mixed = mixSchedule([plainEntry('a', 0.9, 0.2)], new Map([['a', beep]]), 1);
    expect(mixed.length).toBe(RATE);
  });

  it('overlapping entries add together and stay in range', () => {
    const beep = parseWav(beepWav());
    const entries = [0, 0, 0, 0].map(() => plainEntry('a', 0, EXPORT_TEST.beepSeconds));
    const mixed = mixSchedule(entries, new Map([['a', beep]]), 1);
    const peak = mixed.reduce((max, s) => Math.max(max, Math.abs(s)), 0);
    expect(peak).toBeGreaterThan(0.9); // four beeps at once clip the peak…
    expect(peak).toBeLessThanOrEqual(1); // …but never past the legal range
  });

  it('refuses a missing sound or a wrong sample rate', () => {
    expect(() => mixSchedule([plainEntry('gone', 0, 1)], new Map(), 1)).toThrow(/missing/);
    const wrongRate: AudioSource = { sampleRate: 24000, samples: new Float32Array(100) };
    expect(() => mixSchedule([plainEntry('a', 0, 1)], new Map([['a', wrongRate]]), 1)).toThrow(
      /sample rate/
    );
  });

  it('previewSchedule and the mixer together render a trimmed clip exactly', () => {
    // The end-to-end pair on the trimmed-WAV fixture, as arithmetic: only
    // the trim-selected beep lands in the mix, at the clip's start.
    const t = EXPORT_TEST.trimmedWav;
    const audio = parseWav(trimmedWavBytes());
    const scene: Scene = {
      id: 's',
      name: 'S',
      durationSeconds: 10,
      cameraKeyframes: [],
      layers: [],
      audioClips: [
        {
          id: 'c',
          source: { kind: 'asset', assetId: 'a' },
          startSeconds: t.clipStart,
          volume: 1,
          fadeInSeconds: 0,
          fadeOutSeconds: 0,
          trimStartSeconds: t.trimStart,
          durationSeconds: t.duration
        }
      ]
    };
    const schedule = previewSchedule(scene, 0, new Map([['a', t.sourceSeconds]]));
    const mixed = mixSchedule(schedule, new Map([['a', audio]]), 10);
    const startSample = Math.round(t.clipStart * RATE);
    const offsetSample = Math.round(t.trimStart * RATE);
    const count = Math.round(t.duration * RATE);
    // Sample-for-sample the beep the trim selected, nothing before or after.
    for (const i of [0, 100, count - 1]) {
      expect(mixed[startSample + i]).toBe(audio.samples[offsetSample + i]);
    }
    const peak = (samples: Float32Array): number =>
      samples.reduce((max, s) => Math.max(max, Math.abs(s)), 0);
    expect(peak(mixed.subarray(startSample + count))).toBe(0); // the second beep never sounds
    expect(peak(mixed.subarray(0, startSample))).toBe(0);
  });
});
