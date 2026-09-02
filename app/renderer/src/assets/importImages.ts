// The renderer half of image import (DOC-03 §4.1). Chromium decodes the
// image (proving it is readable) BEFORE anything is copied into the
// project; the main process then copies the file unchanged and returns the
// asset record. Characters/props go on to the cutout queue with a working
// copy capped per ADR-017.

import type { Asset } from '../../../shared/document/types';
import { cappedWorkingSize } from '../../../shared/segmentation/pixels';

export type ImportRole = 'background' | 'character-prop';

export interface ImportOutcome {
  readonly fileName: string;
  /** Present when the file made it into the project. */
  readonly asset?: Asset;
  readonly bitmap?: ImageBitmap;
  /** Present when the file was refused; plain language. */
  readonly refused?: string;
}

/** Decode-or-refuse: Chromium's decoders decide whether a file is readable. */
async function decode(bytes: Uint8Array, fileName: string): Promise<ImageBitmap> {
  try {
    const copy = new Uint8Array(bytes); // detached from the IPC buffer
    return await createImageBitmap(new Blob([copy.buffer as ArrayBuffer]));
  } catch {
    throw new Error(
      `"${fileName}" could not be read as an image — the file may be damaged ` +
        'or not really a JPG/PNG/WebP. It was not added to the project.'
    );
  }
}

/**
 * Imports one file: read → decode (readability proof) → copy unchanged +
 * asset record → thumbnail into cache/. Returns the outcome either way;
 * never throws.
 */
export async function importOneImage(
  projectDir: string,
  sourcePath: string,
  role: ImportRole,
  existingHashes: readonly string[]
): Promise<ImportOutcome> {
  const fileName = sourcePath.split(/[\\/]/).pop() ?? sourcePath;
  try {
    const bytes = await window.papercut.readImportFile(sourcePath);
    const bitmap = await decode(bytes, fileName);
    const asset = await window.papercut.importImageAsset(projectDir, sourcePath, role, {
      width: bitmap.width,
      height: bitmap.height,
      existingHashes
    });
    await writeThumbnail(projectDir, asset.id, bitmap);
    return { fileName, asset, bitmap };
  } catch (error) {
    return { fileName, refused: error instanceof Error ? error.message : String(error) };
  }
}

/** A small PNG in cache/thumbnails/, regenerated freely (cache/ is disposable). */
export async function writeThumbnail(
  projectDir: string,
  assetId: string,
  bitmap: ImageBitmap
): Promise<void> {
  const MAX = 96;
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await window.papercut.writeProjectFile(projectDir, `cache/thumbnails/${assetId}.png`, bytes);
}

/**
 * The working copy for the cutout queue: raw RGBA at the photo's size,
 * capped at 4096 on the long edge (ADR-017). The original file on disk is
 * untouched either way.
 */
export function workingCopyRgba(bitmap: ImageBitmap): {
  rgba: Uint8Array;
  width: number;
  height: number;
} {
  const { width, height } = cappedWorkingSize(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not prepare the image for the cutout.');
  context.drawImage(bitmap, 0, 0, width, height);
  const image = context.getImageData(0, 0, width, height);
  return { rgba: new Uint8Array(image.data.buffer.slice(0)), width, height };
}
