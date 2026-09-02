import { join } from 'node:path';
import { BrowserWindow, app, session } from 'electron';
import { isRequestAllowed } from './networkPolicy';

function createWindow(): void {
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

  win.once('ready-to-show', () => win.show());

  // In development the page is served by Vite; in the packaged app it is a file.
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void win.loadURL(devUrl);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
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
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
