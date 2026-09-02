// The encode half of export (DOC-03 §4.3, ADR-013): frames from a
// FrameSource go to the WebCodecs H.264 encoder, mixed audio goes to the
// WebCodecs AAC encoder — both provided by Windows — and mp4-muxer (MIT)
// writes the .mp4. No FFmpeg, no external programs, no native modules.

import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import type { FrameSource } from './frameSource';

export type EncoderChoice = 'hardware' | 'software';

export interface EncodeSettings {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly frameCount: number;
  /** Mono samples at sampleRate covering the whole video. */
  readonly audio: Float32Array;
  readonly sampleRate: number;
  /** 'auto' asks for hardware first and falls back; 'software' forces software. */
  readonly acceleration: 'auto' | 'software';
  readonly frameSource: FrameSource;
  readonly onProgress?: (framesDone: number, frameCount: number) => void;
}

export interface EncodeResult {
  readonly mp4: Uint8Array;
  readonly encoder: EncoderChoice;
  readonly videoCodec: string;
  readonly wallMillis: number;
}

/** H.264 constrained-baseline codec string with a level fitting the resolution. */
function h264Codec(width: number, height: number): string {
  return width * height <= 1280 * 720 ? 'avc1.42401f' : 'avc1.424028';
}

function videoBitrate(width: number, height: number): number {
  return width * height <= 1280 * 720 ? 5_000_000 : 8_000_000;
}

/** Waits until the encoder's queue drains below `max` so memory stays bounded. */
async function waitForQueue(encoder: VideoEncoder, max: number): Promise<void> {
  while (encoder.encodeQueueSize > max) {
    await new Promise<void>((resolve) =>
      encoder.addEventListener('dequeue', () => resolve(), { once: true })
    );
  }
}

export async function encodeMp4(settings: EncodeSettings): Promise<EncodeResult> {
  const { width, height, fps, frameCount, sampleRate } = settings;
  const codec = h264Codec(width, height);
  const started = performance.now();

  // Ask Windows for a hardware encoder first; fall back to its software
  // encoder. Which one answered is part of the result (OQ-019 wants to know).
  const baseConfig: VideoEncoderConfig = {
    codec,
    width,
    height,
    bitrate: videoBitrate(width, height),
    framerate: fps
  };
  let encoderChoice: EncoderChoice;
  let videoConfig: VideoEncoderConfig;
  if (settings.acceleration === 'auto') {
    const hardware: VideoEncoderConfig = { ...baseConfig, hardwareAcceleration: 'prefer-hardware' };
    const supported = await VideoEncoder.isConfigSupported(hardware);
    if (supported.supported === true) {
      encoderChoice = 'hardware';
      videoConfig = hardware;
    } else {
      encoderChoice = 'software';
      videoConfig = { ...baseConfig, hardwareAcceleration: 'prefer-software' };
    }
  } else {
    encoderChoice = 'software';
    videoConfig = { ...baseConfig, hardwareAcceleration: 'prefer-software' };
  }
  const videoSupport = await VideoEncoder.isConfigSupported(videoConfig);
  if (videoSupport.supported !== true) {
    throw new Error(`Windows offers no H.264 encoder for ${width}×${height} (${codec}).`);
  }

  const audioConfig: AudioEncoderConfig = {
    codec: 'mp4a.40.2', // AAC-LC
    sampleRate,
    numberOfChannels: 1,
    bitrate: 96_000
  };
  const audioSupport = await AudioEncoder.isConfigSupported(audioConfig);
  if (audioSupport.supported !== true) {
    throw new Error('Windows offers no AAC audio encoder (mp4a.40.2) through WebCodecs.');
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height, frameRate: fps },
    audio: { codec: 'aac', sampleRate, numberOfChannels: 1 },
    fastStart: 'in-memory'
  });

  let failure: Error | undefined;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      failure ??= e;
    }
  });
  videoEncoder.configure(videoConfig);

  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => {
      failure ??= e;
    }
  });
  audioEncoder.configure(audioConfig);

  // Video: draw and encode every frame, a keyframe every two seconds.
  const microsPerFrame = 1_000_000 / fps;
  for (let i = 0; i < frameCount; i++) {
    if (failure) throw failure;
    const canvas = settings.frameSource.drawFrame(i);
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round(i * microsPerFrame),
      duration: Math.round(microsPerFrame)
    });
    videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    await waitForQueue(videoEncoder, 8);
    settings.onProgress?.(i + 1, frameCount);
  }

  // Audio: the mixed mono track, in encoder-friendly slices.
  const SLICE = 1024;
  for (let at = 0; at < settings.audio.length; at += SLICE) {
    if (failure) throw failure;
    const slice = settings.audio.subarray(at, Math.min(at + SLICE, settings.audio.length));
    const data = new AudioData({
      format: 'f32',
      sampleRate,
      numberOfFrames: slice.length,
      numberOfChannels: 1,
      timestamp: Math.round((at / sampleRate) * 1_000_000),
      data: slice as Float32Array<ArrayBuffer>
    });
    audioEncoder.encode(data);
    data.close();
  }

  await videoEncoder.flush();
  await audioEncoder.flush();
  if (failure) throw failure;
  videoEncoder.close();
  audioEncoder.close();
  muxer.finalize();

  return {
    mp4: new Uint8Array(muxer.target.buffer),
    encoder: encoderChoice,
    videoCodec: codec,
    wallMillis: performance.now() - started
  };
}
