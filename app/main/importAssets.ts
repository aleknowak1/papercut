// Image import (Phase 3, DOC-03 §4.1): the file is copied UNCHANGED into
// assets/images/ — byte for byte, never re-encoded — and an asset record is
// returned for the document. Duplicates (identical bytes) and unsupported
// types are refused in plain English.

import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join } from 'node:path';
import type { Asset } from '../shared/document/types';
import { HEIC_HELP_MESSAGE, convertHeicToPng, isHeicPath } from './heic';
import { resolveProjectFile } from './projectStore';

/** JPG/PNG/WebP import directly; HEIC/HEIF convert on import (OQ-016). */
export const IMPORTABLE_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif'
] as const;

/** Injectable so the checks can exercise both HEIC outcomes without a real HEIC. */
export type HeicConverter = typeof convertHeicToPng;

export function readImportFileBytes(sourcePath: string): Buffer {
  const ext = extname(sourcePath).toLowerCase();
  if (!(IMPORTABLE_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new Error(
      `"${basename(sourcePath)}" is not a supported image type. ` +
        'PAPERCUT imports JPG, PNG and WebP photos (and iPhone HEIC when Windows can decode it).'
    );
  }
  try {
    return readFileSync(sourcePath);
  } catch {
    throw new Error(`"${basename(sourcePath)}" could not be read. Is the file still there?`);
  }
}

/** Converts a HEIC to a temp PNG (or explains, in plain language, why not). */
async function heicToTempPng(sourcePath: string, convert: HeicConverter): Promise<string> {
  const destPath = join(
    tmpdir(),
    `papercut-heic-${createHash('sha1').update(sourcePath).digest('hex')}.png`
  );
  const result = await convert(sourcePath, destPath);
  if (!result.ok) {
    if (result.reason === 'no-decoder') throw new Error(HEIC_HELP_MESSAGE);
    throw new Error(
      `"${basename(sourcePath)}" could not be read as a photo` +
        (result.detail ? ` (${result.detail})` : '') +
        '. It was not added.'
    );
  }
  return destPath;
}

/**
 * The bytes the UI should decode for an import: the file itself, or for a
 * HEIC the PNG that Windows' own decoder produced (DOC-08 A13: nothing
 * bundled; a separate signed powershell.exe process does the work).
 */
export async function prepareImportFile(
  sourcePath: string,
  convert: HeicConverter = convertHeicToPng
): Promise<Buffer> {
  if (isHeicPath(sourcePath)) {
    const pngPath = await heicToTempPng(sourcePath, convert);
    return readFileSync(pngPath);
  }
  return readImportFileBytes(sourcePath);
}

export interface ImportImageInfo {
  readonly width: number;
  readonly height: number;
  readonly existingHashes: readonly string[];
}

// ---- audio (M-2.6): same shape as images — copy unchanged, refuse plainly ----

export const IMPORTABLE_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg'] as const;

export function readImportAudioBytes(sourcePath: string): Buffer {
  const ext = extname(sourcePath).toLowerCase();
  if (!(IMPORTABLE_AUDIO_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new Error(
      `"${basename(sourcePath)}" is not a supported sound type. ` +
        'PAPERCUT imports MP3, WAV, M4A and OGG files.'
    );
  }
  try {
    return readFileSync(sourcePath);
  } catch {
    throw new Error(`"${basename(sourcePath)}" could not be read. Is the file still there?`);
  }
}

export interface ImportAudioInfo {
  readonly durationSeconds: number;
  readonly existingHashes: readonly string[];
}

/** Copies a sound file unchanged into assets/audio/ and returns its record. */
export function importAudioAsset(
  projectDir: string,
  sourcePath: string,
  info: ImportAudioInfo
): Asset {
  const bytes = readImportAudioBytes(sourcePath);
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  if (info.existingHashes.includes(contentHash)) {
    throw new Error(
      `"${basename(sourcePath)}" is already in this project (a file with exactly ` +
        'the same contents was imported before). It was not added again.'
    );
  }
  const id = randomUUID();
  const relativePath = `assets/audio/${id}${extname(sourcePath).toLowerCase()}`;
  const fullPath = resolveProjectFile(projectDir, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, bytes);
  return {
    id,
    type: 'audio',
    file: relativePath,
    metadata: {
      originalFileName: basename(sourcePath),
      durationSeconds: info.durationSeconds,
      contentHash
    }
  };
}

/**
 * Copies the image into the project and returns its asset record. The
 * caller (the UI) has already proved the file decodes; this function proves
 * it is not a duplicate and stores it untouched. A HEIC is stored as the
 * PNG that Windows' decoder produced (the only exception to "copied
 * unchanged" — OQ-016; the original HEIC stays wherever the user keeps it).
 */
export async function importImageAsset(
  projectDir: string,
  sourcePath: string,
  role: 'background' | 'character-prop',
  info: ImportImageInfo,
  convert: HeicConverter = convertHeicToPng
): Promise<Asset> {
  const heic = isHeicPath(sourcePath);
  const bytes = await prepareImportFile(sourcePath, convert);
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  if (info.existingHashes.includes(contentHash)) {
    throw new Error(
      `"${basename(sourcePath)}" is already in this project (a file with exactly ` +
        'the same contents was imported before). It was not added again.'
    );
  }
  const id = randomUUID();
  const ext = heic ? '.png' : extname(sourcePath).toLowerCase();
  const relativePath = `assets/images/${id}${ext === '.jpeg' ? '.jpg' : ext}`;
  const fullPath = resolveProjectFile(projectDir, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, bytes);
  return {
    id,
    type: 'image',
    file: relativePath,
    metadata: {
      originalFileName: basename(sourcePath),
      width: info.width,
      height: info.height,
      contentHash,
      role
    }
  };
}
