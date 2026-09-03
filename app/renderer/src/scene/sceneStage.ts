// The one place a scene is turned into a PixiJS picture. The live scene
// canvas shows this stage on screen; the export frame source renders the
// very same stage off-screen — so what the user sees is what exports
// (ADR-006/013). Editor-only decoration (selection outlines, handles)
// must never live in here.
//
// The stage works entirely in REFERENCE pixels (1920×1080 / 1080×1920 /
// 1080×1080, shared/scene/geometry.ts); the consumer scales the container
// to its own pixels: the export to the output resolution, the canvas to
// the space it has on screen.

import { Container, Sprite, Texture } from 'pixi.js';
import type { ProjectDocument, Scene } from '../../../shared/document/types';
import { cameraTransform, sampleCamera } from '../../../shared/animation/camera';
import { sampleLayer } from '../../../shared/animation/interpolate';
import { backgroundPlacement, referenceSize } from '../../../shared/scene/geometry';

export interface SceneStage {
  /** Add this to a renderer's stage; scale it to your pixels. */
  readonly container: Container;
  /** Poses everything for time t (seconds). Call before each render. */
  update(time: number): void;
  /** The sprite showing a layer, for the editor's selection and dragging. */
  getLayerSprite(layerId: string): Sprite | undefined;
  /** Destroys the stage's own objects; textures belong to the caller. */
  destroy(): void;
}

export interface SceneStageOptions {
  readonly document: ProjectDocument;
  readonly scene: Scene;
  /** A texture per image/cutout asset the scene uses, by asset id. */
  readonly textures: ReadonlyMap<string, Texture>;
}

interface LayerEntry {
  readonly layerId: string;
  readonly sprite: Sprite;
  /** For character layers: pose id → texture, so pose swaps are a texture change. */
  readonly poseTextures?: ReadonlyMap<string, Texture>;
  readonly defaultTexture: Texture;
}

/**
 * Builds the picture for one scene. The stage matches the document it was
 * built from; after a document edit, build a new stage (sprites are cheap,
 * textures are reused from the caller's map).
 */
export function createSceneStage(options: SceneStageOptions): SceneStage {
  const { document, scene, textures } = options;
  const frame = referenceSize(document.format);
  const container = new Container();

  // Everything the camera looks at lives in this inner container; update()
  // scales and shifts it so the camera's x/y sits at the frame centre
  // (shared/animation/camera.ts). With no camera keyframes the transform
  // is the identity. Export renders through here too, so the camera needs
  // no export code at all.
  const world = new Container();
  container.addChild(world);

  // Background, cover (default) or stretch, same arithmetic as the checks.
  if (scene.backgroundAssetId !== undefined) {
    const texture = textures.get(scene.backgroundAssetId);
    if (texture !== undefined) {
      const image = { width: texture.width, height: texture.height };
      const place = backgroundPlacement(scene.backgroundFit ?? 'cover', image, frame);
      const bg = new Sprite(texture);
      bg.position.set(place.x, place.y);
      bg.width = place.width;
      bg.height = place.height;
      world.addChild(bg);
    }
  }

  // One sprite per visible layer, in document order: layers[0] at the back.
  const entries: LayerEntry[] = [];
  for (const layer of scene.layers) {
    if (layer.hidden === true) continue; // not drawn anywhere, export included
    let defaultTexture: Texture | undefined;
    let poseTextures: Map<string, Texture> | undefined;

    if (layer.source.kind === 'prop') {
      defaultTexture = textures.get(layer.source.assetId);
    } else if (layer.source.kind === 'character') {
      const characterId = layer.source.characterId;
      const character = document.characters.find((c) => c.id === characterId);
      if (character !== undefined) {
        poseTextures = new Map();
        for (const pose of character.poses) {
          const texture = textures.get(pose.cutoutAssetId);
          if (texture !== undefined) poseTextures.set(pose.id, texture);
        }
        // A keyframe without a pose shows the character's first pose.
        defaultTexture = character.poses
          .map((p) => poseTextures?.get(p.id))
          .find((t) => t !== undefined);
      }
    }
    // Text layers are Phase 8; a layer whose picture is missing is skipped.
    if (defaultTexture === undefined) continue;

    const sprite = new Sprite(defaultTexture);
    sprite.anchor.set(0.5); // keyframe x/y is the picture's centre
    world.addChild(sprite);
    entries.push({ layerId: layer.id, sprite, poseTextures, defaultTexture });
  }

  const layerById = new Map(scene.layers.map((l) => [l.id, l]));
  const spriteByLayer = new Map(entries.map((e) => [e.layerId, e.sprite]));

  return {
    container,
    update(time: number): void {
      const camera = cameraTransform(sampleCamera(scene, time, frame), frame);
      world.scale.set(camera.scale);
      world.position.set(camera.x, camera.y);
      for (const entry of entries) {
        const layer = layerById.get(entry.layerId);
        const sample = layer && sampleLayer(layer, time);
        if (sample === undefined) {
          entry.sprite.visible = false;
          continue;
        }
        entry.sprite.visible = true;
        if (entry.poseTextures !== undefined) {
          const texture =
            (sample.poseId !== undefined ? entry.poseTextures.get(sample.poseId) : undefined) ??
            entry.defaultTexture;
          if (entry.sprite.texture !== texture) entry.sprite.texture = texture;
        }
        entry.sprite.position.set(sample.x, sample.y);
        entry.sprite.scale.set(sample.scale * (sample.flipX ? -1 : 1), sample.scale);
        entry.sprite.rotation = (sample.rotation * Math.PI) / 180; // degrees in the document
        entry.sprite.alpha = sample.opacity;
      }
    },
    getLayerSprite(layerId: string): Sprite | undefined {
      return spriteByLayer.get(layerId);
    },
    destroy(): void {
      container.destroy({ children: true, texture: false });
    }
  };
}

/**
 * The image and cutout asset ids a scene needs textures for: its
 * background and every layer's pictures (all poses of a character, so
 * pose swaps at any time can render).
 */
export function sceneImageAssetIds(document: ProjectDocument, scene: Scene): Set<string> {
  const ids = new Set<string>();
  if (scene.backgroundAssetId !== undefined) ids.add(scene.backgroundAssetId);
  for (const layer of scene.layers) {
    if (layer.hidden === true) continue;
    if (layer.source.kind === 'prop') {
      ids.add(layer.source.assetId);
    } else if (layer.source.kind === 'character') {
      const characterId = layer.source.characterId;
      const character = document.characters.find((c) => c.id === characterId);
      for (const pose of character?.poses ?? []) ids.add(pose.cutoutAssetId);
    }
  }
  return ids;
}
