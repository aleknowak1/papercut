// Reading WAV files without any library. The export pipeline mixes every
// audio clip into one stream of numbers before encoding (DOC-03 §4.3), and
// project audio starts life as WAV (imports are converted on import in
// Phase 3; fake TTS and test fixtures already produce WAV).
//
// Supports the common cases: 16-bit PCM and 32-bit float, mono or stereo.
// Anything else fails loudly rather than producing wrong-sounding audio.

export interface WavAudio {
  readonly sampleRate: number;
  /** Mono samples in the range -1..1 (stereo input is averaged to mono). */
  readonly samples: Float32Array;
}

function ascii(view: DataView, offset: number, length: number): string {
  let text = '';
  for (let i = 0; i < length; i++) text += String.fromCharCode(view.getUint8(offset + i));
  return text;
}

export function parseWav(bytes: Uint8Array): WavAudio {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 44 || ascii(view, 0, 4) !== 'RIFF' || ascii(view, 8, 4) !== 'WAVE') {
    throw new Error('Not a WAV file (missing RIFF/WAVE header).');
  }

  let format = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataLength = 0;

  // Walk the chunks; a WAV file is a list of tagged chunks after the header.
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const id = ascii(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    if (id === 'fmt ') {
      format = view.getUint16(offset + 8, true);
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (id === 'data') {
      dataOffset = offset + 8;
      dataLength = Math.min(size, bytes.byteLength - dataOffset);
    }
    offset += 8 + size + (size % 2); // chunks are padded to even length
  }

  if (dataOffset < 0) throw new Error('WAV file has no data chunk.');
  if (channels !== 1 && channels !== 2) {
    throw new Error(`WAV has ${channels} channels; only mono and stereo are supported.`);
  }

  const isPcm16 = format === 1 && bitsPerSample === 16;
  const isFloat32 = format === 3 && bitsPerSample === 32;
  if (!isPcm16 && !isFloat32) {
    throw new Error(
      `Unsupported WAV format (format ${format}, ${bitsPerSample}-bit); ` +
        'only 16-bit PCM and 32-bit float are supported.'
    );
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(dataLength / (bytesPerSample * channels));
  const samples = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const at = dataOffset + (i * channels + c) * bytesPerSample;
      sum += isPcm16 ? view.getInt16(at, true) / 32768 : view.getFloat32(at, true);
    }
    samples[i] = sum / channels;
  }
  return { sampleRate, samples };
}
