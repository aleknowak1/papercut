// Every change to a project goes through a function in this file. Each one
// returns a NEW document and never touches the old one, copying only the
// parts on the path to the change and sharing everything else by reference
// (structural sharing). That is what makes the undo history in history.ts
// cheap: an unchanged scene, layer, or asset is the same object in every
// history entry, not a duplicate.

import { secondsOf, snapToFrame } from '../animation/time';
import { clampTransitionLength } from '../timeline/projectTime';
import { newId } from './create';
import type {
  Asset,
  AudioClip,
  BackgroundFit,
  CameraKeyframe,
  Character,
  Keyframe,
  Layer,
  Pose,
  ProjectDocument,
  Scene,
  TransitionType
} from './types';

function replaceScene(
  doc: ProjectDocument,
  sceneId: string,
  update: (scene: Scene) => Scene
): ProjectDocument {
  return {
    ...doc,
    scenes: doc.scenes.map((s) => (s.id === sceneId ? update(s) : s))
  };
}

function replaceLayer(
  scene: Scene,
  layerId: string,
  update: (layer: Layer) => Layer
): Scene {
  return {
    ...scene,
    layers: scene.layers.map((l) => (l.id === layerId ? update(l) : l))
  };
}

// ---- project ----

export function setProjectName(doc: ProjectDocument, name: string): ProjectDocument {
  return { ...doc, name };
}

// ---- assets and characters ----

export function addAsset(doc: ProjectDocument, asset: Asset): ProjectDocument {
  return { ...doc, assets: [...doc.assets, asset] };
}

/**
 * Points a cutout asset at a different file — the ONE document edit a mask
 * save (or HD run, or reset-to-automatic) makes, so document undo/redo just
 * repoints between version files that all still exist (DOC-13 hand-off
 * design; tidying old versions is OQ-021). `automaticFile` remembers the
 * original automatic cutout the first time the asset moves away from it.
 */
export function repointCutout(
  doc: ProjectDocument,
  assetId: string,
  newFile: string,
  automaticFile: string
): ProjectDocument {
  return {
    ...doc,
    assets: doc.assets.map((a) =>
      a.id === assetId
        ? { ...a, file: newFile, metadata: { ...a.metadata, automaticFile } }
        : a
    )
  };
}

export function addCharacter(doc: ProjectDocument, character: Character): ProjectDocument {
  return { ...doc, characters: [...doc.characters, character] };
}

function replaceCharacter(
  doc: ProjectDocument,
  characterId: string,
  update: (character: Character) => Character
): ProjectDocument {
  return {
    ...doc,
    characters: doc.characters.map((c) => (c.id === characterId ? update(c) : c))
  };
}

export function renameCharacter(
  doc: ProjectDocument,
  characterId: string,
  name: string
): ProjectDocument {
  return replaceCharacter(doc, characterId, (c) => ({ ...c, name }));
}

export function removeCharacter(doc: ProjectDocument, characterId: string): ProjectDocument {
  return { ...doc, characters: doc.characters.filter((c) => c.id !== characterId) };
}

// ---- poses (a character is a named group of cutouts, DOC-03 §3) ----

export function addPose(doc: ProjectDocument, characterId: string, pose: Pose): ProjectDocument {
  return replaceCharacter(doc, characterId, (c) => ({ ...c, poses: [...c.poses, pose] }));
}

export function renamePose(
  doc: ProjectDocument,
  characterId: string,
  poseId: string,
  name: string
): ProjectDocument {
  return replaceCharacter(doc, characterId, (c) => ({
    ...c,
    poses: c.poses.map((p) => (p.id === poseId ? { ...p, name } : p))
  }));
}

/** Moves a pose to a new position in its character's list (clamped). */
export function reorderPose(
  doc: ProjectDocument,
  characterId: string,
  poseId: string,
  newIndex: number
): ProjectDocument {
  return replaceCharacter(doc, characterId, (c) => {
    const from = c.poses.findIndex((p) => p.id === poseId);
    if (from < 0) return c;
    const to = Math.max(0, Math.min(c.poses.length - 1, newIndex));
    if (to === from) return c;
    const poses = [...c.poses];
    const [moved] = poses.splice(from, 1);
    if (moved === undefined) return c;
    poses.splice(to, 0, moved);
    return { ...c, poses };
  });
}

