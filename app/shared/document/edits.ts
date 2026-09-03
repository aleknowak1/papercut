// Every change to a project goes through a function in this file. Each one
// returns a NEW document and never touches the old one, copying only the
// parts on the path to the change and sharing everything else by reference
// (structural sharing). That is what makes the undo history in history.ts
// cheap: an unchanged scene, layer, or asset is the same object in every
// history entry, not a duplicate.

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

export function removeScene(doc: ProjectDocument, sceneId: string): ProjectDocument {
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
  return replaceScene(doc, sceneId, (s) => ({ ...s, transitionOut }));
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

export function removeKeyframe(
  doc: ProjectDocument,
  sceneId: string,
  layerId: string,
  time: number
): ProjectDocument {
  return replaceScene(doc, sceneId, (scene) =>
    replaceLayer(scene, layerId, (layer) => ({
      ...layer,
      keyframes: layer.keyframes.filter((k) => k.time !== time)
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

export function removeCameraKeyframe(
  doc: ProjectDocument,
  sceneId: string,
  time: number
): ProjectDocument {
  return replaceScene(doc, sceneId, (scene) => ({
    ...scene,
    cameraKeyframes: scene.cameraKeyframes.filter((k) => k.time !== time)
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
