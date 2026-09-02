// Creating, saving, and loading project folders (DOC-03 §2):
//
//   MyVideo.papercut/
//     project.json          ← the Project Document
//     assets/images|cutouts|audio/
//     cache/                ← thumbnails etc.; safe to delete
//
// Runs in the Electron main process (and in tests under plain Node).

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { newProject } from '../shared/document/create';
import type { ProjectDocument, ProjectFormat } from '../shared/document/types';
import { validateProjectDocument } from '../shared/document/validate';

export const PROJECT_FOLDER_SUFFIX = '.papercut';
export const PROJECT_FILE = 'project.json';

export const ASSET_SUBFOLDERS = [
  'assets/images',
  'assets/cutouts',
  'assets/audio',
  'cache'
] as const;

/** Turns a project name into a safe Windows folder name. */
export function folderNameForProject(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/[. ]+$/g, '')
    .trim();
  if (cleaned === '') {
    throw new Error('The project name needs at least one usable character.');
  }
  return cleaned + PROJECT_FOLDER_SUFFIX;
}

/**
 * Creates "<name>.papercut" inside parentDir with the DOC-03 §2 layout and a
 * fresh document saved to project.json. Fails if the folder already exists.
 * Returns the full path of the new project folder.
 */
export function createProject(parentDir: string, name: string, format: ProjectFormat): string {
  const projectDir = join(parentDir, folderNameForProject(name));
  mkdirSync(projectDir); // throws EEXIST if it already exists — never overwrite
  for (const sub of ASSET_SUBFOLDERS) {
    mkdirSync(join(projectDir, sub), { recursive: true });
  }
  saveProject(projectDir, newProject(name, format));
  return projectDir;
}

/**
 * Saves atomically: the document is written to a temporary file first and
 * then swapped into place, so a crash mid-save can never leave a half-written
 * project.json behind.
 */
export function saveProject(projectDir: string, doc: ProjectDocument): void {
  const finalPath = join(projectDir, PROJECT_FILE);
  const tempPath = finalPath + '.tmp';
  writeFileSync(tempPath, JSON.stringify(doc, null, 2), 'utf8');
  renameSync(tempPath, finalPath); // atomic replace, also on Windows
}

/** Loads and validates project.json from a project folder. */
export function loadProject(projectDir: string): ProjectDocument {
  const raw = readFileSync(join(projectDir, PROJECT_FILE), 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('project.json is not readable as JSON. The file may be damaged.');
  }
  return validateProjectDocument(parsed);
}
