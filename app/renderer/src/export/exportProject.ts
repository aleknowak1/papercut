// Exports a project document to .mp4 bytes (DOC-03 §4.3): loads the assets
// EVERY scene uses, mixes the whole video's audio through projectSchedule,
// draws every frame with the shared project renderer (scene/projectStage.ts
// — the same code the live canvas shows), and encodes through the WebCodecs
// pipeline. The video's length comes from the overlap timing model
// (timeline/projectTime.ts): scene durations minus transition lengths.
//
// Phase 9 (real export) adds presets and the export screen around this
// same pipeline; nothing here depends on the editor UI.

import type { ProjectDocument } from '../../../shared/document/types';
import { EXPORT_SAMPLE_RATE, mixSchedule, type AudioSource } from '../../../shared/export/audioMix';
import { projectSchedule } from '../../../shared/timeline/projectSchedule';
import { projectDurationSeconds, sceneStartSeconds } from '../../../shared/timeline/projectTime';
import { decodeAssetAudio } from '../audio/decodeAudio';
import { sceneImageAssetIds } from '../scene/sceneStage';
import { encodeMp4, type EncoderChoice } from './encodePipeline';
import { createProjectFrameSource } from './frameSource';

export interface ProjectExportRequest {
  readonly document: ProjectDocument;
  readonly width: number;
  readonly height: number;
  /** 'auto' = hardware when available; 'software' forces the no-GPU path. */
  readonly acceleration: 'auto' | 'software';
  /** Burn frame counter + timecode into the picture (dev and checks only). */
  readonly debugOverlay: boolean;
  /** Reads a file from the project folder, e.g. "assets/audio/beep.wav". */
  readonly readAsset: (relativePath: string) => Promise<Uint8Array>;
  readonly onProgress?: (framesDone: number, frameCount: number) => void;
}

export interface ProjectExportResult {
  readonly mp4: Uint8Array;
  readonly encoder: EncoderChoice;
  readonly videoCodec: string;
  readonly wallMillis: number;
  readonly frameCount: number;
  readonly durationSeconds: number;
  /** Loudest sample (0..1) of the mixed audio that went to the encoder. */
  readonly audioPeak: number;
}

export async function exportProject(request: ProjectExportRequest): Promise<ProjectExportResult> {
  const doc = request.document;
  if (doc.scenes.length === 0) {
    throw new Error('This project has no scene to export yet.');
  }
  const durationSeconds = projectDurationSeconds(doc);
  if (!(durationSeconds > 0)) {
    throw new Error('The project has no duration.');
  }
  const fps = doc.fps;
  const frameCount = Math.round(durationSeconds * fps);

  // Load every image ANY scene references (backgrounds, props, all poses).
  const assetById = new Map(doc.assets.map((a) => [a.id, a]));
  const imageIds = new Set<string>();
  for (const scene of doc.scenes) {
    for (const id of sceneImageAssetIds(doc, scene)) imageIds.add(id);
  }
  const images = new Map<string, ImageBitmap>();
  for (const id of imageIds) {
    const asset = assetById.get(id);
    if (asset === undefined) throw new Error(`A scene references a missing asset (${id}).`);
    const bytes = await request.readAsset(asset.file);
    images.set(id, await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>])));
  }

  // Decode every sound any scene's clips reference through Chromium's
  // decoder (Phase 6 decision j): MP3, M4A, OGG and any sample rate all
  // arrive as 48 kHz mono samples. TTS clips take part only once their
  // audio has been generated and cached (Phase 11); others are skipped,
  // not faked. projectSchedule — every scene's previewSchedule shifted
  // by its global start, the same entries the editor's preview plays —
  // then decides what sounds when, and the mixer renders it.
  const sources = new Map<string, AudioSource>();
  const soundSeconds = new Map<string, number>();
  for (const scene of doc.scenes) {
    for (const clip of scene.audioClips) {
      const assetId =
        clip.source.kind === 'asset' ? clip.source.assetId : clip.source.ttsLine.cachedAssetId;
      if (assetId === undefined || sources.has(assetId)) continue;
      const asset = assetById.get(assetId);
      if (asset === undefined) {
        throw new Error(`An audio clip references a missing asset (${assetId}).`);
      }
      const decoded = await decodeAssetAudio(await request.readAsset(asset.file));
      sources.set(assetId, decoded);
      soundSeconds.set(assetId, decoded.samples.length / decoded.sampleRate);
    }
  }
  const audio = mixSchedule(
    projectSchedule(doc, 0, soundSeconds),
    sources,
    durationSeconds,
    EXPORT_SAMPLE_RATE
  );
  const audioPeak = audio.reduce((max, s) => Math.max(max, Math.abs(s)), 0);

  // Every clip start is a flash moment (dev overlay only), at its GLOBAL
  // time, so sound and picture carry the same events across every scene
  // and drift between them stays visible and measurable.
  const starts = sceneStartSeconds(doc);
  const flashTimes = request.debugOverlay
    ? doc.scenes.flatMap((scene, i) =>
        scene.audioClips.map((c) => (starts[i] ?? 0) + c.startSeconds)
      )
    : [];

  const frameSource = await createProjectFrameSource({
    document: doc,
    width: request.width,
    height: request.height,
    fps,
    images,
    debugOverlay: request.debugOverlay,
    flashTimes,
    flashFrames: 3
  });

  try {
    const encoded = await encodeMp4({
      width: request.width,
      height: request.height,
      fps,
      frameCount,
      audio,
      sampleRate: EXPORT_SAMPLE_RATE,
      acceleration: request.acceleration,
      frameSource,
      onProgress: request.onProgress
    });
    return {
      mp4: encoded.mp4,
      encoder: encoded.encoder,
      videoCodec: encoded.videoCodec,
      wallMillis: encoded.wallMillis,
      frameCount,
      durationSeconds,
      audioPeak
    };
  } finally {
    frameSource.destroy();
    for (const bitmap of images.values()) bitmap.close();
  }
}
