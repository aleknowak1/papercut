// The ten-second export test project (Phase 2, OQ-019). Generated entirely
// in code — no downloaded images or sounds — and never shipped: this file
// lives under tests/fixtures and is only reachable from development builds
// and the export check.
//
// What it contains, and why:
// - a plain dark background and an orange square moving steadily
//   left-to-right (a real prop layer with keyframes, so export exercises
//   the real document);
// - a short beep at 0, 2.5, 5, 7.5 and 9.5 seconds (five real audio clips;
//   the last is at 9.5 so it finishes before the video ends);
// - at each beep the exporter flashes the whole frame white for 3 frames,
//   so sound and picture carry the same event: audio drift is visible,
//   audible, and measurable by the export check;
// - the exporter's debug overlay burns a frame counter and timecode into
//   every frame.

import { EXPORT_SAMPLE_RATE } from '../../app/shared/export/audioMix';
import {
  addAsset,
  addAudioClip,
  addLayer,
  addScene,
  renameScene,
  setKeyframe,
  setSceneBackground,
  setSceneDuration
} from '../../app/shared/document/edits';
import { newId } from '../../app/shared/document/create';
import type { Keyframe, ProjectDocument } from '../../app/shared/document/types';
import { solidPng } from './png';

export const EXPORT_TEST = {
  durationSeconds: 10,
  fps: 30,
  /** The five plain, untrimmed beep clips. */
  beepTimes: [0, 2.5, 5, 7.5, 9.5],
  beepSeconds: 0.2,
  beepHz: 880,
  /** The exporter flashes the frame white for this many frames at each beep. */
  flashFrames: 3,
  backgroundFile: 'assets/images/export-test-bg.png',
  squareFile: 'assets/images/export-test-square.png',
  beepFile: 'assets/audio/export-test-beep.wav',
  /**
   * A TRIMMED WAV clip (Phase 6): the file hides its beep 0.4 s in and
   * carries a SECOND beep in the part the trim cuts off. Only with both
   * trim values honoured does exactly one beep sound, exactly at the clip
   * start — a wrong trimStart drifts it 400 ms, an ignored duration adds
   * an extra beep, and either fails the check.
   */
  trimmedWav: {
    file: 'assets/audio/export-test-trimmed.wav',
    clipStart: 3.8,
    trimStart: 0.4,
    duration: 0.2,
    hz: 660,
    sourceSeconds: 1.15
  },
  /**
   * A trimmed M4A clip (Phase 6): same idea through the AAC decoder path
   * (one beep, 0.5 s in). The bytes are generated at check time with the
   * WebCodecs AAC encoder (dev/exportTestAssets.ts) since AAC needs
   * Chromium; only the samples are defined here.
   */
  trimmedM4a: {
    file: 'assets/audio/export-test-trimmed.m4a',
    clipStart: 6.2,
    trimStart: 0.5,
    duration: 0.2,
    hz: 550,
    sourceSeconds: 1
  }
} as const;

/** Every moment a beep should sound and a flash should show, sorted. */
export function allBeepTimes(): number[] {
  return [
    ...EXPORT_TEST.beepTimes,
    EXPORT_TEST.trimmedWav.clipStart,
    EXPORT_TEST.trimmedM4a.clipStart
  ].sort((a, b) => a - b);
}

/** A sine tone with 3 ms ramps against clicks, as raw samples. */
function toneSamples(seconds: number, hz: number, gain: number): Float32Array {
  const count = Math.round(seconds * EXPORT_SAMPLE_RATE);
  const ramp = Math.round(0.003 * EXPORT_SAMPLE_RATE);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let g = gain;
    if (i < ramp) g *= i / ramp;
    if (i >= count - ramp) g *= (count - i) / ramp;
    out[i] = Math.sin((2 * Math.PI * hz * i) / EXPORT_SAMPLE_RATE) * g;
  }
  return out;
}

function concatSamples(...parts: readonly Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Samples wrapped as a mono 48 kHz 16-bit PCM WAV. */
function wav16(samples: Float32Array): Uint8Array {
  const dataBytes = samples.length * 2;
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
  view.setUint32(24, EXPORT_SAMPLE_RATE, true);
  view.setUint32(28, EXPORT_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, Math.round((samples[i] ?? 0) * 32767), true);
  }
  return bytes;
}

/**
 * The trimmed-WAV fixture file: silence, the beep the trim selects, then
 * a gap and a SECOND beep that must never be heard (the duration cuts it).
 */
export function trimmedWavBytes(): Uint8Array {
  const t = EXPORT_TEST.trimmedWav;
  return wav16(
    concatSamples(
      new Float32Array(Math.round(t.trimStart * EXPORT_SAMPLE_RATE)),
      toneSamples(t.duration, t.hz, 0.5),
      new Float32Array(Math.round(0.15 * EXPORT_SAMPLE_RATE)),
      toneSamples(0.2, t.hz, 0.5),
      new Float32Array(Math.round(0.2 * EXPORT_SAMPLE_RATE))
    )
  );
}

/** The trimmed-M4A fixture's samples: silence, one beep, silence. */
export function trimmedM4aSamples(): Float32Array {
  const t = EXPORT_TEST.trimmedM4a;
  return concatSamples(
    new Float32Array(Math.round(t.trimStart * EXPORT_SAMPLE_RATE)),
    toneSamples(t.duration, t.hz, 0.5),
    new Float32Array(Math.round(0.3 * EXPORT_SAMPLE_RATE))
  );
}

