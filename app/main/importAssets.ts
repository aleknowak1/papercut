// Image import (Phase 3, DOC-03 §4.1): the file is copied UNCHANGED into
// assets/images/ — byte for byte, never re-encoded — and an asset record is
// returned for the document. Duplicates (identical bytes) and unsupported
// types are refused in plain English.

import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname } from 'node:path';
import type { Asset } from '../shared/document/types';
import { resolveProjectFile } from './projectStore';

/** What the app can decode today. HEIC is converted on import in step 4. */
export const IMPORTABLE_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

export function readImportFileBytes(sourcePath: string): Buffer {
  const ext = extname(sourcePath).toLowerCase();
  if (!(IMPORTABLE_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new Error(
      `"${basename(sourcePath)}" is not a supported image type. ` +
        'PAPERCUT imports JPG, PNG and WebP photos.'
    );
  }
  try {
    return readFileSync(sourcePath);
  } catch {
    throw new Error(`"${basename(sourcePath)}" could not be read. Is the file still there?`);
  }
}

export interface ImportImageInfo {
  readonly width: number;
  readonly height: number;
  readonly existingHashes: readonly string[];
}

/**
 * Copies the image into the project and returns its asset record. The
 * caller (the UI) has already proved the file decodes; this function proves
 * it is not a duplicate and stores it untouched.
 */
export function importImageAsset(
  projectDir: string,
  sourcePath: string,
  role: 'background' | 'character-prop',
  info: ImportImageInfo
): Asset {
  const bytes = readImportFileBytes(sourcePath);
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  if (info.existingHashes.includes(contentHash)) {
    throw new Error(
      `"${basename(sourcePath)}" is already in this project (a file with exactly ` +
        'the same contents was imported before). It was not added again.'
    );
  }
  const id = randomUUID();
  const ext = extname(sourcePath).toLowerCase();
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
