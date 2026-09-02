// The mask editor (M-2.4, M-2.4b), built exactly to the DOC-10 §1b design:
// a plain 2D canvas (per-pixel brush work — PixiJS stays reserved for the
// scene renderer); brush add/erase with size, edge feather, zoom and pan;
// strokes undo LOCALLY inside the editor; Save writes a NEW cutout file in
// the main process (original pixels + edited alpha, never through a canvas)
// and makes ONE document edit repointing the asset, so document undo
// repoints to the previous file. "Reset to automatic" repoints at the
// original automatic cutout; "HD cutout" runs the full model through the
// existing worker queue. Keyboard-friendly throughout.

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { Asset } from '../../../shared/document/types';
import { repointCutout } from '../../../shared/document/edits';
import {
  applyPatch,
  extractPatch,
  featherMask,
  stampBrush,
  type BrushMode,
  type DirtyRect,
  type MaskPatch
} from '../../../shared/segmentation/mask';
import type { ApplyEdit } from './AssetsPanel';

/** One local-undo step: a stroke's patches, or a whole-mask change. */
type UndoOp =
  | { readonly kind: 'patches'; readonly patches: readonly MaskPatch[] }
  | { readonly kind: 'full'; readonly before: Uint8Array };

interface Loaded {
  width: number;
  height: number;
  /** The cutout's exact bytes; RGB never changes here. */
  source: Uint8Array;
  /** The alpha being edited (0 = removed, 255 = kept). */
  mask: Uint8Array;
}

const MAX_LOCAL_UNDO = 30;

