// Cutout versioning for the mask editor (M-2.4, DOC-13 §9.5 hand-off
// design): saving an edited mask writes a NEW file next to the old one
// (photo-v2.png, -v3, …) and the document is repointed in one edit — so a
// document-level undo can point back at the previous file, which still
// exists. Old versions are kept for now (tidying is OQ-021).
//
// The saved file is the ORIGINAL working-copy pixels plus the edited alpha:
// RGB is taken byte-for-byte from the existing cutout file through our own
// PNG decode — never through a browser canvas, which premultiplies alpha
// and would subtly alter colours (DOC-01 §5).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { decodePngRgba, encodePngRgba } from './segmentation/png';
import { resolveProjectFile } from './projectStore';

/** photo.png → photo-v2.png; photo-v7.png → photo-v8.png (first free slot). */
export function nextCutoutVersionPath(projectDir: string, currentRelPath: string): string {
  const stem = currentRelPath.replace(/-v\d+(?=\.png$)/, '').replace(/\.png$/, '');
  for (let version = 2; ; version++) {
    const candidate = `${stem}-v${version}.png`;
    if (!existsSync(resolveProjectFile(projectDir, candidate))) return candidate;
  }
}

export interface CutoutPixels {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

/** The cutout's exact bytes (RGB = working copy, alpha = current mask). */
export function readCutoutPixels(projectDir: string, relativePath: string): CutoutPixels {
  const file = readFileSync(resolveProjectFile(projectDir, relativePath));
  return decodePngRgba(file);
}

/**
 * Writes the next version: current file's RGB, the editor's alpha. Returns
 * the new path (relative to the project) for the document repoint edit.
 */
export function saveCutoutVersion(
  projectDir: string,
  currentRelPath: string,
  alpha: Uint8Array,
  width: number,
  height: number
): string {
  const current = readCutoutPixels(projectDir, currentRelPath);
  if (current.width !== width || current.height !== height || alpha.length !== width * height) {
    throw new Error(
      'The edited mask does not match the cutout it came from ' +
        `(${width}×${height} vs ${current.width}×${current.height}). Nothing was saved.`
    );
  }
  const out = new Uint8Array(current.rgba); // RGB untouched…
  for (let i = 0; i < alpha.length; i++) out[i * 4 + 3] = alpha[i] ?? 0; // …only alpha changes
  const relativePath = nextCutoutVersionPath(projectDir, currentRelPath);
  const fullPath = resolveProjectFile(projectDir, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, encodePngRgba(out, width, height));
  return relativePath;
}
