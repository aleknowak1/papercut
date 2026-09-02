// The gate the UI's file reads/writes pass through: every path must stay
// inside the project folder (new IPC surface added for Phase 2 export).
import { mkdirSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createProject, resolveProjectFile } from '../../app/main/projectStore';

const outputRoot = join(__dirname, '..', 'output');
mkdirSync(outputRoot, { recursive: true });

const projectDir = createProject(mkdtempSync(join(outputRoot, 'files-')), 'Guard', '16:9');

describe('resolveProjectFile', () => {
  it('resolves a normal relative path inside the project', () => {
    expect(resolveProjectFile(projectDir, 'assets/audio/beep.wav')).toBe(
      resolve(projectDir, 'assets', 'audio', 'beep.wav')
    );
  });

  it('refuses paths that lead outside the project folder', () => {
    expect(() => resolveProjectFile(projectDir, '../elsewhere.txt')).toThrow(/outside/);
    expect(() => resolveProjectFile(projectDir, 'assets/../../elsewhere.txt')).toThrow(/outside/);
  });

  it('refuses absolute paths', () => {
    expect(() => resolveProjectFile(projectDir, 'C:\\Windows\\notepad.exe')).toThrow(/relative/);
  });

  it('refuses folders that are not projects', () => {
    expect(() => resolveProjectFile(outputRoot, 'anything.txt')).toThrow(/not a PAPERCUT project/);
  });
});
