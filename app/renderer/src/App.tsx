import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { OpenedProject } from '../../shared/ipc';
import type { ProjectDocument } from '../../shared/document/types';
import { removeAudioClip, removeLayer, setKeyframe } from '../../shared/document/edits';
import { addSoundToTimeline } from '../../shared/timeline/addToTimeline';
import { keyframeAtPlayhead } from '../../shared/animation/keyframes';
import { snapToFrame } from '../../shared/animation/time';
import {
  applyEdit as recordEdit,
  canRedo,
  canUndo,
  createHistory,
  redo,
  undo
} from '../../shared/document/history';
import { AssetsPanel } from './assets/AssetsPanel';
import { CameraPanel } from './scene/CameraPanel';
import { CharactersPanel } from './assets/CharactersPanel';
import { MaskEditor } from './assets/MaskEditor';
import { HomeScreen } from './HomeScreen';
import { LayersPanel } from './scene/LayersPanel';
import { SceneCanvas } from './scene/SceneCanvas';
import { SceneToolbar } from './scene/SceneToolbar';
import { ClipPanel } from './timeline/ClipPanel';
import { Timeline } from './timeline/Timeline';

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
 * The opened-project view (the editor): Assets/Characters tabs on the
 * left, the scene canvas in the middle, the Layers panel on the right.
 * The document runs through the undo/redo history (every edit is one
 * history step; the document is saved after each change).
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
  const [leftTab, setLeftTab] = useState<'assets' | 'characters'>('assets');
  // Selection is UI state only — never saved, never an undo step. A layer
  // and a sound clip are never selected at once: the right panel shows
  // the one that is.
  const [selectedLayerId, setSelectedLayerId] = useState<string | undefined>(undefined);
  const [selectedClipId, setSelectedClipId] = useState<string | undefined>(undefined);
  const [opacityPreview, setOpacityPreview] = useState<number | undefined>(undefined);
  // The playhead (seconds, frame-snapped) — UI state like selection: the
  // canvas draws the scene at this time and every edit writes the keyframe
  // at it (shared/animation/keyframes.ts).
  const [playhead, setPlayhead] = useState(0);
  // Armed by the Motion panel's "Pick on canvas" (Walk's destination): the
  // next canvas click is reported here instead of selecting anything.
  // UI state like selection; Escape disarms it.
  const [canvasPick, setCanvasPick] = useState<
    { readonly onPick: (point: { x: number; y: number }) => void } | undefined
  >(undefined);
  // Camera mode (M-4.6): the canvas pans/zooms the camera and the right
  // panel shows the camera inspector. UI state like selection; Escape or
  // the toolbar button leaves it.
  const [cameraMode, setCameraMode] = useState(false);
  const [cameraPreview, setCameraPreview] = useState<
    { x: number; y: number; zoom: number } | undefined
  >(undefined);
  const doc = history.present;
  const editingAsset = editingMaskOf !== undefined
    ? doc.assets.find((a) => a.id === editingMaskOf)
    : undefined;
  // The editor shows the first scene until multiple scenes arrive (Phase 7).
  const scene = doc.scenes[0];
  // A selection whose layer or clip was removed (or undone away) simply ends.
  const selectedLayer =
    selectedLayerId !== undefined
      ? scene?.layers.find((l) => l.id === selectedLayerId)
      : undefined;
  const effectiveSelection = selectedLayer?.id;
  const selectedClip =
    selectedClipId !== undefined
      ? scene?.audioClips.find((c) => c.id === selectedClipId)
      : undefined;

  // Selecting a layer ends any clip selection and vice versa.
  const selectLayer = useCallback((layerId: string | undefined): void => {
    setSelectedLayerId(layerId);
    if (layerId !== undefined) setSelectedClipId(undefined);
  }, []);
  const selectClip = useCallback((clipId: string | undefined): void => {
    setSelectedClipId(clipId);
    if (clipId !== undefined) {
      setSelectedLayerId(undefined);
      setCameraMode(false);
      setCameraPreview(undefined);
    }
  }, []);

  // When a scene gets shorter, the playhead stays inside it.
  const sceneDuration = scene?.durationSeconds ?? 0;
  useEffect(() => {
    setPlayhead((current) =>
      current > sceneDuration ? snapToFrame(sceneDuration, doc.fps) : current
    );
  }, [sceneDuration, doc.fps]);

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

  const applyEdit = useCallback((edit: (current: ProjectDocument) => ProjectDocument): void => {
    setHistory((current) => recordEdit(current, edit(current.present)));
  }, []);

  const doUndo = useCallback((): void => {
    setHistory(undo);
  }, []);

  const doRedo = useCallback((): void => {
    setHistory(redo);
  }, []);

  // Saving happens HERE, from the committed document — never inside a
  // state updater. (React's StrictMode runs updaters twice in
  // development; an updater that minted a fresh id and saved as a side
  // effect could briefly write the discarded twin's ids to disk. Caught
  // by the Phase 6 final live sweep.)
  const lastScheduled = useRef(history.present);
  useEffect(() => {
    if (history.present === lastScheduled.current) return;
    lastScheduled.current = history.present;
    scheduleSave(history.present);
  }, [history.present, scheduleSave]);

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

  // Keyboard for the selected layer: arrows nudge by 1 reference pixel
  // (Shift = 10), Delete removes the layer, Escape deselects. Each press
  // is one plain undo step. Typing fields are left alone.
  useEffect(() => {
    if (editingMaskOf !== undefined) return; // the mask editor owns the keys
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.key === 'Escape' && canvasPick !== undefined) {
        setCanvasPick(undefined);
        return;
      }
      if (event.key === 'Escape' && cameraMode) {
        setCameraMode(false);
        setCameraPreview(undefined);
        return;
      }
      // A selected sound clip: Escape deselects, Delete removes the clip.
      if (selectedClip !== undefined && scene !== undefined) {
        if (event.key === 'Escape') {
          setSelectedClipId(undefined);
          return;
        }
        if (event.key === 'Delete') {
          event.preventDefault();
          const clipId = selectedClip.id;
          const sceneId = scene.id;
          setSelectedClipId(undefined);
          applyEdit((current) => removeAudioClip(current, sceneId, clipId));
          return;
        }
      }
      const layer = selectedLayer;
      const currentScene = scene;
      if (layer === undefined || currentScene === undefined) return;
      if (event.key === 'Escape') {
        setSelectedLayerId(undefined);
        return;
      }
      if (event.key === 'Delete') {
        event.preventDefault();
        setSelectedLayerId(undefined);
        applyEdit((current) => removeLayer(current, currentScene.id, layer.id));
        return;
      }
      const step = event.shiftKey ? 10 : 1;
      const nudge: Record<string, readonly [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step]
      };
      const delta = nudge[event.key];
      if (delta === undefined) return;
      const zero = keyframeAtPlayhead(layer, playhead);
      if (zero === undefined) return;
      event.preventDefault();
      applyEdit((current) =>
        setKeyframe(current, currentScene.id, layer.id, {
          ...zero,
          x: zero.x + delta[0],
          y: zero.y + delta[1]
        })
      );
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingMaskOf, selectedLayer, selectedClip, scene, playhead, applyEdit, canvasPick, cameraMode]);

  const toggleCameraMode = useCallback((): void => {
    setCameraMode((was) => {
      if (!was) {
        setSelectedLayerId(undefined); // the camera has the canvas now
        setSelectedClipId(undefined);
      }
      return !was;
    });
    setCameraPreview(undefined);
    setCanvasPick(undefined);
  }, []);

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
        <div className="project-columns editor-columns">
          <div className="left-column">
            <div className="tab-row" role="tablist">
              <button
                type="button"
                className="btn tab-btn"
                role="tab"
                aria-selected={leftTab === 'assets'}
                onClick={() => setLeftTab('assets')}
              >
                Assets
              </button>
              <button
                type="button"
                className="btn tab-btn"
                role="tab"
                aria-selected={leftTab === 'characters'}
                onClick={() => setLeftTab('characters')}
              >
                Characters
              </button>
            </div>
            {leftTab === 'assets' ? (
              <AssetsPanel
                projectDir={opened.projectDir}
                document={doc}
                scene={scene}
                applyEdit={applyEdit}
                onEditMask={setEditingMaskOf}
                onLayerAdded={selectLayer}
                onAddSoundToTimeline={
                  scene === undefined
                    ? undefined
                    : (assetId) => {
                        // The clip lands at the playhead (decision h) and
                        // is selected so its numbers are right there.
                        const sceneId = scene.id;
                        let clipId: string | undefined;
                        applyEdit((current) => {
                          const added = addSoundToTimeline(current, sceneId, assetId, playhead);
                          clipId = added?.clipId;
                          return added?.doc ?? current;
                        });
                        if (clipId !== undefined) selectClip(clipId);
                      }
                }
              />
            ) : (
              <CharactersPanel
                projectDir={opened.projectDir}
                document={doc}
                scene={scene}
                applyEdit={applyEdit}
                onLayerAdded={selectLayer}
              />
            )}
          </div>
          {scene !== undefined && (
            <div className="canvas-column">
              <SceneToolbar
                document={doc}
                scene={scene}
                applyEdit={applyEdit}
                cameraMode={cameraMode}
                onToggleCameraMode={toggleCameraMode}
              />
              <SceneCanvas
                projectDir={opened.projectDir}
                document={doc}
                scene={scene}
                selectedLayerId={effectiveSelection}
                time={playhead}
                opacityPreview={opacityPreview}
                applyEdit={applyEdit}
                onSelect={selectLayer}
                cameraMode={cameraMode}
                cameraPreview={cameraPreview}
                onPickPoint={
                  canvasPick === undefined
                    ? undefined
                    : (point) => {
                        canvasPick.onPick(point);
                        setCanvasPick(undefined);
                      }
                }
              />
              <Timeline
                projectDir={opened.projectDir}
                document={doc}
                scene={scene}
                selectedLayerId={effectiveSelection}
                cameraMode={cameraMode}
                playhead={playhead}
                onPlayhead={setPlayhead}
                applyEdit={applyEdit}
                onSelectLayer={(layerId) => {
                  // A layer diamond takes the canvas back from the camera.
                  setCameraMode(false);
                  setCameraPreview(undefined);
                  setCanvasPick(undefined);
                  selectLayer(layerId);
                }}
                onEnterCameraMode={() => {
                  if (!cameraMode) toggleCameraMode();
                }}
                selectedClipId={selectedClip?.id}
                onSelectClip={selectClip}
              />
            </div>
          )}
          {scene !== undefined &&
            (cameraMode ? (
              <CameraPanel
                document={doc}
                scene={scene}
                playhead={playhead}
                applyEdit={applyEdit}
                onCameraPreview={setCameraPreview}
                onClose={toggleCameraMode}
              />
            ) : selectedClip !== undefined ? (
              <ClipPanel
                document={doc}
                scene={scene}
                clip={selectedClip}
                applyEdit={applyEdit}
                onClose={() => setSelectedClipId(undefined)}
              />
            ) : (
              <LayersPanel
                document={doc}
                scene={scene}
                applyEdit={applyEdit}
                selectedLayerId={effectiveSelection}
                playhead={playhead}
                onSelect={selectLayer}
                onOpacityPreview={setOpacityPreview}
                requestCanvasPick={(onPick) => setCanvasPick({ onPick })}
                canvasPicking={canvasPick !== undefined}
              />
            ))}
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
