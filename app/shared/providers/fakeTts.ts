// Fake TTS provider (DOC-09 rule 1): returns silent WAV audio, generated in
// code, instantly and for free. The duration scales with the text length so
// timelines behave roughly like they will with real speech. Deterministic:
// the same request always returns byte-identical audio, which is what the
// caching rule (DOC-09 rule 3) expects from real providers too.

import type { TtsProvider, TtsRequest, TtsResult } from './types';

const SAMPLE_RATE = 24000;
const SECONDS_PER_CHARACTER = 0.06;
const MIN_SECONDS = 0.5;
const MAX_SECONDS = 15;

/** Builds a valid 16-bit mono PCM WAV file containing silence. */
export function silentWav(durationSeconds: number): Uint8Array {
  const sampleCount = Math.round(durationSeconds * SAMPLE_RATE);
  const dataBytes = sampleCount * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);
  // Sample data stays zero: silence.
  return new Uint8Array(buffer);
}

export class FakeTtsProvider implements TtsProvider {
  readonly name = 'fake-tts';

  synthesize(request: TtsRequest): Promise<TtsResult> {
    const seconds = Math.min(
      MAX_SECONDS,
      Math.max(MIN_SECONDS, request.text.length * SECONDS_PER_CHARACTER)
    );
    return Promise.resolve({
      audioWav: silentWav(seconds),
      durationSeconds: seconds
    });
  }
}
