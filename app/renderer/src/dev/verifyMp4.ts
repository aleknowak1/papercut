// Reads an exported .mp4 back and measures what is actually inside it
// (ADR-015 export check, OQ-019). Development and checks only — this file
// is only reachable from dev-mode dynamic imports and never ships.
//
// Container facts (duration, resolution, frame rate, frame count) come from
// mp4box (BSD-3-Clause, dev dependency). Content facts come from decoding:
// WebCodecs decoders turn the file back into frames and samples, the white
// flash frames are found by their brightness, the beep onsets by their
// loudness, and audio/video drift is the distance between matching pairs.

import {
  DataStream,
  Endianness,
  MP4BoxBuffer,
  createFile,
  type MultiBufferStream,
  type Sample
} from 'mp4box';

export interface BeepMeasurement {
  readonly nominalSeconds: number;
  readonly audioOnsetSeconds: number | undefined;
  readonly flashStartSeconds: number | undefined;
  /** Positive = the sound plays later than the picture. */
  readonly audioVsVideoMs: number | undefined;
  readonly audioVsNominalMs: number | undefined;
}

export interface ExportVerification {
  readonly durationSeconds: number;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly frameCount: number;
  readonly audioDurationSeconds: number;
  readonly beeps: readonly BeepMeasurement[];
  /** Mean brightness (0-255) at the crossfade probe's three frames, when asked for. */
  readonly crossfadeBrightness?: { readonly before: number; readonly mid: number; readonly after: number };
  readonly problems: readonly string[];
}

export interface ExpectedExport {
  readonly durationSeconds: number;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly beepTimes: readonly number[];
  /** Largest acceptable |audio - video| distance at a beep, in milliseconds. */
  readonly maxDriftMs: number;
  /**
   * Phase 7: three flash-free moments proving a crossfade on brightness
   * alone — the mid frame's mean must sit STRICTLY between the two clean
   * scenes' frames. Measured from the same decoded means the flash
   * detector already computes, so it cannot disturb flash detection.
   */
  readonly crossfadeProbe?: {
    readonly beforeSeconds: number;
    readonly midSeconds: number;
    readonly afterSeconds: number;
  };
}

interface ParsedMp4 {
  /** The whole file; samples reference their bytes by offset and size. */
  readonly fileBytes: Uint8Array;
  readonly movieDurationSeconds: number;
  readonly video: {
    readonly codec: string;
    readonly width: number;
    readonly height: number;
    readonly frameCount: number;
    readonly durationSeconds: number;
    readonly description: Uint8Array;
    readonly samples: readonly Sample[];
  };
  readonly audio: {
    readonly codec: string;
    readonly sampleRate: number;
    readonly channelCount: number;
    readonly durationSeconds: number;
    readonly samples: readonly Sample[];
  };
}

