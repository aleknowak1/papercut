// The one place the WHOLE project becomes a picture (Phase 7 decision h):
// owns one sceneStage per scene and, for a global time, poses one scene —
// or two during a transition, applying transition.ts's numbers to the
// scene stages FROM OUTSIDE (alpha, offset, scale about the frame centre,
// draw order, the wipe's mask rectangle). sceneStage itself does not
// change and does not know this file exists; the live canvas and the
// export frame source both draw through here, so a transition on screen
// is a transition in the export (ADR-006/013).
//
// Which scene(s) show and the transition's progress come from
// projectTime.ts; what the transition looks like comes from
// transition.ts. This file only applies those numbers to PixiJS objects.
//
// Works in REFERENCE pixels like sceneStage; the consumer scales
// `container` to its own pixels.

import { Container, Graphics, type Texture } from 'pixi.js';
import type { ProjectDocument } from '../../../shared/document/types';
import { referenceSize } from '../../../shared/scene/geometry';
import { scenesAtGlobalTime } from '../../../shared/timeline/projectTime';
import { transitionPose, type TransitionScenePose } from '../../../shared/transitions/transition';
import { createSceneStage, sceneImageAssetIds, type SceneStage } from './sceneStage';

export interface ProjectStage {
  /** Add this to a renderer's stage; scale it to your pixels. */
  readonly container: Container;
  /** Poses the scene(s) that show at this GLOBAL time. Call before each render. */
  update(globalSeconds: number): void;
  /**
   * One scene's own stage — how the editor keeps addressing only the
   * current scene's sprites for picking, dragging, the selection overlay
   * and the camera preview. Export never needs it.
   */
  stageFor(sceneId: string): SceneStage | undefined;
  /** Destroys the stages' own objects; textures belong to the caller. */
  destroy(): void;
}

export interface ProjectStageOptions {
  readonly document: ProjectDocument;
  /**
   * A texture per image/cutout asset id. Export passes every scene's
   * textures; the canvas passes the current scene's and its two
   * neighbours' — a scene whose textures are missing simply draws
   * without those pictures (sceneStage skips them), and the canvas
   * rebuilds this stage when a load finishes.
   */
  readonly textures: ReadonlyMap<string, Texture>;
}

const REST: TransitionScenePose = { alpha: 1, offsetX: 0, offsetY: 0, scale: 1 };

/**
 * The asset ids the canvas should hold textures for so a transition at
 * either edge of the current scene can draw in full: the current scene's
 * own pictures plus both neighbouring scenes' (the previous scene shows
 * during the transition-in window, the next during the transition-out).
 */
export function sceneAndNeighbourImageAssetIds(
  document: ProjectDocument,
  sceneId: string
): Set<string> {
  const at = document.scenes.findIndex((s) => s.id === sceneId);
  const ids = new Set<string>();
  for (const scene of [document.scenes[at - 1], document.scenes[at], document.scenes[at + 1]]) {
    if (scene === undefined) continue;
    for (const id of sceneImageAssetIds(document, scene)) ids.add(id);
  }
  return ids;
}

export function createProjectStage(options: ProjectStageOptions): ProjectStage {
  const doc = options.document;
  const frame = referenceSize(doc.format);
  const container = new Container();

  // One stage per scene, all built up front (sprites are cheap; the
  // textures decide what actually draws). Hidden until update() shows it.
  const stages = new Map<string, SceneStage>();
  for (const scene of doc.scenes) {
    const stage = createSceneStage({ document: doc, scene, textures: options.textures });
    stage.container.visible = false;
    container.addChild(stage.container);
    stages.set(scene.id, stage);
  }

  // The wipe's reveal: a rectangle masking the incoming scene. Lives in
  // the display tree (a PixiJS mask must), draws nothing on its own.
  const wipeMask = new Graphics();
  container.addChild(wipeMask);

  /** Applies one scene's transition pose — identity when at rest. */
  const pose = (stage: SceneStage, p: TransitionScenePose): void => {
    const c = stage.container;
    c.alpha = p.alpha;
    // Scale about the frame's centre: pivot there, position it back
    // (plus the pose's offset). At rest this is exactly the identity.
    c.pivot.set(frame.width / 2, frame.height / 2);
    c.position.set(frame.width / 2 + p.offsetX, frame.height / 2 + p.offsetY);
    c.scale.set(p.scale);
  };

  let masked: Container | undefined;
  const clearMask = (): void => {
    if (masked !== undefined) masked.mask = null;
    masked = undefined;
    wipeMask.clear();
  };

  return {
    container,
    update(globalSeconds: number): void {
      const showing = scenesAtGlobalTime(doc, globalSeconds);
      clearMask();
      for (const stage of stages.values()) stage.container.visible = false;
      if (showing === undefined) return;

      const outgoing = stages.get(showing.scene.id);
      if (outgoing === undefined) return;
      outgoing.container.visible = true;
      outgoing.update(showing.localSeconds);
      pose(outgoing, REST);

      const incoming = showing.incoming;
      const incomingStage = incoming !== undefined ? stages.get(incoming.scene.id) : undefined;
      if (incoming === undefined || incomingStage === undefined) return;

      // Two scenes: each at its OWN local time, posed by transition.ts.
      const type = showing.scene.transitionOut ?? 'cut';
      const numbers = transitionPose(type, incoming.progress, frame.width, frame.height);
      incomingStage.container.visible = true;
      incomingStage.update(incoming.localSeconds);
      pose(outgoing, numbers.outgoing);
      pose(incomingStage, numbers.incoming);
      // Draw order: addChild moves an existing child to the end (the top).
      const top = numbers.onTop === 'incoming' ? incomingStage : outgoing;
      const bottom = top === outgoing ? incomingStage : outgoing;
      container.addChild(bottom.container);
      container.addChild(top.container);
      if (numbers.wipeRevealPx !== undefined) {
        wipeMask.rect(0, 0, numbers.wipeRevealPx, frame.height).fill(0xffffff);
        incomingStage.container.mask = wipeMask;
        masked = incomingStage.container;
      }
    },
    stageFor(sceneId: string): SceneStage | undefined {
      return stages.get(sceneId);
    },
    destroy(): void {
      clearMask();
      for (const stage of stages.values()) stage.destroy();
      wipeMask.destroy();
      container.destroy({ children: true, texture: false });
    }
  };
}