export function removePose(
  doc: ProjectDocument,
  characterId: string,
  poseId: string
): ProjectDocument {
  return replaceCharacter(doc, characterId, (c) => ({
    ...c,
    poses: c.poses.filter((p) => p.id !== poseId)
  }));
}

// ---- scenes ----

export function addScene(doc: ProjectDocument, scene: Scene): ProjectDocument {
  return { ...doc, scenes: [...doc.scenes, scene] };
}

/**
 * Inserts a scene right after another one — how "+ Scene" places its new
 * scene beside the selected one (Phase 7 decision b). An unknown
 * afterSceneId returns the SAME document, so no empty undo step.
 */
export function insertScene(
  doc: ProjectDocument,
  afterSceneId: string,
  scene: Scene
): ProjectDocument {
  const at = doc.scenes.findIndex((s) => s.id === afterSceneId);
  if (at < 0) return doc;
  const scenes = [...doc.scenes];
  scenes.splice(at + 1, 0, scene);
  return { ...doc, scenes };
}

/**
 * Copies a whole scene — layers, keyframes, camera, clips, background,
 * transition — with fresh ids for the scene, its layers and its clips
 * (keyframes carry no ids), inserted right after the original. A clip
 * attached to one of the scene's own layers follows that layer's new id.
 * `makeId` exists so tests can pass a deterministic id maker; the app
 * uses the default. An unknown scene returns the SAME document.
 */
export function duplicateScene(
  doc: ProjectDocument,
  sceneId: string,
  makeId: () => string = newId
): ProjectDocument {
  const at = doc.scenes.findIndex((s) => s.id === sceneId);
  const scene = doc.scenes[at];
  if (at < 0 || scene === undefined) return doc;
  const newLayerIds = new Map(scene.layers.map((l) => [l.id, makeId()]));
  const copy: Scene = {
    ...scene,
    id: makeId(),
    name: `${scene.name} copy`,
    layers: scene.layers.map((l) => ({ ...l, id: newLayerIds.get(l.id) ?? l.id })),
    audioClips: scene.audioClips.map((c) => ({
      ...c,
      id: makeId(),
      ...(c.attachedToLayerId !== undefined && newLayerIds.has(c.attachedToLayerId)
        ? { attachedToLayerId: newLayerIds.get(c.attachedToLayerId) }
        : {})
    }))
  };
  const scenes = [...doc.scenes];
  scenes.splice(at + 1, 0, copy);
  return { ...doc, scenes };
}

/**
 * Moves a scene one place earlier (-1) or later (+1) in play order — the
 * strip's ◀ ▶ buttons, one undo step each. The scene takes its
 * transitionOut with it (the transition lives on the scene). A move past
 * either end, or of an unknown scene, returns the SAME document.
 */
export function reorderScene(
  doc: ProjectDocument,
  sceneId: string,
  direction: -1 | 1
): ProjectDocument {
  const from = doc.scenes.findIndex((s) => s.id === sceneId);
  if (from < 0) return doc;
  const to = from + direction;
  if (to < 0 || to >= doc.scenes.length) return doc;
  const scenes = [...doc.scenes];
  const [moved] = scenes.splice(from, 1);
  if (moved === undefined) return doc;
  scenes.splice(to, 0, moved);
  return { ...doc, scenes };
}

/**
 * Removes a scene — REFUSING the last one: a project always has a scene
 * (Phase 7 decision b). The rule lives here, not just on the strip's ✕
 * button, because the agent (ADR-011) will one day call this directly.
 * Refusal, or an unknown scene, returns the SAME document.
 */
export function removeScene(doc: ProjectDocument, sceneId: string): ProjectDocument {
  if (doc.scenes.length <= 1 || !doc.scenes.some((s) => s.id === sceneId)) return doc;
  return { ...doc, scenes: doc.scenes.filter((s) => s.id !== sceneId) };
}

