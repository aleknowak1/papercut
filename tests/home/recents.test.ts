import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addRecent, loadRecents, loadUsableRecents } from '../../app/main/recents';
import { createProject } from '../../app/main/projectStore';
import type { RecentProject } from '../../app/shared/ipc';

const outputRoot = join(__dirname, '..', 'output');
mkdirSync(outputRoot, { recursive: true });

function entry(dir: string, name: string): RecentProject {
  return { dir, name, format: '9:16', lastOpenedIso: '2026-09-02T00:00:00.000Z' };
}

describe('recent projects', () => {
  it('newest first, no duplicates, capped at ten', () => {
    const dir = mkdtempSync(join(outputRoot, 'recents-'));
    const file = join(dir, 'recents.json');
    for (let i = 0; i < 12; i++) {
      addRecent(file, entry(`C:/projects/p${i}.papercut`, `P${i}`));
    }
    addRecent(file, entry('C:/projects/p5.papercut', 'P5 again'));
    const recents = loadRecents(file);
    expect(recents).toHaveLength(10);
    expect(recents[0]?.name).toBe('P5 again');
    expect(recents.filter((r) => r.dir.endsWith('p5.papercut'))).toHaveLength(1);
  });

  it('entries whose project folder is gone are not offered', () => {
    const dir = mkdtempSync(join(outputRoot, 'recents-'));
    const file = join(dir, 'recents.json');
    const realProject = createProject(dir, 'Still Here', '1:1');
    addRecent(file, entry(realProject, 'Still Here'));
    addRecent(file, entry(join(dir, 'Deleted.papercut'), 'Deleted'));
    const usable = loadUsableRecents(file);
    expect(usable).toHaveLength(1);
    expect(usable[0]?.name).toBe('Still Here');
  });

  it('a damaged recents file means an empty list, not a crash', () => {
    const dir = mkdtempSync(join(outputRoot, 'recents-'));
    const file = join(dir, 'recents.json');
    expect(loadRecents(file)).toEqual([]);
  });
});
