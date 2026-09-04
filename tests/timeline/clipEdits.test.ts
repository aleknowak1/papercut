// Audio-clip edits (Phase 6, ADR-015): move, trim, volume and fades all
// snap/clamp as decided (frame-snapped times, never outside the sound's
// real extent, fades never longer than the clip), round-trip save/reopen,
// are one undo step each, and never record an empty undo step. Older
// project.json files — which carry no trim fields — load unchanged, and
// nonsense trim values are refused in plain language.

import { describe, expect, it } from 'vitest';
import { createProject, loadProject, saveProject } from '../../app/main/projectStore';
import {
  moveAudioClip,
  setAudioClipFadeIn,
  setAudioClipFadeOut,
  setAudioClipVolume,
  trimAudioClip
} from '../../app/shared/document/edits';
import { applyEdit, createHistory, undo } from '../../app/shared/document/history';
import type { AudioClip, ProjectDocument } from '../../app/shared/document/types';
import { validateProjectDocument } from '../../app/shared/document/validate';
import { sampleProject } from '../helpers/sampleProject';
import { suiteOutputDirs } from '../helpers/testOutput';

const tempDir = suiteOutputDirs('timeline');

// The sample project's first scene holds an asset clip (start 0.5 s,
// volume 0.8, fade-out 0.2 s) whose sound is 1.2 s long.
const SOURCE_SECONDS = 1.2;

function firstClip(doc: ProjectDocument): AudioClip {
  return doc.scenes[0]!.audioClips[0]!;
}

function ids(doc: ProjectDocument): { sceneId: string; clipId: string } {
  return { sceneId: doc.scenes[0]!.id, clipId: firstClip(doc).id };
}

describe('moveAudioClip', () => {
  it('snaps the new start to a whole frame and never goes below 0', () => {
    const doc = sampleProject();
    const { sceneId, clipId } = ids(doc);
    // 1.234 s at 30 fps is frame 37 = 1.2333… s exactly.
    const moved = moveAudioClip(doc, sceneId, clipId, 1.234);
    expect(firstClip(moved).startSeconds).toBe(37 / 30);
    const clamped = moveAudioClip(doc, sceneId, clipId, -5);
    expect(firstClip(clamped).startSeconds).toBe(0);
  });

  it('moving nowhere or moving a missing clip returns the same document', () => {
    const doc = sampleProject();
    const { sceneId, clipId } = ids(doc);
    expect(moveAudioClip(doc, sceneId, clipId, 0.5)).toBe(doc);
    expect(moveAudioClip(doc, sceneId, 'nope', 3)).toBe(doc);
  });
});

describe('trimAudioClip', () => {
  it('writes frame-snapped trim values inside the sound', () => {
    const doc = sampleProject();
    const { sceneId, clipId } = ids(doc);
    const trimmed = trimAudioClip(doc, sceneId, clipId, 0.21, 0.52, SOURCE_SECONDS);
    // 0.21 s snaps to frame 6 (0.2 s); 0.52 s snaps to frame 16 (0.5333… s).
    expect(firstClip(trimmed).trimStartSeconds).toBe(0.2);
    expect(firstClip(trimmed).durationSeconds).toBe(16 / 30);
  });

  it('never reaches outside the sound: start and length clamp to its real extent', () => {
    const doc = sampleProject();
    const { sceneId, clipId } = ids(doc);
    // A start past the end leaves at least one frame of sound to play.
    const pastEnd = trimAudioClip(doc, sceneId, clipId, 99, 99, SOURCE_SECONDS);
    const clip = firstClip(pastEnd);
    expect(clip.trimStartSeconds).toBe(SOURCE_SECONDS - 1 / 30);
    expect(clip.durationSeconds).toBeCloseTo(1 / 30, 12);
    // The clamp wins over the snap: the length may end on the sound's own
    // edge even when that is not a whole frame (1.2 s is frame 36 exactly
    // at 30 fps, so pick a start that leaves a non-frame remainder).
    const remainder = trimAudioClip(doc, sceneId, clipId, 0.5, 99, SOURCE_SECONDS);
    expect(firstClip(remainder).durationSeconds).toBeCloseTo(SOURCE_SECONDS - 0.5, 12);
  });

  it('a sound shorter than one frame stays whole: any trim of it changes nothing', () => {
    const doc = sampleProject();
    const { sceneId, clipId } = ids(doc);
    // The clamp collapses every trim of a 0.02 s sound to "play all of it",
    // which is what the untrimmed clip already does — so no edit is made.
    expect(trimAudioClip(doc, sceneId, clipId, 0.5, 0.5, 0.02)).toBe(doc);
  });

  it('a trim that changes nothing returns the same document', () => {
    const doc = sampleProject();
    const { sceneId, clipId } = ids(doc);
    // The untrimmed clip already plays 0..1.2 of its 1.2 s sound.
    expect(trimAudioClip(doc, sceneId, clipId, 0, SOURCE_SECONDS, SOURCE_SECONDS)).toBe(doc);
    expect(trimAudioClip(doc, sceneId, 'nope', 0, 1, SOURCE_SECONDS)).toBe(doc);
    expect(trimAudioClip(doc, sceneId, clipId, 0, 1, 0)).toBe(doc);
  });
});