export function renameScene(doc: ProjectDocument, sceneId: string, name: string): ProjectDocument {
  return replaceScene(doc, sceneId, (s) => ({ ...s, name }));
}

export function setSceneDuration(
  doc: ProjectDocument,
  sceneId: string,
  durationSeconds: number
): ProjectDocument {
  return replaceScene(doc, sceneId, (s) => ({ ...s, durationSeconds }));
}

export function setSceneBackground(
  doc: ProjectDocument,
  sceneId: string,
  backgroundAssetId: string | undefined
): ProjectDocument {
  return replaceScene(doc, sceneId, (s) => ({ ...s, backgroundAssetId }));
}

export function setSceneBackgroundFit(
  doc: ProjectDocument,
  sceneId: string,
  backgroundFit: BackgroundFit
): ProjectDocument {
  return replaceScene(doc, sceneId, (s) => ({ ...s, backgroundFit }));
}

export function setSceneTransition(
  doc: ProjectDocument,
  sceneId: string,
  transitionOut: TransitionType | undefined
): ProjectDocument {
  const scene = doc.scenes.find((s) => s.id === sceneId);
  if (scene === undefined || scene.transitionOut === transitionOut) return doc;
  return replaceScene(doc, sceneId, (s) => ({ ...s, transitionOut }));
}

/**
 * Sets how long a scene's transition into the next scene runs. The wanted
 * length is made legal by the ONE shared clamp (timeline/projectTime.ts):
 * 0.1–3 s, at most half the shorter of the two scenes it joins, then
 * snapped DOWN to a whole frame so every scene's global start lands on an
 * exact frame. On the last scene only the 0.1–3 s clamp applies (the
 * value is kept but ignored until a scene follows). A length that changes
 * nothing, a nonsense number, or an unknown scene returns the SAME
 * document — no empty undo step.
 */
export function setSceneTransitionLength(
  doc: ProjectDocument,
  sceneId: string,
  seconds: number
): ProjectDocument {
  const at = doc.scenes.findIndex((s) => s.id === sceneId);
  const scene = doc.scenes[at];
  if (scene === undefined || !Number.isFinite(seconds)) return doc;
  const next = clampTransitionLength(
    seconds,
    scene.durationSeconds,
    doc.scenes[at + 1]?.durationSeconds,
    doc.fps
  );
  if (!(next > 0) || next === scene.transitionOutSeconds) return doc;
  return replaceScene(doc, sceneId, (s) => ({ ...s, transitionOutSeconds: next }));
}

// ---- layers ----

export function addLayer(doc: ProjectDocument, sceneId: string, layer: Layer): ProjectDocument {
  return replaceScene(doc, sceneId, (s) => ({ ...s, layers: [...s.layers, layer] }));
}

export function removeLayer(doc: ProjectDocument, sceneId: string, layerId: string): ProjectDocument {
  return replaceScene(doc, sceneId, (s) => ({
    ...s,
    layers: s.layers.filter((l) => l.id !== layerId)
  }));
}

/**
 * Moves a layer to a new position in its scene's list (clamped). layers[0]
 * is at the back of the picture; the last entry is front-most.
 */
export function reorderLayer(
  doc: ProjectDocument,
  sceneId: string,
  layerId: string,
  newIndex: number
): ProjectDocument {
  return replaceScene(doc, sceneId, (scene) => {
    const from = scene.layers.findIndex((l) => l.id === layerId);
    if (from < 0) return scene;
    const to = Math.max(0, Math.min(scene.layers.length - 1, newIndex));
    if (to === from) return scene;
    const layers = [...scene.layers];
    const [moved] = layers.splice(from, 1);
    if (moved === undefined) return scene;
    layers.splice(to, 0, moved);
    return { ...scene, layers };
  });
}

/** A hidden layer is not drawn anywhere — editor and export alike. */
export function setLayerHidden(
  doc: ProjectDocument,
  sceneId: string,
  layerId: string,
  hidden: boolean
): ProjectDocument {
  return replaceScene(doc, sceneId, (scene) =>
    replaceLayer(scene, layerId, (l) => ({ ...l, hidden }))
  );
}

