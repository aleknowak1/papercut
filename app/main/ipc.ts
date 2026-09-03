// Answers the UI's requests (the PapercutApi contract in app/shared/ipc.ts).

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import type { OpenedProject, RecentProject } from '../shared/ipc';
import { IPC_CHANNELS } from '../shared/ipc';
import type { Asset, ProjectFormat } from '../shared/document/types';
import { validateProjectDocument } from '../shared/document/validate';
import type { SegmentationModel } from '../shared/segmentation/types';
import { readCutoutPixels, saveCutoutVersion } from './cutoutVersions';
import { importAudioAsset, importImageAsset, prepareImportFile, readImportAudioBytes } from './importAssets';
import type { ImportAudioInfo, ImportImageInfo } from './importAssets';
import { segmentationService } from './segmentation/service';
import {
  PROJECT_FILE,
  createProject,
  loadProject,
  resolveProjectFile,
  saveProject
} from './projectStore';
import { addRecent, loadUsableRecents } from './recents';
import { checkSnapshotFrame, finishSnapshotRun } from './snapshotCheck';

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

  // ---- Asset import and cutouts (Phase 3) ----

  ipcMain.handle(IPC_CHANNELS.chooseImportImages, async (): Promise<string[]> => {
    const win = BrowserWindow.getFocusedWindow() ?? undefined;
    const options = {
      title: 'Choose images to import',
      filters: [
        {
          name: 'Images (JPG, PNG, WebP, HEIC)',
          extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']
        }
      ],
      properties: ['openFile' as const, 'multiSelections' as const]
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle(IPC_CHANNELS.readImportFile, (_event, sourcePath: string): Promise<Uint8Array> =>
    prepareImportFile(sourcePath)
  );

  ipcMain.handle(
    IPC_CHANNELS.importImageAsset,
    (
      _event,
      projectDir: string,
      sourcePath: string,
      role: 'background' | 'character-prop',
      info: ImportImageInfo
    ): Promise<Asset> => importImageAsset(projectDir, sourcePath, role, info)
  );

  ipcMain.handle(IPC_CHANNELS.chooseImportAudio, async (): Promise<string[]> => {
    const win = BrowserWindow.getFocusedWindow() ?? undefined;
    const options = {
      title: 'Choose sounds to import',
      filters: [{ name: 'Sounds (MP3, WAV, M4A, OGG)', extensions: ['mp3', 'wav', 'm4a', 'ogg'] }],
      properties: ['openFile' as const, 'multiSelections' as const]
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle(IPC_CHANNELS.readImportAudioFile, (_event, sourcePath: string): Uint8Array =>
    readImportAudioBytes(sourcePath)
  );

  ipcMain.handle(
    IPC_CHANNELS.importAudioAsset,
    (_event, projectDir: string, sourcePath: string, info: ImportAudioInfo): Asset =>
      importAudioAsset(projectDir, sourcePath, info)
  );

  ipcMain.handle(
    IPC_CHANNELS.enqueueCutout,
    async (
      _event,
      projectDir: string,
      sourceAssetId: string,
      model: SegmentationModel,
      rgba: Uint8Array,
      width: number,
      height: number
    ): Promise<Asset> => {
      resolveProjectFile(projectDir, 'assets'); // asserts it is a project folder
      const result = await segmentationService.enqueue(sourceAssetId, model, rgba, width, height);
      const id = randomUUID();
      const relativePath = `assets/cutouts/${id}.png`;
      const fullPath = resolveProjectFile(projectDir, relativePath);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, result.cutoutPng);
      return {
        id,
        type: 'cutout',
        file: relativePath,
        metadata: { width, height, sourceAssetId, model }
      };
    }
  );

  ipcMain.handle(IPC_CHANNELS.cancelCutout, (_event, sourceAssetId: string): boolean =>
    segmentationService.cancel(sourceAssetId)
  );

  ipcMain.handle(
    IPC_CHANNELS.readCutoutPixels,
    (_event, projectDir: string, relativePath: string) =>
      readCutoutPixels(projectDir, relativePath)
  );

  ipcMain.handle(
    IPC_CHANNELS.saveCutoutVersion,
    (
      _event,
      projectDir: string,
      currentRelativePath: string,
      alpha: Uint8Array,
      width: number,
      height: number
    ): string => saveCutoutVersion(projectDir, currentRelativePath, alpha, width, height)
  );

  // Push every cutout status change to all windows (the Assets panel listens).
  segmentationService.onUpdate((update) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC_CHANNELS.cutoutUpdate, update);
    }
  });

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

    ipcMain.handle(
      IPC_CHANNELS.devCompareSnapshot,
      (_event, name: string, width: number, height: number, rgba: Uint8Array) =>
        checkSnapshotFrame(name, width, height, rgba)
    );
    ipcMain.handle(IPC_CHANNELS.devFinishSnapshots, () => finishSnapshotRun());

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
