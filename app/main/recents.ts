// The recent-projects list shown on the Home screen. Stored as a small JSON
// file in the app's own settings folder (never inside a project). Entries
// whose folder has disappeared are dropped when the list is read.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RecentProject } from '../shared/ipc';
import { PROJECT_FILE } from './projectStore';

const MAX_RECENTS = 10;

export function loadRecents(filePath: string): RecentProject[] {
  if (!existsSync(filePath)) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is RecentProject =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as RecentProject).dir === 'string' &&
        typeof (entry as RecentProject).name === 'string'
    );
  } catch {
    return []; // a damaged recents file just means an empty list
  }
}

/** Recents whose project folder still exists on disk. */
export function loadUsableRecents(filePath: string): RecentProject[] {
  return loadRecents(filePath).filter((entry) =>
    existsSync(join(entry.dir, PROJECT_FILE))
  );
}

export function addRecent(filePath: string, entry: RecentProject): void {
  const rest = loadRecents(filePath).filter((existing) => existing.dir !== entry.dir);
  const updated = [entry, ...rest].slice(0, MAX_RECENTS);
  writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf8');
}