/** A locked layer still renders; it only refuses selection and dragging. */
export function setLayerLocked(
  doc: ProjectDocument,
  sceneId: string,
  layerId: string,
  locked: boolean
): ProjectDocument {
  return replaceScene(doc, sceneId, (scene) =>
    replaceLayer(scene, layerId, (l) => ({ ...l, locked }))
  );
}

/**
 * Adds a keyframe to a layer, keeping keyframes sorted by time. A keyframe
 * at exactly the same time replaces the existing one.
 */
export function setKeyframe(
  doc: ProjectDocument,
  sceneId: string,
  layerId: string,
  keyframe: Keyframe
): ProjectDocument {
  return replaceScene(doc, sceneId, (scene) =>
    replaceLayer(scene, layerId, (layer) => {
      const others = layer.keyframes.filter((k) => k.time !== keyframe.time);
      const keyframes = [...others, keyframe].sort((a, b) => a.time - b.time);
      return { ...layer, keyframes };
    })
  );
}

/**
 * Writes many keyframes to one layer in ONE edit — how a motion preset
 * bakes in as a single undo step (Phase 5 decision d). Existing keyframes
 * at the same times are replaced; all others are kept.
 */
export function applyKeyframes(
  doc: ProjectDocument,
  sceneId: string,
  layerId: string,
  keyframes: readonly Keyframe[]
): ProjectDocument {
  if (keyframes.length === 0) return doc;
  return replaceScene(doc, sceneId, (scene) =>
    replaceLayer(scene, layerId, (layer) => {
      const times = new Set(keyframes.map((k) => k.time));
      const merged = [...layer.keyframes.filter((k) => !times.has(k.time)), ...keyframes].sort(
        (a, b) => a.time - b.time
      );
      return { ...layer, keyframes: merged };
    })
  );
}

/**
 * Removes a layer's keyframe at exactly this time. The LAST keyframe
 * cannot be deleted — a layer always stands somewhere — and the rule
 * lives here, not just on the panel's button, because the agent
 * (ADR-011) will one day call this edit directly. Removing nothing (no
 * keyframe at that time, or the last one) returns the SAME document, so
 * no empty undo step is recorded.
 */
export function removeKeyframe(
  doc: ProjectDocument,
  sceneId: string,
  layerId: string,
  time: number
): ProjectDocument {
  const layer = doc.scenes
    .find((s) => s.id === sceneId)
    ?.layers.find((l) => l.id === layerId);
  if (
    layer === undefined ||
    layer.keyframes.length <= 1 ||
    !layer.keyframes.some((k) => k.time === time)
  ) {
    return doc;
  }
  return replaceScene(doc, sceneId, (scene) =>
    replaceLayer(scene, layerId, (l) => ({
      ...l,
      keyframes: l.keyframes.filter((k) => k.time !== time)
    }))
  );
}

/**
 * Moves a layer's keyframe from one time to another, keeping every other
 * value. The destination is snapped to a whole frame and REFUSED when
 * another keyframe already sits on that frame — the timeline drag stops
 * beside it (Phase 6 decision c). The rule lives in the edit itself, not
 * just the drag, because the agent (ADR-011) will one day call this
 * directly. A refused or pointless move returns the SAME document, so no
 * empty undo step is recorded.
 */
export function moveKeyframe(
  doc: ProjectDocument,
  sceneId: string,
  layerId: string,
  fromTime: number,
  toTime: number
): ProjectDocument {
  const layer = doc.scenes
    .find((s) => s.id === sceneId)
    ?.layers.find((l) => l.id === layerId);
  const moving = layer?.keyframes.find((k) => k.time === fromTime);
  if (layer === undefined || moving === undefined) return doc;
  const to = Math.max(0, snapToFrame(toTime, doc.fps));
  if (to === fromTime || layer.keyframes.some((k) => k.time === to)) return doc;
  return replaceScene(doc, sceneId, (scene) =>
    replaceLayer(scene, layerId, (l) => ({
      ...l,
      keyframes: [...l.keyframes.filter((k) => k !== moving), { ...moving, time: to }].sort(
        (a, b) => a.time - b.time
      )
    }))
  );
}

