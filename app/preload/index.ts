// The bridge between the sandboxed UI and the main process. The renderer
// has no Node access; everything it may ask for is this named list of
// functions, exposed as window.papercut.

import { contextBridge, ipcRenderer } from 'electron';
import type { PapercutApi } from '../shared/ipc';
import { IPC_CHANNELS } from '../shared/ipc';

const api: PapercutApi = {
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.getVersion),
  chooseParentFolder: () => ipcRenderer.invoke(IPC_CHANNELS.chooseParentFolder),
  chooseProjectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.chooseProjectFolder),
  createProject: (parentDir, name, format) =>
    ipcRenderer.invoke(IPC_CHANNELS.createProject, parentDir, name, format),
  openProject: (projectDir) => ipcRenderer.invoke(IPC_CHANNELS.openProject, projectDir),
  listRecents: () => ipcRenderer.invoke(IPC_CHANNELS.listRecents)
};

contextBridge.exposeInMainWorld('papercut', api);
