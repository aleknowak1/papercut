// Every change to a project goes through a function in this file. Each one
// returns a NEW document and never touches the old one, copying only the
// parts on the path to the change and sharing everything else by reference
// (structural sharing). That is what makes the undo history in history.ts
// cheap: an unchanged scene, layer, or asset is the same object in every
// history entry, not a duplicate.

import type {
  Asset,
  AudioClip,
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
