// Start-up diagnostics (CL-0022): every step of getting from "process
// started" to "first screen drawn" is written, timestamped, to
// logs/startup.log in the app's user-data folder — plus every way the app
// can die quietly (a crashed renderer, a gone GPU process, an unresponsive
// page, an uncaught error). When a start goes wrong, this file says where.
//
// The line format is a pure function so a test can pin it down.

import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';
import { formatStartupLine } from './logLine';

let logDir: string | undefined;

function logFile(): string {
  if (logDir === undefined) {
    logDir = join(app.getPath('userData'), 'logs');
    mkdirSync(logDir, { recursive: true });
  }
  return join(logDir, 'startup.log');
}

/** Appends one timestamped line; never throws (diagnostics must not break the app). */
export function logStartup(source: 'main' | 'preload' | 'renderer', message: string): void {
  try {
    appendFileSync(logFile(), formatStartupLine(new Date().toISOString(), source, message), 'utf8');
  } catch {
    // Nothing sensible to do; the console still gets it below.
  }
  console.log(`[startup:${source}] ${message}`);
}

/** Hooks every quiet-death signal Electron offers, plus the renderer's log channel. */
export function installStartupDiagnostics(): void {
  logStartup(
    'main',
    `main process start — papercut ${app.getVersion()}, electron ${process.versions.electron}, ` +
      `chrome ${process.versions.chrome}, pid ${process.pid}, packaged ${app.isPackaged}`
  );

  process.on('uncaughtException', (error) => {
    logStartup('main', `UNCAUGHT EXCEPTION: ${error.stack ?? error.message}`);
  });
  process.on('unhandledRejection', (reason) => {
    logStartup('main', `UNHANDLED REJECTION: ${String(reason)}`);
  });

  app.on('render-process-gone', (_event, _webContents, details) => {
    logStartup('main', `RENDER PROCESS GONE: reason ${details.reason}, exit code ${details.exitCode}`);
  });
  app.on('child-process-gone', (_event, details) => {
    logStartup(
      'main',
      `CHILD PROCESS GONE: type ${details.type}${details.name ? ` (${details.name})` : ''}, ` +
        `reason ${details.reason}, exit code ${details.exitCode}`
    );
  });

  // The preload and the page report their own milestones through this channel.
  ipcMain.on(IPC_CHANNELS.startupLog, (_event, source: unknown, message: unknown) => {
    const from = source === 'preload' ? 'preload' : 'renderer';
    logStartup(from, String(message).slice(0, 2000));
  });
}
