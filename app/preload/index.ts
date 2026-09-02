// The bridge between the sandboxed UI and the main process. The renderer
// has no Node access; everything it may ask for is this named list of
// functions, exposed as window.papercut.

import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { PapercutApi } from '../shared/ipc';
import { IPC_CHANNELS } from '../shared/ipc';
import type { SegmentationJobUpdate } from '../shared/segmentation/types';

const api: PapercutApi = {
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.getVersion),
  chooseParentFolder: () => ipcRenderer.invoke(IPC_CHANNELS.chooseParentFolder),
  chooseProjectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.chooseProjectFolder),
  createProject: (parentDir, name, format) =>
    ipcRenderer.invoke(IPC_CHANNELS.createProject, parentDir, name, format),
  openProject: (projectDir) => ipcRenderer.invoke(IPC_CHANNELS.openProject, projectDir),
  listRecents: () => ipcRenderer.invoke(IPC_CHANNELS.listRecents),
  readProjectFile: (projectDir, relativePath) =>
    ipcRenderer.invoke(IPC_CHANNELS.readProjectFile, projectDir, relativePath),
  writeProjectFile: (projectDir, relativePath, data) =>
    ipcRenderer.invoke(IPC_CHANNELS.writeProjectFile, projectDir, relativePath, data),
  saveProjectDocument: (projectDir, document) =>
    ipcRenderer.invoke(IPC_CHANNELS.saveProjectDocument, projectDir, document),
  chooseImportImages: () => ipcRenderer.invoke(IPC_CHANNELS.chooseImportImages),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  readImportFile: (sourcePath) => ipcRenderer.invoke(IPC_CHANNELS.readImportFile, sourcePath),
  importImageAsset: (projectDir, sourcePath, role, info) =>
    ipcRenderer.invoke(IPC_CHANNELS.importImageAsset, projectDir, sourcePath, role, info),
  enqueueCutout: (projectDir, sourceAssetId, model, rgba, width, height) =>
    ipcRenderer.invoke(IPC_CHANNELS.enqueueCutout, projectDir, sourceAssetId, model, rgba, width, height),
  cancelCutout: (sourceAssetId) => ipcRenderer.invoke(IPC_CHANNELS.cancelCutout, sourceAssetId),
  onCutoutUpdate: (listener) => {
    const handler = (_event: unknown, update: SegmentationJobUpdate): void => listener(update);
    ipcRenderer.on(IPC_CHANNELS.cutoutUpdate, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.cutoutUpdate, handler);
  },
  devCreateScratchProject: (name, format, where) =>
    ipcRenderer.invoke(IPC_CHANNELS.devCreateScratchProject, name, format, where),
  devReportExportCheck: (payloadJson) =>
    ipcRenderer.send(IPC_CHANNELS.devReportExportCheck, payloadJson),
  logStartup: (message) => ipcRenderer.send(IPC_CHANNELS.startupLog, 'renderer', message)
};

contextBridge.exposeInMainWorld('papercut', api);
ipcRenderer.send(IPC_CHANNELS.startupLog, 'preload', 'preload ran; window.papercut exposed');
