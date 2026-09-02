// ADR-015 check "Save / reopen": a project saved and reopened is identical,
// field for field.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createProject,
  folderNameForProject,
  loadProject,
  saveProject
} from '../../app/main/projectStore';
import { sampleProject } from '../helpers/sampleProject';

const outputRoot = join(__dirname, '..', 'output');
mkdirSync(outputRoot, { recursive: true });

function tempDir(): string {
  return mkdtempSync(join(outputRoot, 'save-'));
}

describe('save / reopen', () => {
  it('a created project reopens identical to a fresh document', () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'My First Video', '9:16');
    const loaded = loadProject(projectDir);
    expect(loaded.name).toBe('My First Video');
    expect(loaded.format).toBe('9:16');
    expect(loaded.scenes).toHaveLength(1);
  });

  it('a full sample project survives save and reopen field for field', () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'Sample', '9:16');
    const doc = sampleProject();
    saveProject(projectDir, doc);
    const loaded = loadProject(projectDir);
    expect(loaded).toEqual(doc);
  });

  it('creates the DOC-03 §2 folder layout', () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'Layout', '16:9');
    for (const sub of ['assets/images', 'assets/cutouts', 'assets/audio', 'cache']) {
      expect(existsSync(join(projectDir, sub)), `${sub} should exist`).toBe(true);
    }
  });

  it('refuses to create a project over an existing folder', () => {
    const dir = tempDir();
    createProject(dir, 'Twice', '1:1');
    expect(() => createProject(dir, 'Twice', '1:1')).toThrow();
  });

  it('strips characters Windows folders cannot contain', () => {
    expect(folderNameForProject('What? A "video": part 2')).toBe('What A video part 2.papercut');
  });

  it('rejects a damaged project.json with a plain-language error', () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'Damaged', '9:16');
    writeFileSync(join(projectDir, 'project.json'), '{ not json', 'utf8');
    expect(() => loadProject(projectDir)).toThrow(/not readable/);
  });

  it('rejects a project.json with a missing field, naming the field', () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'BadField', '9:16');
    const raw = JSON.parse(readFileSync(join(projectDir, 'project.json'), 'utf8'));
    delete raw.scenes;
    writeFileSync(join(projectDir, 'project.json'), JSON.stringify(raw), 'utf8');
    expect(() => loadProject(projectDir)).toThrow(/scenes/);
  });
});
