import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Start-up diagnostics (CL-0022): report milestones to logs/startup.log via
// the main process, and if anything goes wrong before the screen is drawn,
// show the error as plain text — never a blank page. window.papercut can
// itself be missing (a broken preload is one of the failures being hunted),
// so every use is guarded.

function log(message: string): void {
  try {
    window.papercut.logStartup(message);
  } catch {
    console.error('startup log unavailable:', message);
  }
}

/** Shows an error as text if nothing has been drawn yet (never a blank page). */
function showIfBlank(detail: string): void {
  const root = document.getElementById('root');
  if (root !== null && root.childElementCount > 0) return; // a screen is already up
  document.body.textContent = '';
  const pre = document.createElement('pre');
  pre.style.cssText =
    'color:#ddd;background:#181a1b;margin:0;padding:24px;white-space:pre-wrap;' +
    'font-family:Consolas,monospace;font-size:13px;min-height:100vh;box-sizing:border-box';
  pre.textContent =
    'PAPERCUT hit an error before it could draw its screen.\n\n' +
    detail +
    '\n\nClose this window and start the app again with: npm run dev\n' +
    'If this keeps happening, tell Claude Code what this text says.';
  document.body.appendChild(pre);
}

window.addEventListener('error', (event) => {
  const where = event.filename ? ` at ${event.filename}:${event.lineno}` : '';
  log(`RENDERER ERROR: ${event.message}${where}`);
  showIfBlank(String(event.error instanceof Error ? event.error.stack : event.message));
});
window.addEventListener('unhandledrejection', (event) => {
  log(`RENDERER UNHANDLED REJECTION: ${String(event.reason)}`);
  showIfBlank(String(event.reason instanceof Error ? event.reason.stack : event.reason));
});

log('renderer script start');

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('index.html is missing the #root element');

  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  log('React root.render called');
  // Two animation frames = the browser has actually painted something.
  requestAnimationFrame(() => requestAnimationFrame(() => log('first frame drawn')));
} catch (error) {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  log(`RENDERER MOUNT FAILED: ${detail}`);
  showIfBlank(detail);
}
