// Draws export frames off-screen with PixiJS (DOC-03 §4.3, ADR-013).
//
// The encode pipeline only ever asks a FrameSource "draw frame N" — it does
// not know or care how frames are drawn. Since Phase 4 the drawing itself
// lives in the shared scene stage (scene/sceneStage.ts), the SAME code the
// live scene canvas shows on screen — so what the user sees is what
// exports. This file only adds what export needs around it: an off-screen
// renderer at the output resolution, and the dev/check-only debug overlay
// (frame counter, timecode, beep flashes).

// The window is sandboxed and disallows eval; this PixiJS module swaps its
// eval-based fast path for a safe one.
import 'pixi.js/unsafe-eval';
import { Container, Graphics, Text, Texture, WebGLRenderer } from 'pixi.js';
import type { ProjectDocument, Scene } from '../../../shared/document/types';
import { REFERENCE_SIZE } from '../../../shared/scene/geometry';
import { createSceneStage } from '../scene/sceneStage';

export interface FrameSource {
  /** Draws frame `frameIndex` and returns the canvas holding the result. */
  drawFrame(frameIndex: number): HTMLCanvasElement | OffscreenCanvas;
  destroy(): void;
}

export { REFERENCE_SIZE } from '../../../shared/scene/geometry';

export interface SceneFrameSourceOptions {
  readonly document: ProjectDocument;
  readonly scene: Scene;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  /** Decoded images for every image asset the scene uses, by asset id. */
  readonly images: ReadonlyMap<string, ImageBitmap>;
  /** Burn a frame counter and timecode into every frame (dev/check only). */
  readonly debugOverlay: boolean;
  /** Flash the whole frame white for flashFrames frames at each of these times. */
  readonly flashTimes: readonly number[];
  readonly flashFrames: number;
}

function timecode(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.round((seconds - Math.floor(seconds)) * 1000);
  const pad = (n: number, w: number): string => String(n).padStart(w, '0');
  return `${pad(mins, 2)}:${pad(secs, 2)}.${pad(millis, 3)}`;
}

export async function createSceneFrameSource(
  options: SceneFrameSourceOptions
): Promise<FrameSource> {
  const { width, height, fps, scene } = options;
  const [refWidth] = REFERENCE_SIZE[options.document.format];
  const scale = width / refWidth;

  const renderer = new WebGLRenderer();
  await renderer.init({
    width,
    height,
    backgroundColor: 0x000000,
    backgroundAlpha: 1,
    antialias: true,
    // Keep the drawn pixels readable from the canvas after render().
    preserveDrawingBuffer: true
  });

  const stage = new Container();

  // The shared scene picture, in reference pixels, scaled to the output.
  const textures = new Map<string, Texture>();
  for (const [assetId, bitmap] of options.images) {
    textures.set(assetId, Texture.from(bitmap));
  }
  const sceneStage = createSceneStage({ document: options.document, scene, textures });
  sceneStage.container.scale.set(scale);
  stage.addChild(sceneStage.container);

  // Full-frame white flash, shown only during flash frames (checks only).
  const flash = new Graphics().rect(0, 0, width, height).fill(0xffffff);
  flash.visible = false;
  flash.alpha = 0.6;
  stage.addChild(flash);

  let overlay: Text | undefined;
  if (options.debugOverlay) {
    overlay = new Text({
      text: '',
      style: {
        fontFamily: 'Consolas, monospace',
        fontSize: Math.max(16, Math.round(36 * scale)),
        fill: 0xffffff,
        stroke: { color: 0x000000, width: Math.max(2, Math.round(4 * scale)) }
      }
    });
    overlay.position.set(Math.round(24 * scale), Math.round(24 * scale));
    stage.addChild(overlay);
  }

  const flashFrameStarts = options.flashTimes.map((t) => Math.round(t * fps));

  return {
    drawFrame(frameIndex: number): HTMLCanvasElement | OffscreenCanvas {
      const time = frameIndex / fps;
      sceneStage.update(time);

      flash.visible = flashFrameStarts.some(
        (start) => frameIndex >= start && frameIndex < start + options.flashFrames
      );

      if (overlay !== undefined) {
        overlay.text = `frame ${String(frameIndex).padStart(4, '0')}  ${timecode(time)}`;
      }

      renderer.render(stage);
      return renderer.canvas;
    },
    destroy(): void {
      sceneStage.destroy();
      for (const texture of textures.values()) texture.destroy(false);
      stage.destroy({ children: true });
      renderer.destroy();
    }
  };
}
