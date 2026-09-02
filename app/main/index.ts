import { join } from 'node:path';
import { BrowserWindow, app, session } from 'electron';
import { registerIpcHandlers } from './ipc';
import { isRequestAllowed } from './networkPolicy';

// The export check and measurement runs (scripts/check-export.mjs) start the
// app with one of these set: the window stays hidden, the UI runs the export
// on the test project, reports the result, and the app exits (ADR-015).
function exportMode(): 'export-check' | 'export-measure' | undefined {
  if (app.isPackaged) return undefined;
  if (process.env['PAPERCUT_EXPORT_CHECK'] === '1') return 'export-check';
  if (process.env['PAPERCUT_EXPORT_MEASURE'] === '1') return 'export-measure';
  return undefined;
}

function createWindow(): void {
  const mode = exportMode();
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    show: false,
    backgroundColor: '#181a1b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (mode === undefined) {
    win.once('ready-to-show', () => win.show());
  }

  // In development the page is served by Vite; in the packaged app it is a file.
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  const query = mode === undefined ? undefined : { papercutMode: mode };
  if (devUrl) {
    const url = new URL(devUrl);
    if (mode !== undefined) url.searchParams.set('papercutMode', mode);
    void win.loadURL(url.toString());
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), query ? { query } : undefined);
  }
}

app.whenReady().then(() => {
  // Block all network traffic except the approved list (empty today) and,
  // in development, the Vite server that serves the UI (ADR-015).
  const devServerOrigin = process.env['ELECTRON_RENDERER_URL'];
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isRequestAllowed(details.url, devServerOrigin);
    if (!allowed) console.warn(`Blocked unexpected network request: ${details.url}`);
    callback({ cancel: !allowed });
  });
  registerIpcHandlers();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
