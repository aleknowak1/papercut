// What a ♪ row carries when dragged onto the timeline's audio lanes
// (Phase 6 decision h). UI plumbing only — the document edit lives in
// shared/timeline/addToTimeline.ts, the sceneDrag.ts pattern.

export const AUDIO_DRAG_TYPE = 'application/x-papercut-audio';

export function readAudioDragAssetId(dataTransfer: DataTransfer): string | undefined {
  const raw = dataTransfer.getData(AUDIO_DRAG_TYPE);
  return raw === '' ? undefined : raw;
}
