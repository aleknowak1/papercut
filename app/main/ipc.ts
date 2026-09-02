// Answers the UI's requests (the PapercutApi contract in app/shared/ipc.ts).

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import type { OpenedProject, RecentProject } from '../shared/ipc';
import { IPC_CHANNELS } from '../shared/ipc';
import type { ProjectFormat } from '../shared/document/types';
import { PROJECT_FILE, createProject, loadProject } from './projectStore';
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
}
