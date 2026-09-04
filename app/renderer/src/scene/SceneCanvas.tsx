// The live scene canvas: the project's format fitted to the space
// available, drawn by the SAME sceneStage the export renders through
// (ADR-006: what you see is what exports). This file adds what the editor
// needs around the shared picture: textures from the project folder,
// sizing to the window, the selection outline with resize handles, and
// dragging — all outside the sceneStage, so none of it can leak into an
// export.
//
// Dragging follows the plan's one-undo-step rule: while the mouse is down
// only the sprite moves; releasing makes ONE setKeyframe edit; Escape
// cancels with no edit at all. Clicks pick the front-most layer whose
// actual picture is under the cursor — transparent parts of a cutout do
// not catch clicks (checked against a small alpha map of each picture).

// The window is sandboxed and disallows eval; this PixiJS module swaps its
// eval-based fast path for a safe one.
import 'pixi.js/unsafe-eval';
import { Container, Graphics, Texture, WebGLRenderer } from 'pixi.js';
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { setCameraKeyframe, setKeyframe, setSceneBackground } from '../../../shared/document/edits';
import type { Keyframe, ProjectDocument, Scene } from '../../../shared/document/types';
import { addCharacterToScene, addPropToScene } from '../../../shared/scene/addToScene';
import { readSceneDragData, SCENE_DRAG_TYPE } from './sceneDrag';
import {
  cameraKeyframeAtPlayhead,
  clampCamera,
  panCamera,
  sampleCamera,
  viewToWorld,
  zoomCamera,
  type CameraSample
} from '../../../shared/animation/camera';
import { sampleLayer } from '../../../shared/animation/interpolate';
import { keyframeAtPlayhead } from '../../../shared/animation/keyframes';
import {
  canvasToReference,
  fitCanvas,
  referenceSize,
  referenceToLayerPixel,
  resizeScale,
  rotationFromDrag,
  type CanvasFit,
  type Point
} from '../../../shared/scene/geometry';
import { createSceneStage, sceneImageAssetIds, type SceneStage } from './sceneStage';
import { MAX_UI_ZOOM } from './CameraPanel';

type ApplyEdit = (edit: (current: ProjectDocument) => ProjectDocument) => void;

export interface SceneCanvasProps {
  readonly projectDir: string;
  readonly document: ProjectDocument;
  readonly scene: Scene;
  readonly selectedLayerId?: string;
  /**
   * The playhead, in seconds (frame-snapped by the time strip). The scene
   * is drawn at this time and every canvas edit writes the keyframe at it.
   * Absent means 0 — the Phase 4 behaviour.
   */
  readonly time?: number;
  /** Live preview of the opacity slider before it commits (0..1). */
  readonly opacityPreview?: number;
  readonly applyEdit: ApplyEdit;
  readonly onSelect: (layerId: string | undefined) => void;
  /**
   * When set, the canvas is in "pick a spot" mode (Walk's destination):
   * the next click is reported as a world point — through the camera, so
   * it means the same place at any pan or zoom — and nothing is selected
   * or dragged. Escape (handled by the project view) disarms it.
   */
  readonly onPickPoint?: (point: Point) => void;
  /**
   * Camera mode (M-4.6): dragging pans and the wheel zooms — each gesture
   * ONE camera-keyframe edit at the playhead, previewed live through the
   * stage's camera preview. Layer picking and dragging are off.
   */
  readonly cameraMode?: boolean;
  /** The camera panel's live zoom-slider preview (cleared on commit). */
  readonly cameraPreview?: CameraSample;
}

interface LoadedTexture {
  /** Cache key: asset id + file, so a repointed cutout reloads. */
  readonly key: string;
  readonly texture: Texture;
  /** Full picture size, and a small alpha map for click-through checks. */
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly alphaWidth: number;
  readonly alphaHeight: number;
  readonly alpha: Uint8Array;
}

