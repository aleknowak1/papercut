// The audio-import fixture check (M-2.6, ADR-015): proves that the formats
// we can generate in code decode with the right duration through the same
// Chromium decoders the import path uses. Runs inside the export check's
// hidden window (one app boot for both). WAV comes from tests/fixtures;
// the M4A is made here with the WebCodecs AAC encoder + mp4-muxer, exactly
// the Phase 2 export stack. MP3 and OGG cannot be generated in code and
// are verified by Alek with real files. Development only; never ships.

import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { toneWav } from '../../../../tests/fixtures/audioFixtures';
import { decodeAudioDuration } from '../assets/importAudio';

export interface AudioFixtureResult {
  readonly format: string;
  readonly expectedSeconds: number;
  readonly decodedSeconds?: number;
  readonly problem?: string;
}

/** Mono samples encoded as an AAC .m4a via WebCodecs + mp4-muxer. */
export async function makeM4aFromSamples(samples: Float32Array): Promise<Uint8Array> {
  const sampleRate = 48000;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    audio: { codec: 'aac', sampleRate, numberOfChannels: 1 },
    fastStart: 'in-memory'
  });
  const errors: unknown[] = [];
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (error) => errors.push(error)
  });
  encoder.configure({ codec: 'mp4a.40.2', sampleRate, numberOfChannels: 1, bitrate: 96_000 });
  const frameSize = 1024;
  for (let start = 0; start < samples.length; start += frameSize) {
    // slice (not subarray) so the chunk owns a plain ArrayBuffer, as the
    // AudioData constructor's type requires.
    const data = samples.slice(start, Math.min(start + frameSize, samples.length));
    encoder.encode(
      new AudioData({
        format: 'f32',
        sampleRate,
        numberOfFrames: data.length,
        numberOfChannels: 1,
        timestamp: Math.round((start / sampleRate) * 1_000_000),
        data
      })
    );
  }
  await encoder.flush();
  encoder.close();
  muxer.finalize();
  if (errors.length > 0) throw new Error(`AAC encoding failed: ${String(errors[0])}`);
  return new Uint8Array(target.buffer);
}

/** A mono AAC .m4a containing a soft sine tone, for the fixture check. */
function makeM4a(seconds: number): Promise<Uint8Array> {
  const sampleRate = 48000;
  const samples = new Float32Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.sin((2 * Math.PI * 330 * i) / sampleRate) * 0.3;
  }
  return makeM4aFromSamples(samples);
}

export async function verifyAudioFixtures(): Promise<AudioFixtureResult[]> {
  const results: AudioFixtureResult[] = [];
  const cases: { format: string; expected: number; make: () => Promise<Uint8Array> }[] = [
    { format: 'WAV (code-generated)', expected: 2, make: async () => toneWav(2, 440) },
    { format: 'M4A (WebCodecs AAC + mp4-muxer)', expected: 2, make: () => makeM4a(2) }
  ];
  for (const { format, expected, make } of cases) {
    try {
      const bytes = await make();
      const decoded = await decodeAudioDuration(bytes);
      const tolerance = 0.15; // AAC adds a few frames of encoder padding
      results.push({
        format,
        expectedSeconds: expected,
        decodedSeconds: +decoded.toFixed(3),
        ...(Math.abs(decoded - expected) > tolerance
          ? { problem: `decoded ${decoded.toFixed(3)} s, expected ≈${expected} s` }
          : {})
      });
    } catch (error) {
      results.push({ format, expectedSeconds: expected, problem: String(error) });
    }
  }
  return results;
}
