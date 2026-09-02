// Answers the UI's requests (the PapercutApi contract in app/shared/ipc.ts).

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import type { OpenedProject, RecentProject } from '../shared/ipc';
import { IPC_CHANNELS } from '../shared/ipc';
import type { ProjectFormat } from '../shared/document/types';
import { validateProjectDocument } from '../shared/document/validate';
import {
  PROJECT_FILE,
  createProject,
  loadProject,
  resolveProjectFile,
  saveProject
} from './projectStore';
import { addRecent, loadUsableRecents } from './recents';

function recentsFile(): string {
  return join(app.getPath('userData'), 'recents.json');
}

function rememberProject(projectDir: string, opened: OpenedProject): void {
  const entry: RecentProject = {
    dir: projectDir,
    name: opened.document.name,
    format: opened.document.format,
    lastOpenedIso: new Date().toISOString()
  };
  addRecent(recentsFile(), entry);
}

async function pickFolder(title: string): Promise<string | undefined> {
  const win = BrowserWindow.getFocusedWindow() ?? undefined;
  const options = { title, properties: ['openDirectory' as const] };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  return result.canceled ? undefined : result.filePaths[0];
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.getVersion, () => app.getVersion());

  ipcMain.handle(IPC_CHANNELS.chooseParentFolder, () =>
    pickFolder('Choose where to create the project')
  );

  ipcMain.handle(IPC_CHANNELS.chooseProjectFolder, async () => {
    const dir = await pickFolder('Choose a project folder (ends in .papercut)');
    if (dir === undefined) return undefined;
    if (!existsSync(join(dir, PROJECT_FILE))) {
      throw new Error(
        'That folder is not a PAPERCUT project: it has no project.json inside. ' +
          'Pick the folder whose name ends in .papercut.'
      );
    }
    return dir;
  });

  ipcMain.handle(
    IPC_CHANNELS.createProject,
    (_event, parentDir: string, name: string, format: ProjectFormat): OpenedProject => {
      const projectDir = createProject(parentDir, name, format);
      const opened: OpenedProject = { projectDir, document: loadProject(projectDir) };
      rememberProject(projectDir, opened);
      return opened;
    }
  );

  ipcMain.handle(IPC_CHANNELS.openProject, (_event, projectDir: string): OpenedProject => {
    const opened: OpenedProject = { projectDir, document: loadProject(projectDir) };
    rememberProject(projectDir, opened);
    return opened;
  });

  ipcMain.handle(IPC_CHANNELS.listRecents, (): RecentProject[] =>
    loadUsableRecents(recentsFile())
  );

  ipcMain.handle(
    IPC_CHANNELS.readProjectFile,
    (_event, projectDir: string, relativePath: string): Uint8Array =>
      readFileSync(resolveProjectFile(projectDir, relativePath))
  );

  ipcMain.handle(
    IPC_CHANNELS.writeProjectFile,
    (_event, projectDir: string, relativePath: string, data: Uint8Array): void => {
      if (relativePath === PROJECT_FILE) {
        // The document only changes through saveProjectDocument, which validates.
        throw new Error('project.json is saved through saveProjectDocument, not written directly.');
      }
      const full = resolveProjectFile(projectDir, relativePath);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, data);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.saveProjectDocument,
    (_event, projectDir: string, document: unknown): void => {
      resolveProjectFile(projectDir, PROJECT_FILE + '.tmp'); // asserts it is a project folder
      saveProject(projectDir, validateProjectDocument(document));
    }
  );

  // Development-only channels: the export check and dev tools use them.
  // A packaged build never registers them.
  if (!app.isPackaged) {
    ipcMain.handle(
      IPC_CHANNELS.devCreateScratchProject,
      (_event, name: string, format: ProjectFormat, where: 'temp' | 'tests-output'): OpenedProject => {
        let parentDir: string;
        if (where === 'temp') {
          parentDir = mkdtempSync(join(tmpdir(), 'papercut-export-check-'));
        } else {
          const outputRoot = join(process.cwd(), 'tests', 'output', 'export-prototype');
          mkdirSync(outputRoot, { recursive: true });
          parentDir = mkdtempSync(join(outputRoot, 'run-'));
        }
        const projectDir = createProject(parentDir, name, format);
        return { projectDir, document: loadProject(projectDir) };
      }
    );

    ipcMain.on(IPC_CHANNELS.devReportExportCheck, (_event, payloadJson: string): void => {
      // The check runner (scripts/check-export.mjs) watches stdout for this marker.
      console.log(`EXPORT-CHECK-RESULT ${payloadJson}`);
      let ok = false;
      try {
        ok = (JSON.parse(payloadJson) as { ok?: boolean }).ok === true;
      } catch {
        ok = false;
      }
      const checkMode =
        process.env['PAPERCUT_EXPORT_CHECK'] === '1' ||
        process.env['PAPERCUT_EXPORT_MEASURE'] === '1';
      if (checkMode) app.exit(ok ? 0 : 1);
    });
  }
}