/** A 16-bit PCM mono WAV containing one sine beep, with 3 ms ramps to avoid clicks. */
export function beepWav(): Uint8Array {
  const sampleRate = EXPORT_SAMPLE_RATE;
  const sampleCount = Math.round(EXPORT_TEST.beepSeconds * sampleRate);
  const rampSamples = Math.round(0.003 * sampleRate);
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
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < sampleCount; i++) {
    let gain = 0.5;
    if (i < rampSamples) gain *= i / rampSamples;
    if (i >= sampleCount - rampSamples) gain *= (sampleCount - i) / rampSamples;
    const sample = Math.sin((2 * Math.PI * EXPORT_TEST.beepHz * i) / sampleRate) * gain;
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }
  return new Uint8Array(buffer);
}

/**
 * The image and sound files the test project needs, as bytes to write into
 * its assets/ — everything except the M4A, which needs Chromium's AAC
 * encoder and is written by dev/exportTestAssets.ts at run time.
 */
export function exportTestAssetFiles(): readonly { path: string; bytes: Uint8Array }[] {
  return [
    // Tiny solid-colour images; the renderer stretches them to size.
    { path: EXPORT_TEST.backgroundFile, bytes: solidPng(64, 36, [28, 39, 51, 255]) },
    { path: EXPORT_TEST.squareFile, bytes: solidPng(64, 64, [255, 140, 26, 255]) },
    { path: EXPORT_TEST.beepFile, bytes: beepWav() },
    { path: EXPORT_TEST.trimmedWav.file, bytes: trimmedWavBytes() }
  ];
}

/**
 * Builds the ten-second test scene in the document's FIRST scene (the one
 * the export prototype renders), through the normal edit functions.
 * Positions are in the 16:9 reference space (1920×1080).
 */
export function applyExportTestContent(doc: ProjectDocument): ProjectDocument {
  const bgId = newId();
  const squareId = newId();
  const beepId = newId();
  const trimmedWavId = newId();
  const trimmedM4aId = newId();
  const layerId = newId();

  let out = doc;
  out = addAsset(out, {
    id: bgId,
    type: 'image',
    file: EXPORT_TEST.backgroundFile,
    metadata: { width: 64, height: 36 }
  });
  out = addAsset(out, {
    id: squareId,
    type: 'image',
    file: EXPORT_TEST.squareFile,
    metadata: { width: 64, height: 64 }
  });
  out = addAsset(out, {
    id: beepId,
    type: 'audio',
    file: EXPORT_TEST.beepFile,
    metadata: { durationSeconds: EXPORT_TEST.beepSeconds }
  });
  out = addAsset(out, {
    id: trimmedWavId,
    type: 'audio',
    file: EXPORT_TEST.trimmedWav.file,
    metadata: { durationSeconds: EXPORT_TEST.trimmedWav.sourceSeconds }
  });
  out = addAsset(out, {
    id: trimmedM4aId,
    type: 'audio',
    file: EXPORT_TEST.trimmedM4a.file,
    metadata: { durationSeconds: EXPORT_TEST.trimmedM4a.sourceSeconds }
  });
  // A new project starts with one empty scene; the test fills that scene.
  let sceneId = out.scenes[0]?.id;
  if (sceneId === undefined) {
    sceneId = newId();
    out = addScene(out, {
      id: sceneId,
      name: 'Export test',
      durationSeconds: EXPORT_TEST.durationSeconds,
      cameraKeyframes: [],
      layers: [],
      audioClips: []
    });
  }
  out = renameScene(out, sceneId, 'Export test');
  out = setSceneDuration(out, sceneId, EXPORT_TEST.durationSeconds);
  out = setSceneBackground(out, sceneId, bgId);
  out = addLayer(out, sceneId, {
    id: layerId,
    name: 'Moving square',
    source: { kind: 'prop', assetId: squareId },
    keyframes: []
  });
  const base: Omit<Keyframe, 'time' | 'x'> = {
    y: 540,
    scale: 3.75, // 64 px image × 3.75 = a 240 px square
    rotation: 0,
    flipX: false,
    opacity: 1,
    easing: 'linear'
  };
  out = setKeyframe(out, sceneId, layerId, { ...base, time: 0, x: 220 });
  out = setKeyframe(out, sceneId, layerId, {
    ...base,
    time: EXPORT_TEST.durationSeconds,
    x: 1700
  });
  for (const time of EXPORT_TEST.beepTimes) {
    out = addAudioClip(out, sceneId, {
      id: newId(),
      source: { kind: 'asset', assetId: beepId },
      startSeconds: time,
      volume: 1,
      fadeInSeconds: 0,
      fadeOutSeconds: 0
    });
  }
  // The two TRIMMED clips (Phase 6): each plays only the beep its trim
  // selects, so it must land exactly on its flash — the end-to-end proof
  // of the decoder-and-trim path.
  for (const [assetId, spec] of [
    [trimmedWavId, EXPORT_TEST.trimmedWav],
    [trimmedM4aId, EXPORT_TEST.trimmedM4a]
  ] as const) {
    out = addAudioClip(out, sceneId, {
      id: newId(),
      source: { kind: 'asset', assetId },
      startSeconds: spec.clipStart,
      volume: 1,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      trimStartSeconds: spec.trimStart,
      durationSeconds: spec.duration
    });
  }
  return out;
}
