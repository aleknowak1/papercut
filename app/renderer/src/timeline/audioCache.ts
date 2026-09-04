// The session's decoded-sound cache (Phase 6 decisions i and k): each
// sound is decoded ONCE per session through Chromium (the same door
// import and export use) and kept in memory with its waveform peaks —
// nothing is ever written to cache/. The timeline draws the peaks; the
// Web Audio preview plays the samples.

import { waveformPeaks } from '../../../shared/timeline/peaks';
import type { Asset } from '../../../shared/document/types';
import { decodeAssetAudio } from '../audio/decodeAudio';

export interface CachedSound {
  readonly samples: Float32Array;
  readonly sampleRate: number;
  /** The sound's real decoded length, in seconds. */
  readonly durationSeconds: number;
  /** One peak per 1/PEAKS_PER_SECOND of sound; drawing rescales freely. */
  readonly peaks: Float32Array;
}

/** Peak resolution: 50 buckets per second reads cleanly at every zoom. */
export const PEAKS_PER_SECOND = 50;

const cache = new Map<string, Promise<CachedSound>>();

/** The decoded sound for an audio asset, from the cache when already known. */
export function getDecodedSound(projectDir: string, asset: Asset): Promise<CachedSound> {
  const key = `${asset.id}:${asset.file}`;
  let entry = cache.get(key);
  if (entry === undefined) {
    entry = window.papercut.readProjectFile(projectDir, asset.file).then((bytes) => {
      return decodeAssetAudio(new Uint8Array(bytes)).then((decoded) => {
        const durationSeconds = decoded.samples.length / decoded.sampleRate;
        const peaks = waveformPeaks(
          decoded.samples,
          Math.max(1, Math.round(durationSeconds * PEAKS_PER_SECOND))
        );
        return {
          samples: decoded.samples,
          sampleRate: decoded.sampleRate,
          durationSeconds,
          peaks
        };
      });
    });
    // A failed decode is forgotten so a later try can succeed.
    entry.catch(() => cache.delete(key));
    cache.set(key, entry);
  }
  return entry;
}
