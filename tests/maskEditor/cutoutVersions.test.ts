// Cutout versioning (M-2.4 save path, DOC-13 §9.5): saving writes a NEW
// file whose RGB is byte-identical to the current cutout's (never through a
// canvas), version names count up, reset/undo can point back at files that
// still exist, and the repoint edit is one undo step.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  nextCutoutVersionPath,
  readCutoutPixels,
  saveCutoutVersion
} from '../../app/main/cutoutVersions';
import { createProject, loadProject } from '../../app/main/projectStore';
import { addAsset, repointCutout } from '../../app/shared/document/edits';
import { applyEdit, createHistory, undo } from '../../app/shared/document/history';
import { encodePngRgba } from '../../app/main/segmentation/png';
import { suiteOutputDirs } from '../helpers/testOutput';

const tempDir = suiteOutputDirs('cutver');

/** A tiny cutout: distinct RGB per pixel, half the alpha 0, half 255. */
function makeCutout(projectDir: string, relPath: string, width = 6, height = 4): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = i * 7 % 256;
    rgba[i * 4 + 1] = i * 13 % 256;
    rgba[i * 4 + 2] = i * 29 % 256;
    rgba[i * 4 + 3] = i % 2 === 0 ? 255 : 0;
  }
  writeFileSync(join(projectDir, relPath), encodePngRgba(rgba, width, height));
  return rgba;
}

describe('version naming', () => {
  it('photo.png → -v2; an existing -v2 → -v3; -v7 strips back to the stem', () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'Versions', '9:16');
    makeCutout(projectDir, 'assets/cutouts/photo.png');
    expect(nextCutoutVersionPath(projectDir, 'assets/cutouts/photo.png')).toBe(
      'assets/cutouts/photo-v2.png'
    );
    makeCutout(projectDir, 'assets/cutouts/photo-v2.png');
    expect(nextCutoutVersionPath(projectDir, 'assets/cutouts/photo.png')).toBe(
      'assets/cutouts/photo-v3.png'
    );
    expect(nextCutoutVersionPath(projectDir, 'assets/cutouts/photo-v2.png')).toBe(
      'assets/cutouts/photo-v3.png'
    );
  });
});

describe('saveCutoutVersion', () => {
  it('writes original RGB + the edited alpha; the old file survives', () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'SaveVer', '9:16');
    const original = makeCutout(projectDir, 'assets/cutouts/c.png');

    const alpha = new Uint8Array(6 * 4).fill(128);
    const newRel = saveCutoutVersion(projectDir, 'assets/cutouts/c.png', alpha, 6, 4);
    expect(newRel).toBe('assets/cutouts/c-v2.png');

    const saved = readCutoutPixels(projectDir, newRel);
    for (let i = 0; i < 6 * 4; i++) {
      expect(saved.rgba[i * 4]).toBe(original[i * 4]); // RGB byte-identical
      expect(saved.rgba[i * 4 + 1]).toBe(original[i * 4 + 1]);
      expect(saved.rgba[i * 4 + 2]).toBe(original[i * 4 + 2]);
      expect(saved.rgba[i * 4 + 3]).toBe(128); // the edited alpha
    }
    // The previous version still exists for document undo.
    expect(readFileSync(join(projectDir, 'assets/cutouts/c.png')).length).toBeGreaterThan(0);
  });

  it('refuses a mask that does not match the cutout, in plain language', () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'BadVer', '9:16');
    makeCutout(projectDir, 'assets/cutouts/c.png');
    expect(() =>
      saveCutoutVersion(projectDir, 'assets/cutouts/c.png', new Uint8Array(5), 6, 4)
    ).toThrow(/does not match/);
  });
});

describe('the one repoint edit', () => {
  it('save-then-undo points the document back at the previous file', () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'Repoint', '9:16');
    makeCutout(projectDir, 'assets/cutouts/c.png');

    let history = createHistory(loadProject(projectDir));
    history = applyEdit(
      history,
      addAsset(history.present, {
        id: 'cut1',
        type: 'cutout',
        file: 'assets/cutouts/c.png',
        metadata: { width: 6, height: 4 }
      })
    );

    const newRel = saveCutoutVersion(
      projectDir,
      'assets/cutouts/c.png',
      new Uint8Array(24).fill(200),
      6,
      4
    );
    history = applyEdit(
      history,
      repointCutout(history.present, 'cut1', newRel, 'assets/cutouts/c.png')
    );

    const after = history.present.assets.find((a) => a.id === 'cut1');
    expect(after?.file).toBe('assets/cutouts/c-v2.png');
    expect(after?.metadata.automaticFile).toBe('assets/cutouts/c.png');

    history = undo(history); // one undo step
    const back = history.present.assets.find((a) => a.id === 'cut1');
    expect(back?.file).toBe('assets/cutouts/c.png');
    // …and that file still exists on disk.
    expect(readFileSync(join(projectDir, back?.file ?? '')).length).toBeGreaterThan(0);
  });
});
