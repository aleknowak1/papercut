// The project-wide timing model (Phase 7, decision e): scenes OVERLAP at
// a transition — a transition of length t starts the next scene t seconds
// before this one ends, so the total is the sum of scene durations minus
// the transition lengths. This file is the ONE place that arithmetic
// lives: the effective transition lengths, each scene's global start, the
// total, global ↔ (scene, local time) both ways, and which scene(s) show
// at a global moment. The renderer (projectStage), export, and the
// timeline all consume these numbers; none of them repeat the arithmetic.
//
// Pure: no browser APIs, everything tested under plain Node.

import { floorToFrame } from '../animation/time';
import type { ProjectDocument, Scene } from '../document/types';

export const MIN_TRANSITION_SECONDS = 0.1;
export const MAX_TRANSITION_SECONDS = 3;
/** What an absent transitionOutSeconds means (Phase 7 decision f). */
export const DEFAULT_TRANSITION_SECONDS = 0.5;

/**
 * A wanted transition length made legal: clamped to 0.1–3 s, then to half
 * the shorter of the two scenes it joins (when the next scene's duration
 * is given), then snapped DOWN to a whole frame — down, never to the
 * nearest, so the clamps' limits are never rounded past and every scene's
 * global start lands on an exact frame. The edit that sets the length and
 * the timing model below both use exactly this function.
 */
export function clampTransitionLength(
  seconds: number,
  durationSeconds: number,
  nextDurationSeconds: number | undefined,
  fps: number
): number {
  let clamped = Math.min(Math.max(seconds, MIN_TRANSITION_SECONDS), MAX_TRANSITION_SECONDS);
  if (nextDurationSeconds !== undefined) {
    clamped = Math.min(clamped, Math.min(durationSeconds, nextDurationSeconds) / 2);
  }
  return Math.max(0, floorToFrame(clamped, fps));
}

/**
 * How long scene i really overlaps scene i+1: zero for the last scene,
 * zero for a cut (an absent transitionOut means cut), otherwise the
 * stored (or default 0.5 s) length clamped by clampTransitionLength — so
 * a hand-edited file or a later change to a neighbour's duration can
 * never break the arithmetic.
 */
export function effectiveTransitionSeconds(doc: ProjectDocument, sceneIndex: number): number {
  const scene = doc.scenes[sceneIndex];
  const next = doc.scenes[sceneIndex + 1];
  if (scene === undefined || next === undefined) return 0;
  if (scene.transitionOut === undefined || scene.transitionOut === 'cut') return 0;
  return clampTransitionLength(
    scene.transitionOutSeconds ?? DEFAULT_TRANSITION_SECONDS,
    scene.durationSeconds,
    next.durationSeconds,
    doc.fps
  );
}

/** Every scene's global start, in seconds: start(0) = 0, and each scene
    begins t seconds before the previous one ends. */
export function sceneStartSeconds(doc: ProjectDocument): number[] {
  const starts: number[] = [];
  let at = 0;
  for (let i = 0; i < doc.scenes.length; i++) {
    starts.push(at);
    const scene = doc.scenes[i];
    if (scene !== undefined) at += scene.durationSeconds - effectiveTransitionSeconds(doc, i);
  }
  return starts;
}

/** The whole video's length: the last scene's start plus its duration —
    equal to the sum of durations minus the transition lengths. */
export function projectDurationSeconds(doc: ProjectDocument): number {
  const last = doc.scenes[doc.scenes.length - 1];
  if (last === undefined) return 0;
  const starts = sceneStartSeconds(doc);
  return (starts[starts.length - 1] ?? 0) + last.durationSeconds;
}

/** A scene's local time as a global time. */
export function localToGlobal(doc: ProjectDocument, sceneIndex: number, localSeconds: number): number {
  return (sceneStartSeconds(doc)[sceneIndex] ?? 0) + localSeconds;
}

/**
 * What shows at a global time: the scene on screen and its local time,
 * and — during a transition — the incoming scene too, with the
 * transition's progress 0..1. `scene` is always the one whose transition
 * is running (the outgoing scene during an overlap); before 0 and past
 * the end the nearest end clamps.
 */
export interface ShowingScenes {
  readonly sceneIndex: number;
  readonly scene: Scene;
  readonly localSeconds: number;
  /** Set only during a transition's overlap window. */
  readonly incoming?: {
    readonly sceneIndex: number;
    readonly scene: Scene;
    readonly localSeconds: number;
    /** 0 as the overlap begins, 1 as the outgoing scene ends. */
    readonly progress: number;
  };
}

export function scenesAtGlobalTime(doc: ProjectDocument, globalSeconds: number): ShowingScenes | undefined {
  if (doc.scenes.length === 0) return undefined;
  const starts = sceneStartSeconds(doc);
  // The scene whose window [start, start + duration) holds the time —
  // scanned from the front, so during an overlap this finds the OUTGOING
  // scene (it started earlier). Past the end, the last scene clamps.
  let index = doc.scenes.length - 1;
  for (let i = 0; i < doc.scenes.length; i++) {
    const start = starts[i] ?? 0;
    const scene = doc.scenes[i];
    if (scene === undefined) continue;
    if (globalSeconds < start + scene.durationSeconds || i === doc.scenes.length - 1) {
      index = i;
      break;
    }
  }
  const scene = doc.scenes[index];
  const start = starts[index] ?? 0;
  if (scene === undefined) return undefined;
  const local = Math.min(Math.max(globalSeconds - start, 0), scene.durationSeconds);

  const t = effectiveTransitionSeconds(doc, index);
  const nextStart = starts[index + 1];
  const next = doc.scenes[index + 1];
  if (t > 0 && next !== undefined && nextStart !== undefined && globalSeconds >= nextStart) {
    return {
      sceneIndex: index,
      scene,
      localSeconds: local,
      incoming: {
        sceneIndex: index + 1,
        scene: next,
        localSeconds: globalSeconds - nextStart,
        progress: Math.min(Math.max((globalSeconds - nextStart) / t, 0), 1)
      }
    };
  }
  return { sceneIndex: index, scene, localSeconds: local };
}
