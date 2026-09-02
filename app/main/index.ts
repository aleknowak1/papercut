import { join } from 'node:path';
import { BrowserWindow, app, net, session } from 'electron';
import { registerIpcHandlers } from './ipc';
import { isRequestAllowed } from './networkPolicy';
import { installStartupDiagnostics, logStartup } from './startupLog';

// Development only: lets Claude Code drive the real app for live testing
// (the DevTools protocol on a local port). Off unless the env var is set;
// impossible in packaged builds.
const debugPort = process.env['PAPERCUT_REMOTE_DEBUG_PORT'];
if (debugPort !== undefined && !app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', debugPort);
}

// The export check and measurement runs (scripts/check-export.mjs) start the
// app with one of these set: the window stays hidden, the UI runs the export
// on the test project, reports the result, and the app exits (ADR-015).
function exportMode(): 'export-check' | 'export-measure' | undefined {
  if (app.isPackaged) return undefined;
  if (process.env['PAPERCUT_EXPORT_CHECK'] === '1') return 'export-check';
  if (process.env['PAPERCUT_EXPORT_MEASURE'] === '1') return 'export-measure';
  return undefined;
}

// ---- Reliable start-up (CL-0021) ----
//
// The screen used to be loaded exactly once, with no wait and no retry. If
// the development server was not answering yet at that instant, the window
// stayed dark forever. Now: wait for the server, retry a failed load, and
// if loading still fails, show a plain-text explanation — never a blank
// window.

const sleep = (millis: number): Promise<void> => new Promise((r) => setTimeout(r, millis));

/** Waits (up to ~15 s) until the dev server answers HTTP at all. */
async function waitForDevServer(url: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await net.fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (response.status > 0) {
        logStartup('main', `dev server reachable at ${url} (attempt ${attempt + 1}, status ${response.status})`);
        return;
      }
    } catch {
      // Not answering yet; keep waiting.
    }
    await sleep(250);
  }
  logStartup('main', `dev server at ${url} did not answer within 15 s; loading anyway (retries will follow)`);
}

/** Replaces a window that could not load with a readable explanation. */
function showLoadFailure(win: BrowserWindow, target: string, description: string): void {
  const text =
    'PAPERCUT could not load its screen.\n\n' +
    `Tried to load: ${target}\n` +
    `Last error:    ${description}\n\n` +
    'Close this window and start the app again with: npm run dev\n' +
    'If this keeps happening, tell Claude Code about this message in the next session.';
  void win.loadURL('data:text/plain;charset=utf-8,' + encodeURIComponent(text));
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

  logStartup('main', `window created (mode: ${mode ?? 'normal'})`);

  if (mode === undefined) {
    win.once('ready-to-show', () => {
      logStartup('main', 'ready-to-show; showing window');
      win.show();
    });
    // Belt and braces: whatever happens, never leave an invisible window.
    setTimeout(() => {
      if (!win.isDestroyed() && !win.isVisible()) {
        logStartup('main', 'window still hidden after 15 s; showing it anyway');
        win.show();
      }
    }, 15_000);
  }

  win.webContents.on('did-start-loading', () => logStartup('main', 'page load started'));
  win.webContents.on('dom-ready', () => logStartup('main', 'dom-ready'));
  win.webContents.on('did-finish-load', () => logStartup('main', 'did-finish-load'));
  win.webContents.on('unresponsive', () => logStartup('main', 'PAGE UNRESPONSIVE'));
  win.webContents.on('responsive', () => logStartup('main', 'page responsive again'));

  // In development the page is served by Vite; in the packaged app it is a file.
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  const loadApp = async (): Promise<void> => {
    if (devUrl) {
      const url = new URL(devUrl);
      if (mode !== undefined) url.searchParams.set('papercutMode', mode);
      await win.loadURL(url.toString());
    } else {
      const query = mode === undefined ? undefined : { papercutMode: mode };
      await win.loadFile(join(__dirname, '../renderer/index.html'), query ? { query } : undefined);
    }
  };

  // Retry failed loads for up to ~20 s before giving up visibly.
  const MAX_RETRIES = 40;
  let retries = 0;
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || win.isDestroyed()) return;
    // -3 (ERR_ABORTED) means a newer load replaced this one — not a failure.
    if (errorCode === -3) return;
    if (retries < MAX_RETRIES) {
      retries++;
      logStartup(
        'main',
        `did-fail-load (${errorDescription}, code ${errorCode}); retrying (${retries}/${MAX_RETRIES})`
      );
      setTimeout(() => {
        if (!win.isDestroyed()) loadApp().catch(() => {});
      }, 500);
    } else {
      logStartup('main', `did-fail-load ${MAX_RETRIES} times; last error ${errorDescription}; showing failure page`);
      showLoadFailure(win, validatedURL || devUrl || 'the app files', errorDescription);
    }
  });

  void (async () => {
    if (devUrl) await waitForDevServer(devUrl);
    if (!win.isDestroyed()) await loadApp().catch(() => {}); // failures land in did-fail-load
  })();
}

installStartupDiagnostics();

app.whenReady().then(() => {
  logStartup('main', 'app ready');
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