/** Alpha at a full-size pixel, from the downsampled map (0 when unknown). */
function alphaAt(loaded: LoadedTexture, pixel: Point): number {
  const ax = Math.min(
    loaded.alphaWidth - 1,
    Math.floor((pixel.x / loaded.imageWidth) * loaded.alphaWidth)
  );
  const ay = Math.min(
    loaded.alphaHeight - 1,
    Math.floor((pixel.y / loaded.imageHeight) * loaded.alphaHeight)
  );
  return loaded.alpha[ay * loaded.alphaWidth + ax] ?? 0;
}

const HANDLE_PX = 7; // drawn size of a corner resize handle, screen pixels
const HANDLE_GRAB_PX = 9; // how close a pointer-down counts as grabbing one
const ROTATE_OFFSET_PX = 18; // the rotate handle floats this far above the box
const ROTATE_HANDLE_R = 5; // its drawn radius, screen pixels

interface DragState {
  readonly mode: 'move' | 'resize' | 'rotate';
  readonly layerId: string;
  readonly startKeyframe: Keyframe;
  /** Pointer-down position in reference pixels. */
  readonly startRef: Point;
  /** Rotate only: the layer's centre and the grab point, in canvas pixels
      (angles survive the uniform canvas/camera scaling). */
  readonly centerCanvas?: Point;
  readonly startCanvas?: Point;
  moved: boolean;
  /** The sprite's live values, committed on release. */
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export function SceneCanvas(props: SceneCanvasProps): JSX.Element {
  const { projectDir, document: doc, scene, selectedLayerId, opacityPreview, applyEdit, onSelect } =
    props;
  const time = props.time ?? 0;
  // Readable from the stage-building effect without rebuilding per scrub.
  const timeRef = useRef(time);
  timeRef.current = time;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [renderer, setRenderer] = useState<WebGLRenderer | undefined>(undefined);
  const [fit, setFit] = useState<CanvasFit | undefined>(undefined);
  const fitRef = useRef<CanvasFit | undefined>(undefined);
  fitRef.current = fit;
  // Texture per asset id, cached across renders; bumping the version
  // triggers a redraw when a load finishes.
  const texturesRef = useRef(new Map<string, LoadedTexture>());
  const [textureVersion, setTextureVersion] = useState(0);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  // The stage currently on screen, kept alive so a drag can move sprites
  // without rebuilding; replaced whenever the document changes.
  const stageRef = useRef<
    { root: Container; sceneStage: SceneStage; overlay: Graphics } | undefined
  >(undefined);
  const dragRef = useRef<DragState | undefined>(undefined);
  // A camera pan in progress (camera mode): a live preview through the
  // stage's camera preview until its ONE edit commits on release.
  const cameraDragRef = useRef<
    | {
        readonly startView: Point;
        readonly startSample: CameraSample;
        sample: CameraSample;
        moved: boolean;
      }
    | undefined
  >(undefined);
  // Wheel zoom accumulates ticks into ONE edit after a short pause.
  const wheelRef = useRef<{ sample: CameraSample; timer: number } | undefined>(undefined);

  // One renderer with its own canvas element for this component's lifetime.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (wrap === null) return;
    const canvas = window.document.createElement('canvas');
    canvas.className = 'scene-canvas';
    wrap.appendChild(canvas);
    canvasElRef.current = canvas;
    let cancelled = false;
    const created = new WebGLRenderer();
    void created
      .init({
        canvas,
        width: 2,
        height: 2,
        backgroundColor: 0x000000,
        backgroundAlpha: 1,
        antialias: true
      })
      .then(() => {
        if (cancelled) created.destroy();
        else setRenderer(created);
      })
      .catch((error: unknown) => setLoadError(`The scene view could not start: ${String(error)}`));
    return () => {
      cancelled = true;
      dragRef.current = undefined;
      if (stageRef.current !== undefined) {
        stageRef.current.sceneStage.destroy();
        stageRef.current.root.destroy({ children: true, texture: false });
        stageRef.current = undefined;
      }
      setRenderer((current) => {
        if (current === created) {
          created.destroy();
          return undefined;
        }
        return current;
      });
      canvas.remove();
      canvasElRef.current = null;
    };
  }, []);

  // Fit the reference frame to the space the canvas column gives us.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (wrap === null) return;
    const measure = (): void => {
      const rect = wrap.getBoundingClientRect();
      // Leave a small breathing margin inside the frame border.
      setFit(fitCanvas(doc.format, { width: rect.width - 16, height: rect.height - 16 }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [doc.format]);

  // Load a texture (and a small alpha map for picking) for every image the
  // scene needs, keyed by asset id + file so a cutout repointed by the
  // mask editor reloads its picture.
  useEffect(() => {
    let cancelled = false;
    const cache = texturesRef.current;
    const needed = new Map<string, { key: string; file: string }>();
    for (const id of sceneImageAssetIds(doc, scene)) {
      const asset = doc.assets.find((a) => a.id === id);
      if (asset !== undefined) needed.set(id, { key: `${id}|${asset.file}`, file: asset.file });
    }
    // Drop textures no longer needed or pointing at an old file.
    let dropped = false;
    for (const [id, loaded] of [...cache]) {
      if (needed.get(id)?.key !== loaded.key) {
        loaded.texture.destroy(true);
        cache.delete(id);
        dropped = true;
      }
    }
    if (dropped) setTextureVersion((v) => v + 1);
    for (const [id, want] of needed) {
      if (cache.get(id)?.key === want.key) continue;
      void (async () => {
        try {
          const bytes = await window.papercut.readProjectFile(projectDir, want.file);
          const copy = new Uint8Array(bytes);
          const bitmap = await createImageBitmap(new Blob([copy.buffer as ArrayBuffer]));
          if (cancelled || cache.get(id)?.key === want.key) {
            bitmap.close();
            return;
          }
          // A coarse alpha map is plenty for "did the click land on the
          // picture" — a few reference pixels of precision.
          const alphaWidth = Math.max(1, Math.min(256, bitmap.width));
          const alphaHeight = Math.max(
            1,
            Math.round((bitmap.height / bitmap.width) * alphaWidth) || 1
          );
          const scratch = new OffscreenCanvas(alphaWidth, alphaHeight);
          const ctx = scratch.getContext('2d');
          if (ctx === null) throw new Error('no 2d context for the alpha map');
          ctx.drawImage(bitmap, 0, 0, alphaWidth, alphaHeight);
          const rgba = ctx.getImageData(0, 0, alphaWidth, alphaHeight).data;
          const alpha = new Uint8Array(alphaWidth * alphaHeight);
          for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3] ?? 0;

          cache.get(id)?.texture.destroy(true);
          cache.set(id, {
            key: want.key,
            texture: Texture.from(bitmap),
            imageWidth: bitmap.width,
            imageHeight: bitmap.height,
            alphaWidth,
            alphaHeight,
            alpha
          });
          setTextureVersion((v) => v + 1);
          setLoadError(undefined);
        } catch (error) {
          if (!cancelled) setLoadError(`A picture could not be loaded: ${String(error)}`);
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [projectDir, doc, scene]);

  // Destroy whatever textures remain when the canvas goes away for good.
  useEffect(() => {
    const cache = texturesRef.current;
    return () => {
      for (const loaded of cache.values()) loaded.texture.destroy(true);
      cache.clear();
    };
  }, []);

  // The selection, readable from callbacks that must not re-create on
  // every selection change (a re-created draw effect would kill a drag
  // the same pointer-down just started).
  const selectedRef = useRef<string | undefined>(selectedLayerId);
  selectedRef.current = selectedLayerId;

  /** Redraws the selection outline + handles around the selected sprite. */
  const drawOverlay = useCallback((): void => {
    const stage = stageRef.current;
    if (stage === undefined) return;
    stage.overlay.clear();
    const selected = selectedRef.current;
    if (selected === undefined) return;
    const sprite = stage.sceneStage.getLayerSprite(selected);
    if (sprite === undefined || !sprite.visible) return;
    const b = sprite.getBounds();
    stage.overlay
      .rect(b.x, b.y, b.width, b.height)
      .stroke({ color: 0xe8a33d, width: 1, pixelLine: true });
    const half = HANDLE_PX / 2;
    for (const [cx, cy] of [
      [b.x, b.y],
      [b.x + b.width, b.y],
      [b.x, b.y + b.height],
      [b.x + b.width, b.y + b.height]
    ] as const) {
      stage.overlay
        .rect(cx - half, cy - half, HANDLE_PX, HANDLE_PX)
        .fill(0xe8a33d)
        .stroke({ color: 0x1a1408, width: 1, pixelLine: true });
    }
    // The rotate handle: a small circle on a stem above the box (M-4.2).
    const hx = b.x + b.width / 2;
    stage.overlay
      .moveTo(hx, b.y)
      .lineTo(hx, b.y - ROTATE_OFFSET_PX + ROTATE_HANDLE_R)
      .stroke({ color: 0xe8a33d, width: 1, pixelLine: true });
    stage.overlay
      .circle(hx, b.y - ROTATE_OFFSET_PX, ROTATE_HANDLE_R)
      .fill(0xe8a33d)
      .stroke({ color: 0x1a1408, width: 1, pixelLine: true });
  }, []);

  const render = useCallback((): void => {
    const stage = stageRef.current;
    if (renderer !== undefined && stage !== undefined) renderer.render(stage.root);
  }, [renderer]);

  // Draw: rebuild the shared stage once per change and keep it alive for
  // dragging. Sprites are cheap; the textures above are reused.
  useEffect(() => {
    if (renderer === undefined || fit === undefined) return;
    if (!(fit.width >= 1 && fit.height >= 1)) return;
    const width = Math.round(fit.width);
    const height = Math.round(fit.height);
    if (renderer.width !== width || renderer.height !== height) {
      renderer.resize(width, height);
    }

    if (stageRef.current !== undefined) {
      stageRef.current.sceneStage.destroy();
      stageRef.current.root.destroy({ children: true, texture: false });
      stageRef.current = undefined;
    }
    dragRef.current = undefined; // a rebuild ends any drag in progress
    cameraDragRef.current = undefined;

    const root = new Container();
    const textureById = new Map<string, Texture>();
    for (const [id, loaded] of texturesRef.current) textureById.set(id, loaded.texture);
    const sceneStage = createSceneStage({ document: doc, scene, textures: textureById });
    sceneStage.container.scale.set(fit.scale);
    root.addChild(sceneStage.container);
    sceneStage.update(timeRef.current);

    // Editor-only decoration, outside the shared stage.
    const overlay = new Graphics();
    root.addChild(overlay);
    stageRef.current = { root, sceneStage, overlay };

    drawOverlay();
    renderer.render(root);
  }, [renderer, fit, textureVersion, doc, scene, drawOverlay]);

  // Selection, the playhead, and the opacity slider's live preview redraw
  // lightly — no stage rebuild, so the drag a pointer-down just started
  // stays alive.
  useEffect(() => {
    const stage = stageRef.current;
    if (renderer === undefined || stage === undefined) return;
    if (
      dragRef.current === undefined &&
      cameraDragRef.current === undefined &&
      wheelRef.current === undefined
    ) {
      // The camera panel's zoom-slider preview (undefined = the document).
      stage.sceneStage.setCameraPreview(props.cameraPreview);
      stage.sceneStage.update(time); // poses everything, resets any preview
      if (selectedLayerId !== undefined && opacityPreview !== undefined) {
        const sprite = stage.sceneStage.getLayerSprite(selectedLayerId);
        if (sprite !== undefined) sprite.alpha = opacityPreview;
      }
    }
    drawOverlay();
    render();
  }, [renderer, selectedLayerId, time, opacityPreview, props.cameraPreview, textureVersion, doc, scene, drawOverlay, render]);

  /** Pointer position in canvas pixels, or undefined outside the canvas. */
  const toCanvasPoint = (event: React.PointerEvent): Point | undefined => {
    const canvas = canvasElRef.current;
    if (canvas === null) return undefined;
    const rect = canvas.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (point.x < 0 || point.y < 0 || point.x >= rect.width || point.y >= rect.height) {
      return undefined;
    }
    return point;
  };

  /**
   * A point in the viewed frame mapped to world coordinates, where layer
   * keyframes live — through the camera, so picking and dragging land
   * right at any pan and zoom. With no camera keyframes it is the identity.
   */
  const toWorldPoint = (refP: Point): Point => {
    const frame = referenceSize(doc.format);
    return viewToWorld(refP, sampleCamera(scene, time, frame), frame);
  };

  /** The front-most layer whose picture (not its transparent parts) is at worldP. */
  const pickLayer = (worldP: Point): string | undefined => {
    for (let i = scene.layers.length - 1; i >= 0; i--) {
      const layer = scene.layers[i];
      if (layer === undefined || layer.hidden === true || layer.locked === true) continue;
      const sample = sampleLayer(layer, time);
      if (sample === undefined) continue;
      // The picture this layer currently shows (a character's pose).
      const sprite = stageRef.current?.sceneStage.getLayerSprite(layer.id);
      if (sprite === undefined || !sprite.visible) continue;
      const assetId = [...texturesRef.current.entries()].find(
        ([, t]) => t.texture === sprite.texture
      )?.[0];
      const loaded = assetId !== undefined ? texturesRef.current.get(assetId) : undefined;
      if (loaded === undefined) continue;
      const pixel = referenceToLayerPixel(
        sample,
        { width: loaded.imageWidth, height: loaded.imageHeight },
        worldP
      );
      if (pixel !== undefined && alphaAt(loaded, pixel) > 25) return layer.id;
    }
    return undefined;
  };

  const endDrag = useCallback(
    (commit: boolean): void => {
      const drag = dragRef.current;
      dragRef.current = undefined;
      if (drag === undefined) return;
      if (commit && drag.moved) {
        // ONE document edit for the whole drag — one undo step.
        const keyframe: Keyframe = {
          ...drag.startKeyframe,
          x: drag.x,
          y: drag.y,
          scale: drag.scale,
          rotation: drag.rotation
        };
        applyEdit((current) => setKeyframe(current, scene.id, drag.layerId, keyframe));
      } else {
        // Cancelled (Escape) or never moved: put the sprite back, no edit.
        const sprite = stageRef.current?.sceneStage.getLayerSprite(drag.layerId);
        if (sprite !== undefined) {
          const k = drag.startKeyframe;
          sprite.position.set(k.x, k.y);
          sprite.scale.set(k.scale * (k.flipX ? -1 : 1), k.scale);
          sprite.rotation = (k.rotation * Math.PI) / 180;
          drawOverlay();
          render();
        }
      }
    },
    [applyEdit, scene.id, drawOverlay, render]
  );

  /**
   * ONE camera edit for a whole pan or wheel gesture: the camera keyframe
   * at the playhead — seeded like a layer keyframe when none sits exactly
   * here — with the previewed values, clamped (decision g).
   */
  const commitCamera = useCallback(
    (sample: CameraSample): void => {
      const frame = referenceSize(doc.format);
      const clamped = clampCamera(sample, frame);
      applyEdit((current) => {
        const currentScene = current.scenes.find((s) => s.id === scene.id);
        if (currentScene === undefined) return current;
        const seed = cameraKeyframeAtPlayhead(currentScene, timeRef.current, frame);
        return setCameraKeyframe(current, currentScene.id, {
          ...seed,
          x: clamped.x,
          y: clamped.y,
          zoom: clamped.zoom
        });
      });
    },
    [applyEdit, scene.id, doc.format]
  );

  const endCameraDrag = useCallback(
    (commit: boolean): void => {
      const drag = cameraDragRef.current;
      cameraDragRef.current = undefined;
      if (drag === undefined) return;
      stageRef.current?.sceneStage.setCameraPreview(undefined);
      if (commit && drag.moved) {
        commitCamera(drag.sample); // the document change redraws the stage
      } else {
        // Cancelled (Escape) or never moved: back to the document's camera.
        stageRef.current?.sceneStage.update(timeRef.current);
        render();
      }
    },
    [commitCamera, render]
  );

  // Escape cancels a drag in progress (and never reaches other listeners).
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (dragRef.current !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        endDrag(false);
      } else if (cameraDragRef.current !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        endCameraDrag(false);
      } else if (wheelRef.current !== undefined) {
        // A wheel zoom still waiting to commit: Escape cancels it — the
        // next Escape then leaves camera mode as usual.
        event.preventDefault();
        event.stopPropagation();
        window.clearTimeout(wheelRef.current.timer);
        wheelRef.current = undefined;
        stageRef.current?.sceneStage.setCameraPreview(undefined);
        stageRef.current?.sceneStage.update(timeRef.current);
        render();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [endDrag, endCameraDrag, render]);

  // Camera mode: the wheel zooms, ticks accumulated into ONE edit shortly
  // after the last one. Attached by hand so preventDefault is honoured
  // (React's own wheel listeners are passive).
  useEffect(() => {
    const wrap = wrapRef.current;
    if (wrap === null || props.cameraMode !== true) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      if (dragRef.current !== undefined || cameraDragRef.current !== undefined) return;
      const stage = stageRef.current;
      if (stage === undefined) return;
      const frame = referenceSize(doc.format);
      const from = wheelRef.current?.sample ?? sampleCamera(scene, timeRef.current, frame);
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      const wanted = zoomCamera(from, factor, frame);
      const sample =
        wanted.zoom > MAX_UI_ZOOM ? clampCamera({ ...wanted, zoom: MAX_UI_ZOOM }, frame) : wanted;
      // Already at a limit (zoom 1 or the cap) and nothing pending: no edit.
      if (
        wheelRef.current === undefined &&
        sample.x === from.x &&
        sample.y === from.y &&
        sample.zoom === from.zoom
      ) {
        return;
      }
      if (wheelRef.current !== undefined) window.clearTimeout(wheelRef.current.timer);
      const timer = window.setTimeout(() => {
        wheelRef.current = undefined;
        stageRef.current?.sceneStage.setCameraPreview(undefined);
        commitCamera(sample);
      }, 350);
      wheelRef.current = { sample, timer };
      stage.sceneStage.setCameraPreview(sample);
      stage.sceneStage.update(timeRef.current);
      render();
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      wrap.removeEventListener('wheel', onWheel);
      if (wheelRef.current !== undefined) {
        window.clearTimeout(wheelRef.current.timer);
        wheelRef.current = undefined;
        stageRef.current?.sceneStage.setCameraPreview(undefined);
      }
    };
  }, [props.cameraMode, doc.format, scene, commitCamera, render]);

  const onPointerDown = (event: React.PointerEvent): void => {
    if (event.button !== 0) return;
    const fitNow = fitRef.current;
    const cp = toCanvasPoint(event);
    if (fitNow === undefined) return;
    if (cp === undefined) {
      if (props.onPickPoint === undefined) onSelect(undefined);
      return;
    }
    const worldP = toWorldPoint(canvasToReference(cp, fitNow));

    // Pick mode: this click IS the answer — nothing selected, no drag.
    if (props.onPickPoint !== undefined) {
      props.onPickPoint(worldP);
      return;
    }

    // Camera mode: this drag pans the camera; layers are never touched.
    if (props.cameraMode === true) {
      const frame = referenceSize(doc.format);
      let startSample = sampleCamera(scene, time, frame);
      let moved = false;
      // A wheel zoom still waiting to commit folds into this gesture.
      if (wheelRef.current !== undefined) {
        window.clearTimeout(wheelRef.current.timer);
        startSample = wheelRef.current.sample;
        wheelRef.current = undefined;
        moved = true;
      }
      cameraDragRef.current = {
        startView: canvasToReference(cp, fitNow),
        startSample,
        sample: startSample,
        moved
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    // A corner handle of the selected layer starts a resize.
    if (selectedLayerId !== undefined) {
      const sprite = stageRef.current?.sceneStage.getLayerSprite(selectedLayerId);
      const layer = scene.layers.find((l) => l.id === selectedLayerId);
      const zero = layer !== undefined ? keyframeAtPlayhead(layer, time) : undefined;
      if (sprite !== undefined && sprite.visible && zero !== undefined) {
        const b = sprite.getBounds();
        // The rotate handle above the box (M-4.2) comes first — it sits
        // outside the box, so it can never shadow a corner.
        const handle = { x: b.x + b.width / 2, y: b.y - ROTATE_OFFSET_PX };
        if (
          Math.abs(cp.x - handle.x) <= HANDLE_GRAB_PX &&
          Math.abs(cp.y - handle.y) <= HANDLE_GRAB_PX
        ) {
          dragRef.current = {
            mode: 'rotate',
            layerId: selectedLayerId,
            startKeyframe: zero,
            startRef: worldP,
            centerCanvas: { x: b.x + b.width / 2, y: b.y + b.height / 2 },
            startCanvas: cp,
            moved: false,
            x: zero.x,
            y: zero.y,
            scale: zero.scale,
            rotation: zero.rotation
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }
        const corners = [
          [b.x, b.y],
          [b.x + b.width, b.y],
          [b.x, b.y + b.height],
          [b.x + b.width, b.y + b.height]
        ] as const;
        const onHandle = corners.some(
          ([cx, cy]) =>
            Math.abs(cp.x - cx) <= HANDLE_GRAB_PX && Math.abs(cp.y - cy) <= HANDLE_GRAB_PX
        );
        if (onHandle) {
          dragRef.current = {
            mode: 'resize',
            layerId: selectedLayerId,
            startKeyframe: zero,
            startRef: worldP,
            moved: false,
            x: zero.x,
            y: zero.y,
            scale: zero.scale,
            rotation: zero.rotation
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }
      }
    }

    // Otherwise pick whatever is under the cursor and start moving it.
    const hit = pickLayer(worldP);
    onSelect(hit);
    if (hit === undefined) return;
    const layer = scene.layers.find((l) => l.id === hit);
    const zero = layer !== undefined ? keyframeAtPlayhead(layer, time) : undefined;
    if (zero === undefined) return;
    dragRef.current = {
      mode: 'move',
      layerId: hit,
      startKeyframe: zero,
      startRef: worldP,
      moved: false,
      x: zero.x,
      y: zero.y,
      scale: zero.scale,
      rotation: zero.rotation
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent): void => {
    // A camera pan in progress: preview the panned camera, commit later.
    const cameraDrag = cameraDragRef.current;
    if (cameraDrag !== undefined) {
      const fitCam = fitRef.current;
      const canvas = canvasElRef.current;
      if (fitCam === undefined || canvas === null) return;
      const rect = canvas.getBoundingClientRect();
      const view = canvasToReference(
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        fitCam
      );
      const frame = referenceSize(doc.format);
      const sample = panCamera(
        cameraDrag.startSample,
        { x: view.x - cameraDrag.startView.x, y: view.y - cameraDrag.startView.y },
        frame
      );
      cameraDrag.sample = sample;
      // Only a pan that actually changes the camera commits an edit — at
      // zoom 1 the clamp holds the view still, so dragging writes nothing.
      if (
        sample.x !== cameraDrag.startSample.x ||
        sample.y !== cameraDrag.startSample.y ||
        sample.zoom !== cameraDrag.startSample.zoom
      ) {
        cameraDrag.moved = true;
      }
      const stage = stageRef.current;
      if (stage !== undefined) {
        stage.sceneStage.setCameraPreview(sample);
        stage.sceneStage.update(timeRef.current);
        render();
      }
      return;
    }

    const drag = dragRef.current;
    const fitNow = fitRef.current;
    if (drag === undefined || fitNow === undefined) return;
    const canvas = canvasElRef.current;
    if (canvas === null) return;
    const rect = canvas.getBoundingClientRect();
    // During a drag the pointer may leave the canvas; keep following it.
    const worldP = toWorldPoint(
      canvasToReference({ x: event.clientX - rect.left, y: event.clientY - rect.top }, fitNow)
    );
    const sprite = stageRef.current?.sceneStage.getLayerSprite(drag.layerId);
    if (sprite === undefined) return;
    const k = drag.startKeyframe;
    if (drag.mode === 'move') {
      drag.x = k.x + (worldP.x - drag.startRef.x);
      drag.y = k.y + (worldP.y - drag.startRef.y);
      sprite.position.set(drag.x, drag.y);
    } else if (drag.mode === 'resize') {
      drag.scale = resizeScale(k.scale, { x: k.x, y: k.y }, drag.startRef, worldP);
      sprite.scale.set(drag.scale * (k.flipX ? -1 : 1), drag.scale);
    } else if (drag.centerCanvas !== undefined && drag.startCanvas !== undefined) {
      // Rotate: swing around the layer's centre, in canvas pixels.
      drag.rotation = rotationFromDrag(
        drag.centerCanvas,
        drag.startCanvas,
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        k.rotation
      );
      sprite.rotation = (drag.rotation * Math.PI) / 180;
    }
    if (
      Math.abs(drag.x - k.x) >= 0.5 ||
      Math.abs(drag.y - k.y) >= 0.5 ||
      Math.abs(drag.scale - k.scale) >= 0.001 ||
      drag.rotation !== k.rotation
    ) {
      drag.moved = true;
    }
    drawOverlay();
    render();
  };

  const onPointerUp = (): void => {
    if (cameraDragRef.current !== undefined) endCameraDrag(true);
    else endDrag(true);
  };

  // Dropping a panel row onto the canvas: a background photo becomes the
  // scene's background; a cutout or character becomes a layer centred at
  // the drop point — the same shared edits the buttons make, one undo
  // step each.
  const onDrop = (event: React.DragEvent): void => {
    const data = readSceneDragData(event.dataTransfer);
    if (data === undefined) return;
    event.preventDefault();
    if (data.kind === 'background') {
      applyEdit((current) => setSceneBackground(current, scene.id, data.assetId));
      return;
    }
    const fitNow = fitRef.current;
    const canvas = canvasElRef.current;
    if (fitNow === undefined || canvas === null) return;
    const rect = canvas.getBoundingClientRect();
    const at = toWorldPoint(
      canvasToReference({ x: event.clientX - rect.left, y: event.clientY - rect.top }, fitNow)
    );
    let layerId: string | undefined;
    applyEdit((current) => {
      const added =
        data.kind === 'cutout'
          ? addPropToScene(current, scene.id, data.assetId, at)
          : addCharacterToScene(current, scene.id, data.characterId, at);
      layerId = added?.layerId;
      return added?.doc ?? current;
    });
    if (layerId !== undefined) onSelect(layerId);
  };

  const empty = scene.backgroundAssetId === undefined && scene.layers.length === 0;
  return (
    <div
      ref={wrapRef}
      className={`scene-canvas-wrap${props.onPickPoint !== undefined ? ' scene-canvas-picking' : ''}${props.cameraMode === true ? ' scene-canvas-camera' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        endDrag(false);
        endCameraDrag(false);
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(SCENE_DRAG_TYPE)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={onDrop}
    >
      {empty && (
        <p className="scene-canvas-hint">
          Import a background photo, then add characters and props — use the buttons on each row
          in the Assets and Characters tabs, or drag a row here.
        </p>
      )}
      {loadError !== undefined && <p className="error scene-canvas-error">{loadError}</p>}
    </div>
  );
}