export function MaskEditor({
  projectDir,
  asset,
  applyEdit,
  onClose
}: {
  projectDir: string;
  asset: Asset;
  applyEdit: ApplyEdit;
  onClose: () => void;
}): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const loadedRef = useRef<Loaded | undefined>(undefined);
  const imageDataRef = useRef<ImageData | undefined>(undefined);
  const undoStack = useRef<UndoOp[]>([]);
  const redoStack = useRef<UndoOp[]>([]);
  const stroke = useRef<{ patches: MaskPatch[]; lastX: number; lastY: number } | undefined>(
    undefined
  );
  const panning = useRef<{ startX: number; startY: number; panX: number; panY: number } | undefined>(
    undefined
  );
  const spaceHeld = useRef(false);

  const [status, setStatus] = useState('Loading…');
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<BrushMode>('add');
  const [brushSize, setBrushSize] = useState(40);
  const [featherRadius, setFeatherRadius] = useState(3);
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [canUndoLocal, setCanUndoLocal] = useState(false);
  const [canRedoLocal, setCanRedoLocal] = useState(false);

  const refreshUndoFlags = (): void => {
    setCanUndoLocal(undoStack.current.length > 0);
    setCanRedoLocal(redoStack.current.length > 0);
  };

  /** Redraws the display for one region (or everything): photo where kept,
   *  dimmed red where removed. Display only — the mask stays exact. */
  const renderRegion = useCallback((rect?: DirtyRect): void => {
    const loaded = loadedRef.current;
    const imageData = imageDataRef.current;
    const canvas = canvasRef.current;
    if (!loaded || !imageData || !canvas) return;
    const x0 = rect?.x ?? 0;
    const y0 = rect?.y ?? 0;
    const w = rect?.width ?? loaded.width;
    const h = rect?.height ?? loaded.height;
    const data = imageData.data;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const i = y * loaded.width + x;
        const keep = (loaded.mask[i] ?? 0) / 255;
        const r = loaded.source[i * 4] ?? 0;
        const g = loaded.source[i * 4 + 1] ?? 0;
        const b = loaded.source[i * 4 + 2] ?? 0;
        const luminance = 0.3 * r + 0.6 * g + 0.1 * b;
        data[i * 4] = Math.round(r * keep + (luminance * 0.35 + 90) * (1 - keep));
        data[i * 4 + 1] = Math.round(g * keep + luminance * 0.25 * (1 - keep));
        data[i * 4 + 2] = Math.round(b * keep + luminance * 0.3 * (1 - keep));
        data[i * 4 + 3] = 255;
      }
    }
    const context = canvas.getContext('2d');
    context?.putImageData(imageData, 0, 0, x0, y0, w, h);
  }, []);

  const fitView = useCallback((): void => {
    const loaded = loadedRef.current;
    const wrap = wrapRef.current;
    if (!loaded || !wrap) return;
    const zoom = Math.min(
      1,
      (wrap.clientWidth - 24) / loaded.width,
      (wrap.clientHeight - 24) / loaded.height
    );
    setView({ zoom: Math.max(0.02, zoom), panX: 0, panY: 0 });
  }, []);

  // Load the cutout's exact pixels whenever the file changes (open, reset,
  // HD replace, document undo while open). Local history starts fresh.
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setStatus('Loading…');
    void window.papercut
      .readCutoutPixels(projectDir, asset.file)
      .then((pixels) => {
        if (cancelled) return;
        const mask = new Uint8Array(pixels.width * pixels.height);
        for (let i = 0; i < mask.length; i++) mask[i] = pixels.rgba[i * 4 + 3] ?? 0;
        loadedRef.current = {
          width: pixels.width,
          height: pixels.height,
          source: new Uint8Array(pixels.rgba),
          mask
        };
        undoStack.current = [];
        redoStack.current = [];
        setDirty(false);
        refreshUndoFlags();
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = pixels.width;
          canvas.height = pixels.height;
        }
        imageDataRef.current = new ImageData(pixels.width, pixels.height);
        renderRegion();
        fitView();
        setReady(true);
        setStatus('');
      })
      .catch((error: unknown) => setStatus(`Could not open the cutout: ${String(error)}`));
    return () => {
      cancelled = true;
    };
  }, [projectDir, asset.file, renderRegion, fitView]);

  const pushOp = (op: UndoOp): void => {
    undoStack.current.push(op);
    if (undoStack.current.length > MAX_LOCAL_UNDO) undoStack.current.shift();
    redoStack.current = [];
    setDirty(true);
    refreshUndoFlags();
  };

  const undoLocal = useCallback((): void => {
    const loaded = loadedRef.current;
    const op = undoStack.current.pop();
    if (!loaded || !op) return;
    if (op.kind === 'patches') {
      const redoPatches: MaskPatch[] = [];
      for (let i = op.patches.length - 1; i >= 0; i--) {
        const patch = op.patches[i];
        if (!patch) continue;
        redoPatches.push(extractPatch(loaded.mask, loaded.width, patch.rect));
        applyPatch(loaded.mask, loaded.width, patch);
        renderRegion(patch.rect);
      }
      redoStack.current.push({ kind: 'patches', patches: redoPatches });
    } else {
      redoStack.current.push({ kind: 'full', before: new Uint8Array(loaded.mask) });
      loaded.mask.set(op.before);
      renderRegion();
    }
    setDirty(true);
    refreshUndoFlags();
  }, [renderRegion]);

  const redoLocal = useCallback((): void => {
    const loaded = loadedRef.current;
    const op = redoStack.current.pop();
    if (!loaded || !op) return;
    if (op.kind === 'patches') {
      const undoPatches: MaskPatch[] = [];
      for (let i = op.patches.length - 1; i >= 0; i--) {
        const patch = op.patches[i];
        if (!patch) continue;
        undoPatches.push(extractPatch(loaded.mask, loaded.width, patch.rect));
        applyPatch(loaded.mask, loaded.width, patch);
        renderRegion(patch.rect);
      }
      undoStack.current.push({ kind: 'patches', patches: undoPatches });
    } else {
      undoStack.current.push({ kind: 'full', before: new Uint8Array(loaded.mask) });
      loaded.mask.set(op.before);
      renderRegion();
    }
    setDirty(true);
    refreshUndoFlags();
  }, [renderRegion]);

  // ---- painting ----

  const maskPointFromEvent = (event: React.PointerEvent): { x: number; y: number } | undefined => {
    const canvas = canvasRef.current;
    const loaded = loadedRef.current;
    if (!canvas || !loaded) return undefined;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * loaded.width,
      y: ((event.clientY - rect.top) / rect.height) * loaded.height
    };
  };

  const dabAt = (x: number, y: number): void => {
    const loaded = loadedRef.current;
    const current = stroke.current;
    if (!loaded || !current) return;
    const radius = brushSize / 2;
    const bound: DirtyRect = {
      x: Math.max(0, Math.floor(x - radius)),
      y: Math.max(0, Math.floor(y - radius)),
      width: Math.min(loaded.width - 1, Math.ceil(x + radius)) - Math.max(0, Math.floor(x - radius)) + 1,
      height: Math.min(loaded.height - 1, Math.ceil(y + radius)) - Math.max(0, Math.floor(y - radius)) + 1
    };
    if (bound.width <= 0 || bound.height <= 0) return;
    current.patches.push(extractPatch(loaded.mask, loaded.width, bound));
    const touched = stampBrush(loaded.mask, loaded.width, loaded.height, x, y, radius, mode);
    if (touched) renderRegion(touched);
  };

  const onPointerDown = (event: React.PointerEvent): void => {
    if (!ready || busy) return;
    if (event.button === 1 || spaceHeld.current) {
      panning.current = {
        startX: event.clientX,
        startY: event.clientY,
        panX: view.panX,
        panY: view.panY
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
    const point = maskPointFromEvent(event);
    if (!point) return;
    stroke.current = { patches: [], lastX: point.x, lastY: point.y };
    dabAt(point.x, point.y);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent): void => {
    if (panning.current) {
      setView((old) => ({
        ...old,
        panX: (panning.current?.panX ?? 0) + (event.clientX - (panning.current?.startX ?? 0)),
        panY: (panning.current?.panY ?? 0) + (event.clientY - (panning.current?.startY ?? 0))
      }));
      return;
    }
    const current = stroke.current;
    if (!current) return;
    const point = maskPointFromEvent(event);
    if (!point) return;
    // Interpolate dabs so fast strokes leave no gaps.
    const step = Math.max(1, brushSize / 4);
    const dx = point.x - current.lastX;
    const dy = point.y - current.lastY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    for (let travelled = step; travelled <= distance; travelled += step) {
      dabAt(current.lastX + (dx * travelled) / distance, current.lastY + (dy * travelled) / distance);
    }
    if (distance >= step) {
      current.lastX = point.x;
      current.lastY = point.y;
    }
  };

  const onPointerUp = (): void => {
    panning.current = undefined;
    const current = stroke.current;
    stroke.current = undefined;
    if (current && current.patches.length > 0) {
      pushOp({ kind: 'patches', patches: current.patches });
    }
  };

  // ---- whole-mask operations ----

  const runFeather = (): void => {
    const loaded = loadedRef.current;
    if (!loaded || featherRadius <= 0) return;
    pushOp({ kind: 'full', before: new Uint8Array(loaded.mask) });
    featherMask(loaded.mask, loaded.width, loaded.height, featherRadius);
    renderRegion();
  };

  const save = (): void => {
    const loaded = loadedRef.current;
    if (!loaded) return;
    setBusy(true);
    setStatus('Saving…');
    window.papercut
      .saveCutoutVersion(projectDir, asset.file, loaded.mask, loaded.width, loaded.height)
      .then((newFile) => {
        const automaticFile = asset.metadata.automaticFile ?? asset.file;
        applyEdit((current) => repointCutout(current, asset.id, newFile, automaticFile));
        onClose();
      })
      .catch((error: unknown) => {
        setStatus(String(error));
        setBusy(false);
      });
  };

  const resetToAutomatic = (): void => {
    const automaticFile = asset.metadata.automaticFile ?? asset.file;
    if (automaticFile !== asset.file) {
      // One document edit; the file-change reloads the editor with it.
      applyEdit((current) => repointCutout(current, asset.id, automaticFile, automaticFile));
    } else {
      // Never saved: just reload the automatic mask, dropping local strokes.
      const canvas = canvasRef.current;
      if (canvas) {
        setReady(false);
        void window.papercut.readCutoutPixels(projectDir, asset.file).then((pixels) => {
          const loaded = loadedRef.current;
          if (!loaded) return;
          for (let i = 0; i < loaded.mask.length; i++) loaded.mask[i] = pixels.rgba[i * 4 + 3] ?? 0;
          undoStack.current = [];
          redoStack.current = [];
          setDirty(false);
          refreshUndoFlags();
          renderRegion();
          setReady(true);
        });
      }
    }
  };

  const runHd = (): void => {
    const loaded = loadedRef.current;
    if (!loaded) return;
    setBusy(true);
    setStatus('HD cutout running — this uses the big model and can take about a minute on a small laptop…');
    window.papercut
      .enqueueCutout(
        projectDir,
        asset.metadata.sourceAssetId ?? asset.id,
        'hd',
        new Uint8Array(loaded.source),
        loaded.width,
        loaded.height
      )
      .then((hdAsset) => {
        const automaticFile = asset.metadata.automaticFile ?? asset.file;
        applyEdit((current) => repointCutout(current, asset.id, hdAsset.file, automaticFile));
        setBusy(false);
        setStatus('HD cutout done — you are now editing the HD mask.');
      })
      .catch((error: unknown) => {
        setBusy(false);
        setStatus(`HD cutout did not finish: ${String(error)}`);
      });
  };

  // ---- keyboard (the editor owns the keys while it is open) ----

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.code === 'Space') {
        spaceHeld.current = true;
        event.preventDefault();
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        undoLocal();
        return;
      }
      if (event.ctrlKey && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        redoLocal();
        return;
      }
      if (event.key === 'a' || event.key === 'A') setMode('add');
      if (event.key === 'e' || event.key === 'E') setMode('erase');
      if (event.key === '[') setBrushSize((s) => Math.max(4, s - 8));
      if (event.key === ']') setBrushSize((s) => Math.min(400, s + 8));
      if (event.key === '+' || event.key === '=') setView((v) => ({ ...v, zoom: Math.min(8, v.zoom * 1.25) }));
      if (event.key === '-') setView((v) => ({ ...v, zoom: Math.max(0.02, v.zoom / 1.25) }));
      if (event.key === '0') fitView();
      if (event.key === 'Escape' && !dirty && !busy) onClose();
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space') spaceHeld.current = false;
    };
    // Capture phase so Ctrl+Z here never reaches the document-level handler.
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [undoLocal, redoLocal, fitView, dirty, busy, onClose]);

  const onWheel = (event: React.WheelEvent): void => {
    const factor = event.deltaY < 0 ? 1.2 : 1 / 1.2;
    setView((v) => ({ ...v, zoom: Math.min(8, Math.max(0.02, v.zoom * factor)) }));
  };

  return (
    <div className="mask-editor">
      <div className="mask-toolbar">
        <button
          type="button"
          className="btn"
          aria-pressed={mode === 'add'}
          onClick={() => setMode('add')}
          title="Brush that keeps pixels (A)"
        >
          Add (A)
        </button>
        <button
          type="button"
          className="btn"
          aria-pressed={mode === 'erase'}
          onClick={() => setMode('erase')}
          title="Brush that removes pixels (E)"
        >
          Erase (E)
        </button>
        <label className="mask-tool">
          size
          <input
            type="range"
            min={4}
            max={400}
            value={brushSize}
            onChange={(event) => setBrushSize(Number(event.target.value))}
          />
          {brushSize}
        </label>
        <label className="mask-tool">
          feather
          <input
            type="range"
            min={0}
            max={20}
            value={featherRadius}
            onChange={(event) => setFeatherRadius(Number(event.target.value))}
          />
          {featherRadius}px
        </label>
        <button type="button" className="btn" disabled={!ready || busy || featherRadius === 0} onClick={runFeather}>
          Feather edge
        </button>
        <button type="button" className="btn" disabled={!canUndoLocal || busy} onClick={undoLocal}>
          Undo stroke
        </button>
        <button type="button" className="btn" disabled={!canRedoLocal || busy} onClick={redoLocal}>
          Redo stroke
        </button>
        <span className="project-spacer" />
        <button type="button" className="btn" disabled={!ready || busy} onClick={resetToAutomatic}>
          Reset to automatic
        </button>
        <button
          type="button"
          className="btn"
          disabled={!ready || busy}
          onClick={runHd}
          title="Re-cut with the big model. Can take about a minute on a small laptop."
        >
          HD cutout
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" disabled={!ready || busy || !dirty} onClick={save}>
          Save
        </button>
      </div>
      {status !== '' && <p className="opened-note mask-status">{status}</p>}
      <div className="mask-canvas-wrap" ref={wrapRef} onWheel={onWheel}>
        <canvas
          ref={canvasRef}
          className="mask-canvas"
          style={{
            transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
            cursor: busy ? 'wait' : 'crosshair'
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <p className="assets-hint">
        Paint to keep (Add) or remove (Erase). Keys: A/E brush, [ ] size, +/− zoom, 0 fit,
        Space+drag or middle-drag to pan, Ctrl+Z/Ctrl+Y undo/redo strokes. Red areas will be
        transparent. Save writes a new cutout file; the previous one stays for undo.
      </p>
    </div>
  );
}
