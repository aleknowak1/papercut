// The one place sounds are added to the timeline (Phase 6 decision h, the
// Phase 4b pattern): the "Add to timeline" button on a ♪ row (the clip
// lands at the playhead) and dropping the row onto the audio lanes (it
// lands at the drop time) both call this — so every road onto the
// timeline produces exactly the same document, and the check proves the
// mapping once.

import { newId } from '../document/create';
import { addAudioClip } from '../document/edits';
import { snapToFrame } from '../animation/time';
import type { AudioClip, ProjectDocument } from '../document/types';

export interface AddedClip {
  readonly doc: ProjectDocument;
  readonly clipId: string;
}

/**
 * Adds a sound asset to the scene's timeline as a new clip starting at
 * `atSeconds` (frame-snapped, never below 0), full volume, no fades, no
 * trim — the whole sound plays. One addAudioClip edit — one undo step for
 * the caller's applyEdit. Anything but a real audio asset adds nothing.
 */
export function addSoundToTimeline(
  doc: ProjectDocument,
  sceneId: string,
  audioAssetId: string,
  atSeconds: number
): AddedClip | undefined {
  const asset = doc.assets.find((a) => a.id === audioAssetId && a.type === 'audio');
  const scene = doc.scenes.find((s) => s.id === sceneId);
  if (asset === undefined || scene === undefined) return undefined;
  const clip: AudioClip = {
    id: newId(),
    source: { kind: 'asset', assetId: asset.id },
    startSeconds: Math.max(0, snapToFrame(atSeconds, doc.fps)),
    volume: 1,
    fadeInSeconds: 0,
    fadeOutSeconds: 0
  };
  return { doc: addAudioClip(doc, sceneId, clip), clipId: clip.id };
}
