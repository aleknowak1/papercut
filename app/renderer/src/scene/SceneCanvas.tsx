// The live scene canvas: the project's format fitted to the space
// available, drawn by the SAME sceneStage the export renders through
// (ADR-006: what you see is what exports). This file only adds what the
// editor needs around the shared picture: loading textures from the
// project folder, sizing to the window, and the selection outline —
// which lives outside the sceneStage and can never leak into an export.

// The window is sandboxed and disallows eval; this PixiJS module swaps its
// eval-based fast path for a safe one.
import 'pixi.js/unsafe-eval';
import { Container, Graphics, Texture, WebGLRenderer } from 'pixi.js';
import { useEffect, useRef, useState, type JSX } from 'react';
import type { ProjectDocument, Scene } from '../../../shared/document/types';
import { fitCanvas, type CanvasFit } from '../../../shared/scene/geometry';
import { createSceneStage, sceneImageAssetIds } from './sceneStage';

export interface SceneCanvasProps {
  readonly projectDir: string;
  readonly document: ProjectDocument;
  readonly scene: Scene;
  readonly selectedLayerId?: string;
  /** Live preview of the opacity slider before it commits (0..1). */
  readonly opacityPreview?: number;
}

interface LoadedTexture {
  /** Cache key: asset id + file, so a repointed cutout reloads. */
  readonly key: string;
  readonly texture: Texture;
}

export function SceneCanvas(props: SceneCanvasProps): JSX.Element {
  const { projectDir, document: doc, scene, selectedLayerId, opacityPreview } = props;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [renderer, setRenderer] = useState<WebGLRenderer | undefined>(undefined);
  const [fit, setFit] = useState<CanvasFit | undefined>(undefined);
  // Texture per asset id, cached across renders; bumping the version
  // triggers a redraw when a load finishes.
  const texturesRef = useRef(new Map<string, LoadedTexture>());
  const [textureVersion, setTextureVersion] = useState(0);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);

  // One renderer with its own canvas element for this component's lifetime.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (wrap === null) return;
    const canvas = window.document.createElement('canvas');
    canvas.className = 'scene-canvas';
    wrap.appendChild(canvas);
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
      setRenderer((current) => {
        if (current === created) {
          created.destroy();
          return undefined;
        }
        return current;
      });
      canvas.remove();
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

  // Load a texture for every image the scene needs, keyed by asset id +
  // file so a cutout repointed by the mask editor reloads its picture.
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
          cache.get(id)?.texture.destroy(true);
          cache.set(id, { key: want.key, texture: Texture.from(bitmap) });
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

  // Draw: rebuild the shared stage and render it once per change. Sprites
  // are cheap; the textures above are reused.
  useEffect(() => {
    if (renderer === undefined || fit === undefined) return;
    if (!(fit.width >= 1 && fit.height >= 1)) return;
    const width = Math.round(fit.width);
    const height = Math.round(fit.height);
    if (renderer.width !== width || renderer.height !== height) {
      renderer.resize(width, height);
    }

    const stage = new Container();
    const textureById = new Map<string, Texture>();
    for (const [id, loaded] of texturesRef.current) textureById.set(id, loaded.texture);
    const sceneStage = createSceneStage({ document: doc, scene, textures: textureById });
    sceneStage.container.scale.set(fit.scale);
    stage.addChild(sceneStage.container);
    sceneStage.update(0);

    // Editor-only decoration, outside the shared stage: opacity preview
    // and the selection outline.
    if (selectedLayerId !== undefined) {
      const sprite = sceneStage.getLayerSprite(selectedLayerId);
      if (sprite !== undefined && sprite.visible) {
        if (opacityPreview !== undefined) sprite.alpha = opacityPreview;
        const bounds = sprite.getBounds();
        const outline = new Graphics()
          .rect(bounds.x, bounds.y, bounds.width, bounds.height)
          .stroke({ color: 0xe8a33d, width: 1, pixelLine: true });
        stage.addChild(outline);
      }
    }

    renderer.render(stage);
    sceneStage.destroy();
    stage.destroy({ children: true, texture: false });
  }, [renderer, fit, textureVersion, doc, scene, selectedLayerId, opacityPreview]);

  const empty = scene.backgroundAssetId === undefined && scene.layers.length === 0;
  return (
    <div ref={wrapRef} className="scene-canvas-wrap">
      {empty && (
        <p className="scene-canvas-hint">
          The scene is empty — assign a background above, or add a layer on the right.
        </p>
      )}
      {loadError !== undefined && <p className="error scene-canvas-error">{loadError}</p>}
    </div>
  );
}