// ---- camera ----

/**
 * Adds a camera keyframe to a scene, keeping them sorted by time. A
 * keyframe at exactly the same time replaces the existing one — the same
 * rule as setKeyframe for layers.
 */
export function setCameraKeyframe(
  doc: ProjectDocument,
  sceneId: string,
  keyframe: CameraKeyframe
): ProjectDocument {
  return replaceScene(doc, sceneId, (scene) => {
    const others = scene.cameraKeyframes.filter((k) => k.time !== keyframe.time);
    const cameraKeyframes = [...others, keyframe].sort((a, b) => a.time - b.time);
    return { ...scene, cameraKeyframes };
  });
}

/**
 * Removes the camera keyframe at exactly this time. Unlike layers, the
 * last one MAY go — no camera keyframes just means the whole frame shows.
 * Removing nothing returns the same document (no empty undo step).
 */
export function removeCameraKeyframe(
  doc: ProjectDocument,
  sceneId: string,
  time: number
): ProjectDocument {
  const scene = doc.scenes.find((s) => s.id === sceneId);
  if (scene === undefined || !scene.cameraKeyframes.some((k) => k.time === time)) return doc;
  return replaceScene(doc, sceneId, (s) => ({
    ...s,
    cameraKeyframes: s.cameraKeyframes.filter((k) => k.time !== time)
  }));
}

/**
 * Moves a camera keyframe in time — the same rules as moveKeyframe: the
 * destination snaps to a whole frame, an occupied frame is refused, and a
 * refused or pointless move returns the same document.
 */
export function moveCameraKeyframe(
  doc: ProjectDocument,
  sceneId: string,
  fromTime: number,
  toTime: number
): ProjectDocument {
  const scene = doc.scenes.find((s) => s.id === sceneId);
  const moving = scene?.cameraKeyframes.find((k) => k.time === fromTime);
  if (scene === undefined || moving === undefined) return doc;
  const to = Math.max(0, snapToFrame(toTime, doc.fps));
  if (to === fromTime || scene.cameraKeyframes.some((k) => k.time === to)) return doc;
  return replaceScene(doc, sceneId, (s) => ({
    ...s,
    cameraKeyframes: [...s.cameraKeyframes.filter((k) => k !== moving), { ...moving, time: to }].sort(
      (a, b) => a.time - b.time
    )
  }));
}

// ---- audio ----

export function addAudioClip(
  doc: ProjectDocument,
  sceneId: string,
  clip: AudioClip
): ProjectDocument {
  return replaceScene(doc, sceneId, (s) => ({ ...s, audioClips: [...s.audioClips, clip] }));
}

export function removeAudioClip(
  doc: ProjectDocument,
  sceneId: string,
  clipId: string
): ProjectDocument {
  return replaceScene(doc, sceneId, (s) => ({
    ...s,
    audioClips: s.audioClips.filter((c) => c.id !== clipId)
  }));
}

function findAudioClip(
  doc: ProjectDocument,
  sceneId: string,
  clipId: string
): AudioClip | undefined {
  return doc.scenes.find((s) => s.id === sceneId)?.audioClips.find((c) => c.id === clipId);
}

function replaceAudioClip(
  doc: ProjectDocument,
  sceneId: string,
  clipId: string,
  update: (clip: AudioClip) => AudioClip
): ProjectDocument {
  return replaceScene(doc, sceneId, (s) => ({
    ...s,
    audioClips: s.audioClips.map((c) => (c.id === clipId ? update(c) : c))
  }));
}

/**
 * Moves an audio clip to a new start time, snapped to a whole frame and
 * never below 0. Moving a clip to where it already sits (or a clip that
 * does not exist) returns the SAME document — no empty undo step.
 */
