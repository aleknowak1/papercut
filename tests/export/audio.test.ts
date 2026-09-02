// The export pipeline's audio arithmetic (Phase 2, OQ-019): WAV parsing,
// the beep fixture, and sample-exact clip mixing. The full export check
// (npm run check:export) proves the encoded .mp4; these tests prove the
// numbers going into it.
import { describe, expect, it } from 'vitest';
import { EXPORT_SAMPLE_RATE, mixClips } from '../../app/shared/export/audioMix';
import { parseWav } from '../../app/shared/export/wav';
import { EXPORT_TEST, beepWav } from '../fixtures/exportTestProject';

describe('WAV parsing and the beep fixture', () => {
  it('the generated beep parses back with the right rate, length, and loudness', () => {
    const beep = parseWav(beepWav());
    expect(beep.sampleRate).toBe(EXPORT_SAMPLE_RATE);
    expect(beep.samples.length).toBe(Math.round(EXPORT_TEST.beepSeconds * EXPORT_SAMPLE_RATE));
    const peak = beep.samples.reduce((max, s) => Math.max(max, Math.abs(s)), 0);
    expect(peak).toBeGreaterThan(0.45);
    expect(peak).toBeLessThanOrEqual(0.5);
    // Loud almost immediately (the fade-in is 3 ms), so onsets are sharp.
    const early = beep.samples.subarray(0, Math.round(0.01 * EXPORT_SAMPLE_RATE));
    expect(Math.max(...early.map(Math.abs))).toBeGreaterThan(0.3);
  });

  it('rejects files that are not WAV', () => {
    expect(() => parseWav(new Uint8Array(100))).toThrow(/RIFF/);
  });
});

describe('mixing clips', () => {
  const tone = (): ReturnType<typeof parseWav> => parseWav(beepWav());

  it('places a clip at its exact start sample', () => {
    const startSeconds = 2.5;
    const mixed = mixClips(
      [{ audio: tone(), startSeconds, volume: 1, fadeInSeconds: 0, fadeOutSeconds: 0 }],
      10
    );
    expect(mixed.length).toBe(10 * EXPORT_SAMPLE_RATE);
    const startSample = startSeconds * EXPORT_SAMPLE_RATE;
    // Silent right up to the start, sound present right after it.
    const before = mixed.subarray(0, startSample);
    expect(Math.max(...before.map(Math.abs))).toBe(0);
    const after = mixed.subarray(startSample, startSample + 480);
    expect(Math.max(...after.map(Math.abs))).toBeGreaterThan(0.3);
  });

  it('applies volume', () => {
    const loud = mixClips(
      [{ audio: tone(), startSeconds: 0, volume: 1, fadeInSeconds: 0, fadeOutSeconds: 0 }],
      1
    );
    const quiet = mixClips(
      [{ audio: tone(), startSeconds: 0, volume: 0.5, fadeInSeconds: 0, fadeOutSeconds: 0 }],
      1
    );
    const peak = (samples: Float32Array): number =>
      samples.reduce((max, s) => Math.max(max, Math.abs(s)), 0);
    expect(peak(quiet)).toBeCloseTo(peak(loud) / 2, 5);
  });

  it('drops sound past the end of the timeline instead of stretching it', () => {
    const mixed = mixClips(
      [{ audio: tone(), startSeconds: 0.9, volume: 1, fadeInSeconds: 0, fadeOutSeconds: 0 }],
      1
    );
    expect(mixed.length).toBe(EXPORT_SAMPLE_RATE);
  });

  it('overlapping clips add together and stay in range', () => {
    const clips = [0, 0, 0, 0].map(() => ({
      audio: tone(),
      startSeconds: 0,
      volume: 1,
      fadeInSeconds: 0,
      fadeOutSeconds: 0
    }));
    const mixed = mixClips(clips, 1);
    const peak = mixed.reduce((max, s) => Math.max(max, Math.abs(s)), 0);
    expect(peak).toBeGreaterThan(0.9); // four beeps at once clip the peak…
    expect(peak).toBeLessThanOrEqual(1); // …but never past the legal range
  });

  it('refuses a clip whose sample rate does not match the export rate', () => {
    const wrongRate = { sampleRate: 24000, samples: new Float32Array(100) };
    expect(() =>
      mixClips(
        [{ audio: wrongRate, startSeconds: 0, volume: 1, fadeInSeconds: 0, fadeOutSeconds: 0 }],
        1
      )
    ).toThrow(/sample rate/);
  });
});
