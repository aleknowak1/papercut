import { useEffect, useState, type JSX } from 'react';
import type { OpenedProject } from '../../shared/ipc';
import { HomeScreen } from './HomeScreen';

// Everything under app/renderer/src/dev/ (and tests/fixtures) is loaded
// through dynamic imports inside `import.meta.env.DEV` branches. In a
// production build DEV is false, the branches are dead code, and none of
// it is bundled or shipped.

/** Hidden-window screen used by scripts/check-export.mjs (dev only). */
function DevExportRunScreen({ mode }: { mode: 'export-check' | 'export-measure' }): JSX.Element {
  const [status, setStatus] = useState('Starting…');
  useEffect(() => {
    // Retry the module load a few times, then report the failure so the
    // check fails fast with the reason — it must never hang silently.
    let cancelled = false;
    void (async () => {
      let lastError: unknown;
      for (let attempt = 1; attempt <= 5 && !cancelled; attempt++) {
        try {
          const runner = await import('./dev/checkRunner');
          await runner.run(mode, setStatus);
          return;
        } catch (error) {
          lastError = error;
          window.papercut.logStartup(`check runner load/run attempt ${attempt} failed: ${String(error)}`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      window.papercut.devReportExportCheck(
        JSON.stringify({ ok: false, kind: mode, error: `could not load/run the check runner: ${String(lastError)}` })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);
  return (
    <div className="opened">
      <h1 className="wordmark">PAPERCUT</h1>
      <p>
        Export {mode === 'export-check' ? 'check' : 'measurement'} running: {status}
      </p>
    </div>
  );
}

/** Dev-only buttons on the opened-project view (the real export UI is Phase 9). */
function DevProjectButtons({
  opened,
  onDocumentChanged
}: {
  opened: OpenedProject;
  onDocumentChanged: (opened: OpenedProject) => void;
}): JSX.Element {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const runTool = (tool: (dev: typeof import('./dev/devTools')) => Promise<string>): void => {
    setBusy(true);
    setStatus('Working…');
    void import('./dev/devTools')
      .then(tool)
      .then(setStatus)
      .catch((error: unknown) => {
        // A dev server started before the last code update cannot load the
        // newly added modules; the fix is a restart, so say that plainly.
        const text = String(error);
        setStatus(
          text.includes('Failed to fetch dynamically imported module')
            ? 'The running app is older than the code. Close it, then start it again ' +
                'with npm run dev, and retry. (' + text + ')'
            : text
        );
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="dev-tools">
      <p className="opened-note">Development tools (never in the real app):</p>
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={() =>
          runTool(async (dev) => {
            const updated = await dev.loadTestContent(opened);
            onDocumentChanged(updated);
            return 'Ten-second test content loaded into this project and saved.';
          })
        }
      >
        Load test content (dev)
      </button>{' '}
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={() =>
          runTool((dev) =>
            dev.exportOpenProject(opened, (done, total) =>
              setStatus(`Exporting frame ${done} of ${total}…`)
            )
          )
        }
      >
        Export prototype (dev)
      </button>
      {status !== undefined && <p className="opened-note">{status}</p>}
    </div>
  );
}

export function App(): JSX.Element {
  const [opened, setOpened] = useState<OpenedProject | undefined>(undefined);

  useEffect(() => {
    try {
      window.papercut.logStartup('React mounted; App component on screen');
    } catch {
      // Diagnostics only; never let logging break the app.
    }
  }, []);

  if (import.meta.env.DEV) {
    const mode = new URLSearchParams(window.location.search).get('papercutMode');
    if (mode === 'export-check' || mode === 'export-measure') {
      return <DevExportRunScreen mode={mode} />;
    }
  }

  if (opened === undefined) {
    return <HomeScreen onProjectOpened={setOpened} />;
  }

  // The editor arrives in later phases; for now, opening a project shows
  // what was loaded so creating and reopening can be tried end to end.
  const doc = opened.document;
  return (
    <div className="opened">
      <h1 className="wordmark">PAPERCUT</h1>
      <dl>
        <dt>Project</dt>
        <dd>{doc.name}</dd>
        <dt>Format</dt>
        <dd>{doc.format}</dd>
        <dt>Frame rate</dt>
        <dd>{doc.fps} fps</dd>
        <dt>Scenes</dt>
        <dd>{doc.scenes.length}</dd>
        <dt>Folder</dt>
        <dd>{opened.projectDir}</dd>
      </dl>
      <p className="opened-note">
        The editor is built in the next phases. This page confirms the project
        opened correctly from its folder.
      </p>
      {import.meta.env.DEV && <DevProjectButtons opened={opened} onDocumentChanged={setOpened} />}
      <button type="button" className="btn" onClick={() => setOpened(undefined)}>
        ← Back to Home
      </button>
    </div>
  );
}
