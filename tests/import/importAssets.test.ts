// Image import (Phase 3): each file round-trips unchanged into the project
// folder and the document; duplicates and unsupported files are refused in
// plain English; documents with assets still save/reopen and undo.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importImageAsset, readImportFileBytes } from '../../app/main/importAssets';
import { createProject, loadProject, saveProject } from '../../app/main/projectStore';
import { addAsset } from '../../app/shared/document/edits';
import { applyEdit, createHistory, undo } from '../../app/shared/document/history';
import { solidPng } from '../fixtures/png';
import { suiteOutputDirs } from '../helpers/testOutput';

const tempDir = suiteOutputDirs('import');

function makeSourceImage(
  dir: string,
  name: string,
  colour: [number, number, number]
): string {
  const path = join(dir, name);
  writeFileSync(path, solidPng(8, 6, [colour[0], colour[1], colour[2], 255]));
  return path;
}

describe('importImageAsset', () => {
  it('copies the file byte-for-byte and fills the asset record', async () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'Import', '9:16');
    const source = makeSourceImage(dir, 'holiday photo.png', [10, 20, 30]);

    const asset = await importImageAsset(projectDir, source, 'character-prop', {
      width: 8,
      height: 6,
      existingHashes: []
    });

    expect(asset.type).toBe('image');
    expect(asset.file.startsWith('assets/images/')).toBe(true);
    expect(asset.metadata.originalFileName).toBe('holiday photo.png');
    expect(asset.metadata.role).toBe('character-prop');
    expect(asset.metadata.width).toBe(8);
    expect(asset.metadata.contentHash).toMatch(/^[0-9a-f]{64}$/);
    const copied = readFileSync(join(projectDir, asset.file));
    expect(copied.equals(readFileSync(source))).toBe(true); // unchanged, byte for byte
  });

  it('refuses a duplicate (same bytes) in plain English', async () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'Dupes', '9:16');
    const source = makeSourceImage(dir, 'twice.png', [1, 2, 3]);
    const first = await importImageAsset(projectDir, source, 'background', {
      width: 8,
      height: 6,
      existingHashes: []
    });
    await expect(
      importImageAsset(projectDir, source, 'background', {
        width: 8,
        height: 6,
        existingHashes: [first.metadata.contentHash ?? '']
      })
    ).rejects.toThrow(/already in this project/);
  });

  it('refuses unsupported and unreadable files in plain English', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'notes.txt'), 'not an image');
    expect(() => readImportFileBytes(join(dir, 'notes.txt'))).toThrow(/not a supported image type/);
    expect(() => readImportFileBytes(join(dir, 'gone.png'))).toThrow(/could not be read/);
  });

  it('normalises .jpeg to .jpg in the stored name', async () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'Ext', '9:16');
    // Content type does not matter for the copy; extension drives the name.
    const source = join(dir, 'photo.jpeg');
    writeFileSync(source, solidPng(4, 4, [9, 9, 9, 255]));
    const asset = await importImageAsset(projectDir, source, 'background', {
      width: 4,
      height: 4,
      existingHashes: []
    });
    expect(asset.file.endsWith('.jpg')).toBe(true);
  });
});

describe('the document with assets', () => {
  it('saves, reopens field-for-field, and undoes an import', async () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'Assets Doc', '16:9');
    const source = makeSourceImage(dir, 'bg.png', [40, 50, 60]);
    const asset = await importImageAsset(projectDir, source, 'background', {
      width: 8,
      height: 6,
      existingHashes: []
    });

    const original = loadProject(projectDir);
    let history = createHistory(original);
    history = applyEdit(history, addAsset(history.present, asset));
    saveProject(projectDir, history.present);

    const reopened = loadProject(projectDir);
    expect(reopened).toEqual(history.present); // field for field, with the asset

    history = undo(history);
    expect(history.present).toEqual(original); // the import is one undo step
  });
});
