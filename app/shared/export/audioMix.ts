// Mixes a scene's audio clips into one mono stream of samples, ready for
// the AAC encoder (DOC-03 §4.3). Pure arithmetic, no browser APIs, so the
// mix is unit-tested sample-for-sample under plain Node.

import type { WavAudio } from './wav';

export const EXPORT_SAMPLE_RATE = 48000;

export interface MixClip {
  readonly audio: WavAudio;
  readonly startSeconds: number;
  /** 0..1 */
  readonly volume: number;
  readonly fadeInSeconds: number;
  readonly fadeOutSeconds: number;
}

/**
 * Places every clip at its exact start sample, applies volume and fades,
 * sums overlaps, and clamps the result to the valid -1..1 range. Samples
 * past the end of the timeline are dropped (a clip may not extend the video).
 */
export function mixClips(
  clips: readonly MixClip[],
  durationSeconds: number,
  sampleRate: number = EXPORT_SAMPLE_RATE
): Float32Array {
  const out = new Float32Array(Math.round(durationSeconds * sampleRate));
  for (const clip of clips) {
    if (clip.audio.sampleRate !== sampleRate) {
      // Resampling arrives with audio import (Phase 3/6); everything the
      // prototype mixes is generated at the export rate already.
      throw new Error(
        `Clip sample rate ${clip.audio.sampleRate} does not match the export rate ${sampleRate}.`
      );
    }
    const startSample = Math.round(clip.startSeconds * sampleRate);
    const clipLength = clip.audio.samples.length;
    const fadeInSamples = Math.round(clip.fadeInSeconds * sampleRate);
    const fadeOutSamples = Math.round(clip.fadeOutSeconds * sampleRate);
    for (let i = 0; i < clipLength; i++) {
      const at = startSample + i;
      if (at < 0 || at >= out.length) continue;
      let gain = clip.volume;
      if (fadeInSamples > 0 && i < fadeInSamples) gain *= i / fadeInSamples;
      if (fadeOutSamples > 0 && i >= clipLength - fadeOutSamples) {
        gain *= (clipLength - i) / fadeOutSamples;
      }
      out[at] = (out[at] ?? 0) + (clip.audio.samples[i] ?? 0) * gain;
    }
  }
  for (let i = 0; i < out.length; i++) {
    const v = out[i] ?? 0;
    out[i] = v > 1 ? 1 : v < -1 ? -1 : v;
  }
  return out;
}
