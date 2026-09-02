// Audio fixtures for the M-2.6 checks, generated entirely in code (nothing
// downloaded, never shipped): a 16-bit PCM WAV tone. The M4A fixture is
// produced at check time with the WebCodecs AAC encoder + mp4-muxer (see
// app/renderer/src/dev/audioFixtureCheck.ts) because AAC needs Chromium.
// MP3 and OGG cannot be generated in code — Alek verifies those with real
// files (DOC-10 §5).

/** A mono 48 kHz 16-bit PCM WAV containing a soft sine tone. */
export function toneWav(seconds: number, hz: number): Uint8Array {
  const sampleRate = 48000;
  const sampleCount = Math.round(seconds * sampleRate);
  const dataBytes = sampleCount * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < sampleCount; i++) {
    const sample = Math.sin((2 * Math.PI * hz * i) / sampleRate) * 0.3;
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }
  return bytes;
}
