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
  beepTimes: [0, 2.5, 5, 7.5, 9.5],
  beepSeconds: 0.2,
  beepHz: 880,
  /** The exporter flashes the frame white for this many frames at each beep. */
  flashFrames: 3,
  backgroundFile: 'assets/images/export-test-bg.png',
  squareFile: 'assets/images/export-test-square.png',
  beepFile: 'assets/audio/export-test-beep.wav'
} as const;

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

/** The image and sound files the test project needs, as bytes to write into its assets/. */
export function exportTestAssetFiles(): readonly { path: string; bytes: Uint8Array }[] {
  return [
    // Tiny solid-colour images; the renderer stretches them to size.
    { path: EXPORT_TEST.backgroundFile, bytes: solidPng(64, 36, [28, 39, 51, 255]) },
    { path: EXPORT_TEST.squareFile, bytes: solidPng(64, 64, [255, 140, 26, 255]) },
    { path: EXPORT_TEST.beepFile, bytes: beepWav() }
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
  return out;
}