export function moveAudioClip(
  doc: ProjectDocument,
  sceneId: string,
  clipId: string,
  startSeconds: number
): ProjectDocument {
  const clip = findAudioClip(doc, sceneId, clipId);
  if (clip === undefined) return doc;
  const start = Math.max(0, snapToFrame(startSeconds, doc.fps));
  if (start === clip.startSeconds) return doc;
  return replaceAudioClip(doc, sceneId, clipId, (c) => ({ ...c, startSeconds: start }));
}

/**
 * Trims an audio clip: how far into its sound it begins, and how much of
 * the sound plays. Both are snapped to whole frames and then clamped so
 * the clip can never reach outside the sound's real extent — the caller
 * passes the sound's true length (sourceDurationSeconds). The clamp wins
 * over the snap at the sound's edges, so the last sliver of a sound stays
 * reachable even when it is shorter than one frame. A trim that changes
 * nothing returns the same document.
 */
export function trimAudioClip(
  doc: ProjectDocument,
  sceneId: string,
  clipId: string,
  trimStartSeconds: number,
  durationSeconds: number,
  sourceDurationSeconds: number
): ProjectDocument {
  const clip = findAudioClip(doc, sceneId, clipId);
  if (clip === undefined || !(sourceDurationSeconds > 0)) return doc;
  const minLength = Math.min(secondsOf(1, doc.fps), sourceDurationSeconds);
  const start = Math.min(
    Math.max(snapToFrame(trimStartSeconds, doc.fps), 0),
    sourceDurationSeconds - minLength
  );
  const length = Math.min(
    Math.max(snapToFrame(durationSeconds, doc.fps), minLength),
    sourceDurationSeconds - start
  );
  const currentStart = clip.trimStartSeconds ?? 0;
  const currentLength = clip.durationSeconds ?? sourceDurationSeconds - currentStart;
  if (start === currentStart && length === currentLength) return doc;
  return replaceAudioClip(doc, sceneId, clipId, (c) => ({
    ...c,
    trimStartSeconds: start,
    durationSeconds: length
  }));
}

/** Sets a clip's volume, clamped to 0..1. No change, same document. */
export function setAudioClipVolume(
  doc: ProjectDocument,
  sceneId: string,
  clipId: string,
  volume: number
): ProjectDocument {
  const clip = findAudioClip(doc, sceneId, clipId);
  if (clip === undefined) return doc;
  const next = Math.min(Math.max(volume, 0), 1);
  if (next === clip.volume) return doc;
  return replaceAudioClip(doc, sceneId, clipId, (c) => ({ ...c, volume: next }));
}

/**
 * Sets a clip's fade-in length, clamped so the two fades together never
 * exceed the clip's played length (clipLengthSeconds — the caller passes
 * the length after trim). No change, same document.
 */
export function setAudioClipFadeIn(
  doc: ProjectDocument,
  sceneId: string,
  clipId: string,
  fadeInSeconds: number,
  clipLengthSeconds: number
): ProjectDocument {
  const clip = findAudioClip(doc, sceneId, clipId);
  if (clip === undefined) return doc;
  const room = Math.max(0, clipLengthSeconds - clip.fadeOutSeconds);
  const next = Math.min(Math.max(fadeInSeconds, 0), room);
  if (next === clip.fadeInSeconds) return doc;
  return replaceAudioClip(doc, sceneId, clipId, (c) => ({ ...c, fadeInSeconds: next }));
}

/** Sets a clip's fade-out length — the mirror of setAudioClipFadeIn. */
export function setAudioClipFadeOut(
  doc: ProjectDocument,
  sceneId: string,
  clipId: string,
  fadeOutSeconds: number,
  clipLengthSeconds: number
): ProjectDocument {
  const clip = findAudioClip(doc, sceneId, clipId);
  if (clip === undefined) return doc;
  const room = Math.max(0, clipLengthSeconds - clip.fadeInSeconds);
  const next = Math.min(Math.max(fadeOutSeconds, 0), room);
  if (next === clip.fadeOutSeconds) return doc;
  return replaceAudioClip(doc, sceneId, clipId, (c) => ({ ...c, fadeOutSeconds: next }));
}
