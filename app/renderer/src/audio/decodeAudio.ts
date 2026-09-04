// Decoding sounds for the mixer and (Phase 6, later) the preview: every
// format Chromium can read — MP3, WAV, M4A, OGG, at any sample rate —
// comes back as mono samples at the export rate (decision j), decoded the
// same way importAudio.ts proves readability on import. Channels are
// averaged to mono, matching the mixer; stereo export is OQ-024.

import { EXPORT_SAMPLE_RATE, type AudioSource } from '../../../shared/export/audioMix';

/** Decodes a sound's bytes to 48 kHz mono samples via Chromium. */
export async function decodeAssetAudio(bytes: Uint8Array): Promise<AudioSource> {
  // decodeAudioData resamples to the context's rate, so any file arrives
  // at exactly the export rate. The copy detaches from any IPC buffer.
  const context = new OfflineAudioContext(1, 1, EXPORT_SAMPLE_RATE);
  const copy = new Uint8Array(bytes);
  const buffer = await context.decodeAudioData(copy.buffer as ArrayBuffer);
  const samples = new Float32Array(buffer.length);
  const channels = buffer.numberOfChannels;
  for (let c = 0; c < channels; c++) {
    const channel = buffer.getChannelData(c);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = (samples[i] ?? 0) + (channel[i] ?? 0) / channels;
    }
  }
  return { sampleRate: EXPORT_SAMPLE_RATE, samples };
}
