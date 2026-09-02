import { contextBridge } from 'electron';

// The renderer runs sandboxed with no Node access. Everything it may ask the
// main process to do is exposed here, one named function at a time.
const api = {};

contextBridge.exposeInMainWorld('papercut', api);

export type PapercutApi = typeof api;