function parseMp4(bytes: Uint8Array): Promise<ParsedMp4> {
  return new Promise((resolve, reject) => {
    const file = createFile();
    file.onError = (module, message) => reject(new Error(`mp4box ${module}: ${message}`));
    file.onReady = (info) => {
      try {
        const video = info.videoTracks[0];
        const audio = info.audioTracks[0];
        if (video === undefined) throw new Error('The .mp4 has no video track.');
        if (audio === undefined) throw new Error('The .mp4 has no audio track.');

        // The H.264 decoder needs the avcC configuration record: the box's
        // bytes without its 8-byte size/type header.
        const avcC = file.getBox('avcC');
        if (avcC === undefined) throw new Error('The .mp4 has no avcC box.');
        const stream = new DataStream(undefined, 0, Endianness.BIG_ENDIAN);
        // Boxes write through the same DataStream methods; the declared
        // MultiBufferStream parameter is wider than what write() uses.
        avcC.write(stream as MultiBufferStream);
        const description = new Uint8Array(stream.buffer as ArrayBuffer, 8);

        const videoSamples = file.getTrackSamplesInfo(video.id);
        const audioSamples = file.getTrackSamplesInfo(audio.id);
        resolve({
          fileBytes: bytes,
          movieDurationSeconds: info.duration / info.timescale,
          video: {
            codec: video.codec,
            width: video.video?.width ?? video.track_width,
            height: video.video?.height ?? video.track_height,
            frameCount: video.nb_samples,
            durationSeconds: video.samples_duration / video.timescale,
            description,
            samples: videoSamples
          },
          audio: {
            codec: audio.codec,
            sampleRate: audio.audio?.sample_rate ?? 0,
            channelCount: audio.audio?.channel_count ?? 0,
            durationSeconds: audio.samples_duration / audio.timescale,
            samples: audioSamples
          }
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(copy, 0), true);
    file.flush();
  });
}

/**
 * mp4box's sample listing carries positions, not bytes; each sample's data
 * is its slice of the file.
 */
function sampleBytes(parsed: ParsedMp4, sample: Sample): Uint8Array {
  return sample.data ?? parsed.fileBytes.subarray(sample.offset, sample.offset + sample.size);
}

/**
 * The AAC decoder needs an AudioSpecificConfig; two bytes describing
 * AAC-LC, the sample rate, and the channel count. Built from the container
 * facts so verification never trusts what the encoder was asked to do.
 */
function audioSpecificConfig(sampleRate: number, channels: number): Uint8Array {
  const rates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000];
  const rateIndex = rates.indexOf(sampleRate);
  if (rateIndex < 0) throw new Error(`Unexpected AAC sample rate ${sampleRate}.`);
  const objectType = 2; // AAC-LC
  const bits = (objectType << 11) | (rateIndex << 7) | (channels << 3);
  return new Uint8Array([bits >> 8, bits & 0xff]);
}

/** Mean brightness (0-255) of a decoded frame, from a small downscaled copy. */
function meanBrightness(
  frame: VideoFrame,
  canvas: OffscreenCanvas,
  context: OffscreenCanvasRenderingContext2D
): number {
  context.drawImage(frame, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let sum = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    sum +=
      0.2126 * (pixels[i] ?? 0) + 0.7152 * (pixels[i + 1] ?? 0) + 0.0722 * (pixels[i + 2] ?? 0);
  }
  return sum / (pixels.length / 4);
}

interface FrameBrightness {
  readonly timeSeconds: number;
  readonly mean: number;
}

async function decodeFlashTimes(
  parsed: ParsedMp4
): Promise<{ flashes: number[]; frames: FrameBrightness[] }> {
  const canvas = new OffscreenCanvas(96, 54);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) throw new Error('Could not create a 2D canvas for frame analysis.');

  const bright: { timeSeconds: number; mean: number }[] = [];
  let failure: Error | undefined;
  const decoder = new VideoDecoder({
    output: (frame) => {
      bright.push({
        timeSeconds: frame.timestamp / 1_000_000,
        mean: meanBrightness(frame, canvas, context)
      });
      frame.close();
    },
    error: (e) => {
      failure ??= e;
    }
  });
  decoder.configure({
    codec: parsed.video.codec,
    codedWidth: parsed.video.width,
    codedHeight: parsed.video.height,
    description: parsed.video.description
  });
  for (const sample of parsed.video.samples) {
    decoder.decode(
      new EncodedVideoChunk({
        type: sample.is_sync ? 'key' : 'delta',
        timestamp: Math.round((sample.cts / sample.timescale) * 1_000_000),
        duration: Math.round((sample.duration / sample.timescale) * 1_000_000),
        data: sampleBytes(parsed, sample)
      })
    );
  }
  await decoder.flush();
  decoder.close();
  if (failure) throw failure;

  // A flash frame is far brighter than anything else in the test video:
  // dark background vs a 60% white overlay. Group consecutive bright frames
  // and report each group's first frame time.
  bright.sort((a, b) => a.timeSeconds - b.timeSeconds);
  const THRESHOLD = 120;
  const flashes: number[] = [];
  let inFlash = false;
  for (const frame of bright) {
    if (frame.mean > THRESHOLD && !inFlash) {
      flashes.push(frame.timeSeconds);
      inFlash = true;
    } else if (frame.mean <= THRESHOLD) {
      inFlash = false;
    }
  }
  return { flashes, frames: bright };
}

/** The decoded frame nearest a time (within half a frame), for the probe. */
function brightnessAt(
  frames: readonly FrameBrightness[],
  timeSeconds: number,
  fps: number
): number | undefined {
  let best: FrameBrightness | undefined;
  for (const frame of frames) {
    if (best === undefined || Math.abs(frame.timeSeconds - timeSeconds) < Math.abs(best.timeSeconds - timeSeconds)) {
      best = frame;
    }
  }
  return best !== undefined && Math.abs(best.timeSeconds - timeSeconds) <= 0.5 / fps + 0.001
    ? best.mean
    : undefined;
}

async function decodeAudioOnsets(
  parsed: ParsedMp4
): Promise<{ onsets: number[]; decodedSeconds: number; pieces: number; peak: number }> {
  const pieces: { timeSeconds: number; samples: Float32Array }[] = [];
  let failure: Error | undefined;
  const decoder = new AudioDecoder({
    output: (data) => {
      const samples = new Float32Array(data.numberOfFrames);
      data.copyTo(samples, { planeIndex: 0, format: 'f32-planar' });
      pieces.push({ timeSeconds: data.timestamp / 1_000_000, samples });
      data.close();
    },
    error: (e) => {
      failure ??= e;
    }
  });
  decoder.configure({
    codec: parsed.audio.codec,
    sampleRate: parsed.audio.sampleRate,
    numberOfChannels: parsed.audio.channelCount,
    description: audioSpecificConfig(parsed.audio.sampleRate, parsed.audio.channelCount)
  });
  for (const sample of parsed.audio.samples) {
    decoder.decode(
      new EncodedAudioChunk({
        type: 'key',
        timestamp: Math.round((sample.cts / sample.timescale) * 1_000_000),
        duration: Math.round((sample.duration / sample.timescale) * 1_000_000),
        data: sampleBytes(parsed, sample)
      })
    );
  }
  await decoder.flush();
  decoder.close();
  if (failure) throw failure;

  pieces.sort((a, b) => a.timeSeconds - b.timeSeconds);
  const rate = parsed.audio.sampleRate;
  const first = pieces[0];
  const startSeconds = first === undefined ? 0 : first.timeSeconds;
  const total = pieces.reduce((sum, p) => sum + p.samples.length, 0);
  const pcm = new Float32Array(total);
  let at = 0;
  for (const piece of pieces) {
    pcm.set(piece.samples, at);
    at += piece.samples.length;
  }

  // An onset is the first loud sample after at least 100 ms of near-silence.
  // Medium levels (a beep's fade-in, a sine wave near its zero crossings)
  // neither count as silence nor break the silence.
  const LOUD = 0.05;
  const QUIET = 0.02;
  const QUIET_RUN = Math.round(0.1 * rate);
  const onsets: number[] = [];
  let quietRun = QUIET_RUN; // the file may start with a beep at t = 0
  for (let i = 0; i < pcm.length; i++) {
    const level = Math.abs(pcm[i] ?? 0);
    if (level > LOUD) {
      if (quietRun >= QUIET_RUN) onsets.push(startSeconds + i / rate);
      quietRun = 0;
    } else if (level < QUIET) {
      quietRun++;
    }
  }
  let peak = 0;
  for (const s of pcm) peak = Math.max(peak, Math.abs(s));
  return { onsets, decodedSeconds: startSeconds + pcm.length / rate, pieces: pieces.length, peak };
}

function nearest(times: readonly number[], target: number): number | undefined {
  let best: number | undefined;
  for (const t of times) {
    if (best === undefined || Math.abs(t - target) < Math.abs(best - target)) best = t;
  }
  return best !== undefined && Math.abs(best - target) <= 0.5 ? best : undefined;
}

export async function verifyExportedMp4(
  bytes: Uint8Array,
  expected: ExpectedExport
): Promise<ExportVerification> {
  const parsed = await parseMp4(bytes);
  const { flashes, frames } = await decodeFlashTimes(parsed);
  const { onsets, pieces, peak } = await decodeAudioOnsets(parsed);

  const fps = parsed.video.frameCount / parsed.video.durationSeconds;
  const problems: string[] = [];
  const frameTolerance = 1 / expected.fps + 0.001;

  if (Math.abs(parsed.video.durationSeconds - expected.durationSeconds) > frameTolerance) {
    problems.push(
      `Video duration is ${parsed.video.durationSeconds.toFixed(3)} s, expected ${expected.durationSeconds} s.`
    );
  }
  if (parsed.video.width !== expected.width || parsed.video.height !== expected.height) {
    problems.push(
      `Resolution is ${parsed.video.width}×${parsed.video.height}, expected ${expected.width}×${expected.height}.`
    );
  }
  if (Math.abs(fps - expected.fps) > 0.05) {
    problems.push(`Frame rate is ${fps.toFixed(3)} fps, expected ${expected.fps}.`);
  }
  const expectedFrames = Math.round(expected.durationSeconds * expected.fps);
  if (parsed.video.frameCount !== expectedFrames) {
    problems.push(`Frame count is ${parsed.video.frameCount}, expected ${expectedFrames}.`);
  }
  if (Math.abs(parsed.audio.durationSeconds - expected.durationSeconds) > 0.1) {
    problems.push(
      `Audio duration is ${parsed.audio.durationSeconds.toFixed(3)} s, expected ${expected.durationSeconds} s.`
    );
  }
  if (flashes.length !== expected.beepTimes.length) {
    problems.push(`Found ${flashes.length} flash(es), expected ${expected.beepTimes.length}.`);
  }
  if (onsets.length !== expected.beepTimes.length) {
    problems.push(
      `Found ${onsets.length} beep(s) in the audio, expected ${expected.beepTimes.length} ` +
        `(decoded ${pieces} audio chunk(s), loudest sample ${peak.toFixed(4)}).`
    );
  }

  const beeps: BeepMeasurement[] = expected.beepTimes.map((nominal) => {
    const audioOnset = nearest(onsets, nominal);
    const flashStart = nearest(flashes, nominal);
    const audioVsVideoMs =
      audioOnset !== undefined && flashStart !== undefined
        ? (audioOnset - flashStart) * 1000
        : undefined;
    const audioVsNominalMs = audioOnset !== undefined ? (audioOnset - nominal) * 1000 : undefined;
    if (audioOnset === undefined) {
      problems.push(`No beep found near ${nominal} s.`);
    }
    if (flashStart === undefined) {
      problems.push(`No flash found near ${nominal} s.`);
    }
    if (audioVsVideoMs !== undefined && Math.abs(audioVsVideoMs) > expected.maxDriftMs) {
      problems.push(
        `At ${nominal} s the sound is ${Math.abs(audioVsVideoMs).toFixed(1)} ms ` +
          `${audioVsVideoMs > 0 ? 'behind' : 'ahead of'} the picture (limit ${expected.maxDriftMs} ms).`
      );
    }
    return { nominalSeconds: nominal, audioOnsetSeconds: audioOnset, flashStartSeconds: flashStart, audioVsVideoMs, audioVsNominalMs };
  });

  // The crossfade probe (Phase 7 decision n): the mid frame's mean must
  // sit strictly between the two clean scenes' frames.
  let crossfadeBrightness: ExportVerification['crossfadeBrightness'];
  const probe = expected.crossfadeProbe;
  if (probe !== undefined) {
    const before = brightnessAt(frames, probe.beforeSeconds, expected.fps);
    const mid = brightnessAt(frames, probe.midSeconds, expected.fps);
    const after = brightnessAt(frames, probe.afterSeconds, expected.fps);
    if (before === undefined || mid === undefined || after === undefined) {
      problems.push('The crossfade probe could not find all three of its frames.');
    } else {
      crossfadeBrightness = { before, mid, after };
      const lo = Math.min(before, after);
      const hi = Math.max(before, after);
      if (!(mid > lo && mid < hi)) {
        problems.push(
          `Mid-crossfade brightness ${mid.toFixed(1)} does not sit between the two scenes' ` +
            `(${before.toFixed(1)} at ${probe.beforeSeconds} s, ${after.toFixed(1)} at ${probe.afterSeconds} s) — ` +
            'the transition is not blending the pictures.'
        );
      }
    }
  }

  return {
    durationSeconds: parsed.video.durationSeconds,
    width: parsed.video.width,
    height: parsed.video.height,
    fps,
    frameCount: parsed.video.frameCount,
    audioDurationSeconds: parsed.audio.durationSeconds,
    beeps,
    ...(crossfadeBrightness !== undefined ? { crossfadeBrightness } : {}),
    problems
  };
}
