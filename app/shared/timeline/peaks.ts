// Waveform peaks (Phase 6 decision k): the little mountain range drawn on
// an audio clip comes from the decoded samples, reduced to one peak per
// bucket. Computed once per sound and held in memory for the session —
// nothing is ever written to cache/. Pure arithmetic, tested under vitest.

/**
 * The loudest moment (absolute sample value, 0..1) in each of `buckets`
 * equal slices of the samples. Every bucket reads at least one sample, so
 * with fewer samples than buckets the nearest sample repeats (a flat line,
 * not fake silence); no samples (or no buckets) gives all zeros.
 */
export function waveformPeaks(samples: Float32Array, buckets: number): Float32Array {
  const out = new Float32Array(Math.max(0, buckets));
  if (samples.length === 0 || buckets <= 0) return out;
  const perBucket = samples.length / buckets;
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor(b * perBucket);
    const to = Math.min(samples.length, Math.max(from + 1, Math.floor((b + 1) * perBucket)));
    let peak = 0;
    for (let i = from; i < to; i++) {
      const value = Math.abs(samples[i] ?? 0);
      if (value > peak) peak = value;
    }
    out[b] = peak;
  }
  return out;
}
