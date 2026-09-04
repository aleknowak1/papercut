// The one road onto the timeline (Phase 6 decision h, ADR-015): the ♪
// row's "Add to timeline" button and dropping the row onto the lanes both
// call addSoundToTimeline, so this check proves the mapping once — the
// clip lands frame-snapped where asked, whole and at full volume, is one
// undo step, survives save/reopen, and anything but a real sound adds
// nothing. The waveform-peak arithmetic (decision k) is proven here too.

import { describe, expect, it } from 'vitest';
import { createProject, loadProject, saveProject } from '../../app/main/projectStore';
import { addSoundToTimeline } from '../../app/shared/timeline/addToTimeline';
import { waveformPeaks } from '../../app/shared/timeline/peaks';
import { applyEdit, createHistory, undo } from '../../app/shared/document/history';
import type { ProjectDocument } from '../../app/shared/document/types';
import { sampleProject } from '../helpers/sampleProject';
import { suiteOutputDirs } from '../helpers/testOutput';

const tempDir = suiteOutputDirs('timeline');

function audioAssetId(doc: ProjectDocument): string {
  return doc.assets.find((a) => a.type === 'audio')!.id;
}

describe('addSoundToTimeline', () => {
  it('lands the clip frame-snapped at the asked time, whole and at full volume', () => {
    const doc = sampleProject();
    const sceneId = doc.scenes[0]!.id;
    const added = addSoundToTimeline(doc, sceneId, audioAssetId(doc), 1.234);
    expect(added).toBeDefined();
    const clip = added!.doc.scenes[0]!.audioClips.find((c) => c.id === added!.clipId)!;
    expect(clip.startSeconds).toBe(37 / 30); // 1.234 s → frame 37 at 30 fps
    expect(clip.volume).toBe(1);
    expect(clip.fadeInSeconds).toBe(0);
    expect(clip.fadeOutSeconds).toBe(0);
    expect(clip.trimStartSeconds).toBeUndefined(); // untrimmed: the whole sound
    expect(clip.durationSeconds).toBeUndefined();
    expect(clip.source).toEqual({ kind: 'asset', assetId: audioAssetId(doc) });
  });

  it('never starts before 0', () => {
    const doc = sampleProject();
    const added = addSoundToTimeline(doc, doc.scenes[0]!.id, audioAssetId(doc), -3);
    expect(added!.doc.scenes[0]!.audioClips.at(-1)!.startSeconds).toBe(0);
  });

  it('both roads (button at the playhead, drop at the drop time) give the same document shape', () => {
    const doc = sampleProject();
    const sceneId = doc.scenes[0]!.id;
    const viaButton = addSoundToTimeline(doc, sceneId, audioAssetId(doc), 2.5)!;
    const viaDrop = addSoundToTimeline(doc, sceneId, audioAssetId(doc), 2.5)!;
    // Identical apart from the fresh clip id: normalise the ids and compare
    // the WHOLE documents byte for byte.
    const normalise = (d: ProjectDocument, clipId: string): string =>
      JSON.stringify(d).split(clipId).join('CLIP');
    expect(normalise(viaButton.doc, viaButton.clipId)).toBe(normalise(viaDrop.doc, viaDrop.clipId));
  });

  it('refuses a missing asset, a non-audio asset, and a missing scene', () => {
    const doc = sampleProject();
    const sceneId = doc.scenes[0]!.id;
    const imageId = doc.assets.find((a) => a.type === 'image')!.id;
    expect(addSoundToTimeline(doc, sceneId, 'nope', 0)).toBeUndefined();
    expect(addSoundToTimeline(doc, sceneId, imageId, 0)).toBeUndefined();
    expect(addSoundToTimeline(doc, 'nope', audioAssetId(doc), 0)).toBeUndefined();
  });

  it('is one undo step and round-trips save/reopen', () => {
    const dir = tempDir();
    const doc = sampleProject();
    const sceneId = doc.scenes[0]!.id;
    const before = doc.scenes[0]!.audioClips.length;
    let history = createHistory(doc);
    const added = addSoundToTimeline(history.present, sceneId, audioAssetId(doc), 4)!;
    history = applyEdit(history, added.doc);
    expect(history.present.scenes[0]!.audioClips.length).toBe(before + 1);

    const projectDir = createProject(dir, 'Add To Timeline', history.present.format);
    saveProject(projectDir, history.present);
    expect(loadProject(projectDir)).toEqual(history.present);

    history = undo(history);
    expect(history.present).toEqual(doc);
    expect(history.present.scenes[0]!.audioClips.length).toBe(before);
  });
});

describe('waveformPeaks', () => {
  it('takes the loudest absolute value in each bucket', () => {
    // Values chosen to be exact in 32-bit floats.
    const samples = new Float32Array([0.125, -0.875, 0.25, 0.375, -0.125, 0.5, 0, 0.0625]);
    const peaks = waveformPeaks(samples, 4);
    expect(Array.from(peaks)).toEqual([0.875, 0.375, 0.5, 0.0625]);
  });

  it('uneven splits still cover every sample exactly once per bucket span', () => {
    const samples = new Float32Array([1, 0, 0, 0, 0, 0.5]); // 6 samples, 4 buckets
    const peaks = waveformPeaks(samples, 4);
    expect(peaks.length).toBe(4);
    expect(peaks[0]).toBe(1);
    expect(peaks[3]).toBe(0.5);
  });

  it('empty input or no buckets give zeros, never a crash', () => {
    expect(Array.from(waveformPeaks(new Float32Array(0), 3))).toEqual([0, 0, 0]);
    expect(waveformPeaks(new Float32Array([1, 2]), 0).length).toBe(0);
    // Fewer samples than buckets: the nearest sample repeats — a flat
    // line at extreme zoom, never fake silence.
    const sparse = waveformPeaks(new Float32Array([0.375]), 3);
    expect(sparse[0]).toBe(0.375);
    expect(sparse[2]).toBe(0.375);
  });
});