describe('volume and fades', () => {
  it('volume clamps to 0..1; no change is no undo step', () => {
    const doc = sampleProject();
    const { sceneId, clipId } = ids(doc);
    expect(firstClip(setAudioClipVolume(doc, sceneId, clipId, 2)).volume).toBe(1);
    expect(firstClip(setAudioClipVolume(doc, sceneId, clipId, -1)).volume).toBe(0);
    expect(setAudioClipVolume(doc, sceneId, clipId, 0.8)).toBe(doc);
  });

  it('the two fades together never exceed the clip length', () => {
    const doc = sampleProject();
    const { sceneId, clipId } = ids(doc);
    // Clip length 1.2 s, existing fade-out 0.2 s: fade-in has 1.0 s of room.
    const longIn = setAudioClipFadeIn(doc, sceneId, clipId, 5, SOURCE_SECONDS);
    expect(firstClip(longIn).fadeInSeconds).toBeCloseTo(1.0, 12);
    // With that fade-in in place, fade-out clamps to the rest.
    const longOut = setAudioClipFadeOut(longIn, sceneId, clipId, 5, SOURCE_SECONDS);
    expect(firstClip(longOut).fadeOutSeconds).toBeCloseTo(0.2, 12);
    // Negative fades clamp to zero; setting the same value changes nothing.
    expect(firstClip(setAudioClipFadeOut(doc, sceneId, clipId, -1, SOURCE_SECONDS)).fadeOutSeconds).toBe(0);
    expect(setAudioClipFadeOut(doc, sceneId, clipId, 0.2, SOURCE_SECONDS)).toBe(doc);
  });
});

describe('history and files', () => {
  it('each clip edit is exactly one undo step', () => {
    const start = sampleProject();
    const { sceneId, clipId } = ids(start);
    let history = createHistory(start);
    history = applyEdit(history, moveAudioClip(history.present, sceneId, clipId, 2));
    history = applyEdit(history, trimAudioClip(history.present, sceneId, clipId, 0.2, 0.5, SOURCE_SECONDS));
    history = applyEdit(history, setAudioClipVolume(history.present, sceneId, clipId, 0.5));
    history = applyEdit(history, setAudioClipFadeIn(history.present, sceneId, clipId, 0.1, 0.5));

    history = undo(history);
    expect(firstClip(history.present).fadeInSeconds).toBe(0);
    history = undo(history);
    expect(firstClip(history.present).volume).toBe(0.8);
    history = undo(history);
    expect(firstClip(history.present).trimStartSeconds).toBeUndefined();
    history = undo(history);
    expect(history.present).toEqual(start);
  });

  it('trim fields survive save and reopen field for field', () => {
    const projectDir = createProject(tempDir(), 'Clips', '9:16');
    let doc = loadProject(projectDir);
    // Rebuild the sample's first scene content in the real project file.
    doc = { ...doc, scenes: sampleProject().scenes };
    const { sceneId, clipId } = ids(doc);
    doc = trimAudioClip(doc, sceneId, clipId, 0.2, 0.5, SOURCE_SECONDS);
    doc = moveAudioClip(doc, sceneId, clipId, 3);
    saveProject(projectDir, doc);
    expect(loadProject(projectDir)).toEqual(doc);
  });

  it('an older project.json without trim fields loads unchanged', () => {
    const older = JSON.parse(JSON.stringify(sampleProject())) as unknown;
    const loaded = validateProjectDocument(older);
    expect(loaded).toEqual(older);
    expect(loaded.scenes[0]!.audioClips[0]!.trimStartSeconds).toBeUndefined();
    expect(loaded.scenes[0]!.audioClips[0]!.durationSeconds).toBeUndefined();
  });

  it('nonsense trim values are refused in plain language', () => {
    const withTrim = (fields: Record<string, unknown>): unknown => {
      const raw = JSON.parse(JSON.stringify(sampleProject())) as {
        scenes: { audioClips: Record<string, unknown>[] }[];
      };
      Object.assign(raw.scenes[0]!.audioClips[0]!, fields);
      return raw;
    };
    expect(() => validateProjectDocument(withTrim({ trimStartSeconds: -1 }))).toThrow(
      /trimStartSeconds.*zero or more seconds/
    );
    expect(() => validateProjectDocument(withTrim({ durationSeconds: 0 }))).toThrow(
      /durationSeconds.*more than zero seconds/
    );
    expect(() => validateProjectDocument(withTrim({ trimStartSeconds: 'long' }))).toThrow(
      /trimStartSeconds.*number/
    );
  });
});
