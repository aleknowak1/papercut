import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { OpenedProject } from '../../shared/ipc';
import type { ProjectDocument } from '../../shared/document/types';
import {
  applyEdit as recordEdit,
  canRedo,
  canUndo,
  createHistory,
  redo,
  undo
} from '../../shared/document/history';
import { AssetsPanel } from './assets/AssetsPanel';
import { CharactersPanel } from './assets/CharactersPanel';
import { MaskEditor } from './assets/MaskEditor';
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
  return <ProjectView key={opened.projectDir} opened={opened} onBack={() => setOpened(undefined)} />;
}

/**
 * The opened-project view. Phase 3 gives it the Assets panel and wires the
 * document through the undo/redo history (every edit is one history step;
 * the document is saved after each change). The full editor layout is
 * Phase 4.
 */
function ProjectView({
  opened,
  onBack
}: {
  opened: OpenedProject;
  onBack: () => void;
}): JSX.Element {
  const [history, setHistory] = useState(() => createHistory(opened.document));
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const [editingMaskOf, setEditingMaskOf] = useState<string | undefined>(undefined);
  const doc = history.present;
  const editingAsset = editingMaskOf !== undefined
    ? doc.assets.find((a) => a.id === editingMaskOf)
    : undefined;

  // Save whatever is current, a moment after it changes (one save per burst).
  const saveTimer = useRef<number | undefined>(undefined);
  const scheduleSave = useCallback(
    (document: ProjectDocument): void => {
      if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        window.papercut
          .saveProjectDocument(opened.projectDir, document)
          .then(() => setSaveError(undefined))
          .catch((error: unknown) =>
            setSaveError(`The project could not be saved: ${String(error)}`)
          );
      }, 250);
    },
    [opened.projectDir]
  );

  const applyEdit = useCallback(
    (edit: (current: ProjectDocument) => ProjectDocument): void => {
      setHistory((current) => {
        const next = recordEdit(current, edit(current.present));
        if (next !== current) scheduleSave(next.present);
        return next;
      });
    },
    [scheduleSave]
  );

  const doUndo = useCallback((): void => {
    setHistory((current) => {
      const next = undo(current);
      if (next !== current) scheduleSave(next.present);
      return next;
    });
  }, [scheduleSave]);

  const doRedo = useCallback((): void => {
    setHistory((current) => {
      const next = redo(current);
      if (next !== current) scheduleSave(next.present);
      return next;
    });
  }, [scheduleSave]);

  // Keyboard: Ctrl+Z undo, Ctrl+Y or Ctrl+Shift+Z redo.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        doUndo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        doRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doUndo, doRedo]);

  return (
    <div className="opened project-view">
      <div className="project-masthead">
        <h1 className="wordmark">PAPERCUT</h1>
        <span className="project-title">
          {doc.name} · {doc.format} · {doc.fps} fps
        </span>
        <span className="project-spacer" />
        <button type="button" className="btn" disabled={!canUndo(history)} onClick={doUndo}>
          Undo
        </button>
        <button type="button" className="btn" disabled={!canRedo(history)} onClick={doRedo}>
          Redo
        </button>
        <button type="button" className="btn" onClick={onBack}>
          ← Home
        </button>
      </div>
      {saveError !== undefined && <p className="error">{saveError}</p>}
      {editingAsset !== undefined ? (
        <MaskEditor
          projectDir={opened.projectDir}
          asset={editingAsset}
          applyEdit={applyEdit}
          onClose={() => setEditingMaskOf(undefined)}
        />
      ) : (
        <div className="project-columns">
          <AssetsPanel
            projectDir={opened.projectDir}
            document={doc}
            applyEdit={applyEdit}
            onEditMask={setEditingMaskOf}
          />
          <CharactersPanel projectDir={opened.projectDir} document={doc} applyEdit={applyEdit} />
        </div>
      )}
      {import.meta.env.DEV && (
        <DevProjectButtons
          opened={{ projectDir: opened.projectDir, document: doc }}
          onDocumentChanged={(updated) =>
            applyEdit(() => updated.document)
          }
        />
      )}
    </div>
  );
}
