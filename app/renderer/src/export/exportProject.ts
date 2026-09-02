// Exports a project document to .mp4 bytes (DOC-03 §4.3): loads the assets
// the first scene uses, mixes its audio clips, draws every frame with the
// PixiJS frame source, and encodes through the WebCodecs pipeline.
//
// Phase 2 scope: the first scene only, prop layers, asset audio clips.
// Phase 9 (real export) extends the same pipeline to scenes, transitions,
// and presets; nothing here depends on the editor UI.

import type { ProjectDocument } from '../../../shared/document/types';
import { EXPORT_SAMPLE_RATE, mixClips, type MixClip } from '../../../shared/export/audioMix';
import { parseWav } from '../../../shared/export/wav';
import { encodeMp4, type EncoderChoice } from './encodePipeline';
import { createPrototypeFrameSource } from './frameSource';

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
  const scene = doc.scenes[0];
  if (scene === undefined) {
    throw new Error('This project has no scene to export yet.');
  }
  if (!(scene.durationSeconds > 0)) {
    throw new Error('The scene has no duration.');
  }
  const fps = doc.fps;
  const frameCount = Math.round(scene.durationSeconds * fps);

  // Load every image the scene references.
  const assetById = new Map(doc.assets.map((a) => [a.id, a]));
  const imageIds = new Set<string>();
  if (scene.backgroundAssetId !== undefined) imageIds.add(scene.backgroundAssetId);
  for (const layer of scene.layers) {
    if (layer.source.kind === 'prop') imageIds.add(layer.source.assetId);
  }
  const images = new Map<string, ImageBitmap>();
  for (const id of imageIds) {
    const asset = assetById.get(id);
    if (asset === undefined) throw new Error(`The scene references a missing asset (${id}).`);
    const bytes = await request.readAsset(asset.file);
    images.set(id, await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>])));
  }

  // Mix the scene's audio clips. TTS clips take part only once their audio
  // has been generated and cached (Phase 11); others are skipped, not faked.
  const mix: MixClip[] = [];
  for (const clip of scene.audioClips) {
    const assetId =
      clip.source.kind === 'asset' ? clip.source.assetId : clip.source.ttsLine.cachedAssetId;
    if (assetId === undefined) continue;
    const asset = assetById.get(assetId);
    if (asset === undefined) throw new Error(`An audio clip references a missing asset (${assetId}).`);
    mix.push({
      audio: parseWav(await request.readAsset(asset.file)),
      startSeconds: clip.startSeconds,
      volume: clip.volume,
      fadeInSeconds: clip.fadeInSeconds,
      fadeOutSeconds: clip.fadeOutSeconds
    });
  }
  const audio = mixClips(mix, scene.durationSeconds, EXPORT_SAMPLE_RATE);
  const audioPeak = audio.reduce((max, s) => Math.max(max, Math.abs(s)), 0);

  const frameSource = await createPrototypeFrameSource({
    document: doc,
    scene,
    width: request.width,
    height: request.height,
    fps,
    images,
    debugOverlay: request.debugOverlay,
    // Every clip start is a flash moment, so sound and picture carry the
    // same events and drift between them is visible and measurable.
    flashTimes: request.debugOverlay ? scene.audioClips.map((c) => c.startSeconds) : [],
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
      durationSeconds: scene.durationSeconds,
      audioPeak
    };
  } finally {
    frameSource.destroy();
    for (const bitmap of images.values()) bitmap.close();
  }
}
