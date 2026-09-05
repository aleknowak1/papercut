// The renderer half of the render-snapshot check (ADR-015): renders every
// fixture moment through the REAL sceneStage — the very code the canvas
// and export draw with — at 480×270 (270×480 for the portrait moment) and
// hands each frame's pixels to the main process for comparison against
// the approved references. Rides inside the hidden window the export
// check boots, so the suite starts the app once. Development only; the
// dynamic import chain from App.tsx keeps it out of production builds.

import 'pixi.js/unsafe-eval';
import { Texture, WebGLRenderer } from 'pixi.js';
import type { SnapshotRunSummary } from '../../../shared/ipc';
import { REFERENCE_SIZE } from '../../../shared/scene/geometry';
import { createSceneStage } from '../scene/sceneStage';
import { createProjectStage } from '../scene/projectStage';
import {
  SNAPSHOT_SIZE,
  projectSnapshotMoments,
  snapshotAssetBytes,
  snapshotMoments
} from '../../../../tests/fixtures/snapshotProject';

export interface SnapshotRunOutcome {
  readonly ok: boolean;
  readonly summary: SnapshotRunSummary;
}

export async function runSnapshots(update: (text: string) => void): Promise<SnapshotRunOutcome> {
  // Decode the fixture pictures once; textures are shared by every moment.
  const textures = new Map<string, Texture>();
  const bitmaps: ImageBitmap[] = [];
  for (const [id, bytes] of snapshotAssetBytes()) {
    const copy = new Uint8Array(bytes);
    const bitmap = await createImageBitmap(new Blob([copy.buffer as ArrayBuffer]));
    bitmaps.push(bitmap);
    textures.set(id, Texture.from(bitmap));
  }

  // One renderer per output size (landscape and portrait moments).
  const renderers = new Map<string, WebGLRenderer>();
  const rendererFor = async (width: number, height: number): Promise<WebGLRenderer> => {
    const key = `${width}x${height}`;
    const existing = renderers.get(key);
    if (existing !== undefined) return existing;
    const renderer = new WebGLRenderer();
    await renderer.init({
      width,
      height,
      backgroundColor: 0x000000,
      backgroundAlpha: 1,
      antialias: true,
      preserveDrawingBuffer: true
    });
    renderers.set(key, renderer);
    return renderer;
  };

  /** Renders whatever a moment posed and hands it to the main process. */
  const readAndCompare = async (
    name: string,
    renderer: WebGLRenderer,
    width: number,
    height: number
  ): Promise<void> => {
    // Read the frame back through a plain 2D canvas.
    const scratch = new OffscreenCanvas(width, height);
    const ctx = scratch.getContext('2d');
    if (ctx === null) throw new Error('no 2d context for snapshot readback');
    ctx.drawImage(renderer.canvas as HTMLCanvasElement, 0, 0);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    await window.papercut.devCompareSnapshot(
      name,
      width,
      height,
      new Uint8Array(pixels.buffer as ArrayBuffer)
    );
  };

  try {
    for (const moment of snapshotMoments()) {
      update(`snapshot ${moment.name}…`);
      const size = SNAPSHOT_SIZE[moment.document.format];
      if (size === undefined) throw new Error(`no snapshot size for ${moment.document.format}`);
      const renderer = await rendererFor(size.width, size.height);
      const [refWidth] = REFERENCE_SIZE[moment.document.format];

      const scene = moment.document.scenes[0];
      if (scene === undefined) throw new Error(`moment ${moment.name} has no scene`);
      const stage = createSceneStage({ document: moment.document, scene, textures });
      stage.container.scale.set(size.width / refWidth);
      stage.update(moment.time);
      renderer.render(stage.container);
      stage.destroy();
      await readAndCompare(moment.name, renderer, size.width, size.height);
    }

    // The Phase 7 transition moments render through the REAL projectStage
    // — the very code the canvas and export compose two scenes with — at
    // a GLOBAL time inside (or just past) the transition.
    for (const moment of projectSnapshotMoments()) {
      update(`snapshot ${moment.name}…`);
      const size = SNAPSHOT_SIZE[moment.document.format];
      if (size === undefined) throw new Error(`no snapshot size for ${moment.document.format}`);
      const renderer = await rendererFor(size.width, size.height);
      const [refWidth] = REFERENCE_SIZE[moment.document.format];

      const stage = createProjectStage({ document: moment.document, textures });
      stage.container.scale.set(size.width / refWidth);
      stage.update(moment.globalTime);
      renderer.render(stage.container);
      stage.destroy();
      await readAndCompare(moment.name, renderer, size.width, size.height);
    }
  } finally {
    for (const renderer of renderers.values()) renderer.destroy();
    for (const texture of textures.values()) texture.destroy(true);
    for (const bitmap of bitmaps) bitmap.close();
  }

  const summary = await window.papercut.devFinishSnapshots();
  return { ok: summary.results.every((r) => r.status !== 'mismatch'), summary };
}
