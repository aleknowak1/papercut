// Draws export frames off-screen with PixiJS (DOC-03 §4.3, ADR-013).
//
// The encode pipeline only ever asks a FrameSource "draw frame N" — it does
// not know or care how frames are drawn. The prototype frame source below
// draws the small slice of the document the Phase 2 prototype needs
// (background, prop layers with linear keyframes). Phases 4/5 replace it
// with the real renderer behind the same interface; the pipeline is reused
// unchanged in Phase 9.

// The window is sandboxed and disallows eval; this PixiJS module swaps its
// eval-based fast path for a safe one.
import 'pixi.js/unsafe-eval';
import { Container, Graphics, Sprite, Text, Texture, WebGLRenderer } from 'pixi.js';
import type { ProjectDocument, Scene } from '../../../shared/document/types';
import { sampleLayer } from '../../../shared/export/interpolate';
import { REFERENCE_SIZE } from '../../../shared/scene/geometry';

export interface FrameSource {
  /** Draws frame `frameIndex` and returns the canvas holding the result. */
  drawFrame(frameIndex: number): HTMLCanvasElement | OffscreenCanvas;
  destroy(): void;
}

export { REFERENCE_SIZE } from '../../../shared/scene/geometry';

export interface PrototypeFrameSourceOptions {
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

export async function createPrototypeFrameSource(
  options: PrototypeFrameSourceOptions
): Promise<FrameSource> {
  const { width, height, fps, scene } = options;
  const [refWidth] = REFERENCE_SIZE[options.document.format] ?? [width, height];
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

  // Background: stretched to fill the frame.
  if (scene.backgroundAssetId !== undefined) {
    const bitmap = options.images.get(scene.backgroundAssetId);
    if (bitmap !== undefined) {
      const bg = new Sprite(Texture.from(bitmap));
      bg.width = width;
      bg.height = height;
      stage.addChild(bg);
    }
  }

  // One sprite per prop layer, positioned per frame from its keyframes.
  // (Character and text layers arrive with Phases 3-5.)
  const layerSprites: { layerId: string; sprite: Sprite }[] = [];
  for (const layer of scene.layers) {
    if (layer.source.kind !== 'prop') continue;
    const bitmap = options.images.get(layer.source.assetId);
    if (bitmap === undefined) continue;
    const sprite = new Sprite(Texture.from(bitmap));
    sprite.anchor.set(0.5);
    stage.addChild(sprite);
    layerSprites.push({ layerId: layer.id, sprite });
  }

  // Full-frame white flash, shown only during flash frames.
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

      for (const { layerId, sprite } of layerSprites) {
        const layer = scene.layers.find((l) => l.id === layerId);
        const sample = layer && sampleLayer(layer, time);
        if (sample === undefined) {
          sprite.visible = false;
          continue;
        }
        sprite.visible = true;
        sprite.position.set(sample.x * scale, sample.y * scale);
        sprite.scale.set(sample.scale * scale * (sample.flipX ? -1 : 1), sample.scale * scale);
        sprite.rotation = (sample.rotation * Math.PI) / 180; // degrees in the document
        sprite.alpha = sample.opacity;
      }

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
      stage.destroy({ children: true });
      renderer.destroy();
    }
  };
}
