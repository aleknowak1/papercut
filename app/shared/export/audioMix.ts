// Mixes a scene's audio into one mono stream of samples, ready for the
// AAC encoder (DOC-03 §4.3). The mixer consumes EXACTLY the entries
// previewSchedule produces — the same entries the Web Audio preview
// plays — so what the user hears on play is what exports (Phase 6).
// Pure arithmetic, no browser APIs: the mix is unit-tested
// sample-for-sample under plain Node.

import type { GainPoint, ScheduledClip } from '../timeline/previewSchedule';

export const EXPORT_SAMPLE_RATE = 48000;

/** One decoded sound: mono samples at a known rate. */
export interface AudioSource {
  readonly sampleRate: number;
  /** Mono samples in the range -1..1. */
  readonly samples: Float32Array;
}

/**
 * The gain at a moment of an entry, ramped linearly between its envelope
 * points; before the first and after the last point the gain holds that
 * point's value. Points are few (at most four), so a scan is fine even
 * per sample.
 */
export function gainAtTime(points: readonly GainPoint[], atSeconds: number): number {
  const first = points[0];
  if (first === undefined) return 1;
  if (atSeconds <= first.atSeconds) return first.gain;
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!;
    const to = points[i]!;
    if (atSeconds <= to.atSeconds) {
      const span = to.atSeconds - from.atSeconds;
      if (span <= 0) return to.gain;
      return from.gain + ((atSeconds - from.atSeconds) / span) * (to.gain - from.gain);
    }
  }
  return points[points.length - 1]!.gain;
}

/**
 * Renders a schedule (previewSchedule from time 0) into one mono stream:
 * each entry starts at its exact sample, reads its sound from the trimmed
 * source offset, follows its gain envelope, overlaps sum, and the result
 * is clamped to the valid -1..1 range. Samples past the end of the
 * timeline are dropped (a clip may not extend the video).
 */
export function mixSchedule(
  schedule: readonly ScheduledClip[],
  sources: ReadonlyMap<string, AudioSource>,
  durationSeconds: number,
  sampleRate: number = EXPORT_SAMPLE_RATE
): Float32Array {
  const out = new Float32Array(Math.round(durationSeconds * sampleRate));
  for (const entry of schedule) {
    const source = sources.get(entry.assetId);
    if (source === undefined) {
      throw new Error(`The mix is missing the decoded sound for asset ${entry.assetId}.`);
    }
    if (source.sampleRate !== sampleRate) {
      // Never resample here: the decoder (decision j) already delivers
      // every sound at the export rate; anything else is a wiring bug.
      throw new Error(
        `Clip sample rate ${source.sampleRate} does not match the export rate ${sampleRate}.`
      );
    }
    const startSample = Math.round(entry.delaySeconds * sampleRate);
    const offsetSample = Math.round(entry.sourceOffsetSeconds * sampleRate);
    const count = Math.round(entry.playSeconds * sampleRate);
    for (let i = 0; i < count; i++) {
      const at = startSample + i;
      if (at < 0 || at >= out.length) continue;
      const sample = source.samples[offsetSample + i] ?? 0;
      out[at] = (out[at] ?? 0) + sample * gainAtTime(entry.gainPoints, i / sampleRate);
    }
  }
  for (let i = 0; i < out.length; i++) {
    const v = out[i] ?? 0;
    out[i] = v > 1 ? 1 : v < -1 ? -1 : v;
  }
  return out;
}
