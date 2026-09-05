// The ten-second export test project is a valid, saveable project document
// with its beeps and keyframes exactly where the export check expects them.
import { describe, expect, it } from 'vitest';
import { newProject } from '../../app/shared/document/create';
import { validateProjectDocument } from '../../app/shared/document/validate';
import {
  EXPORT_TEST,
  allBeepTimes,
  applyExportTestContent,
  exportTestAssetFiles,
  scene2StartSeconds
} from '../fixtures/exportTestProject';
import { projectDurationSeconds } from '../../app/shared/timeline/projectTime';
import { solidPng } from '../fixtures/png';

describe('export test project', () => {
  const doc = applyExportTestContent(newProject('Export Test', '16:9'));

  it('is a valid project document, also after a save/load round trip', () => {
    expect(validateProjectDocument(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  it('fills the first scene with a ten-second timeline', () => {
    const scene = doc.scenes[0];
    expect(scene?.durationSeconds).toBe(EXPORT_TEST.durationSeconds);
    expect(scene?.backgroundAssetId).toBeDefined();
    expect(scene?.layers).toHaveLength(1);
    expect(scene?.layers[0]?.keyframes).toHaveLength(2);
  });

  it('places one clip at each of the agreed beep times, trimmed clips included', () => {
    // Scene 1 carries seven clips, scene 2 one; together, shifted by the
    // scene starts, they are exactly the GLOBAL beep list the export
    // check listens for.
    const global = [
      ...doc.scenes[0]!.audioClips.map((c) => c.startSeconds),
      ...doc.scenes[1]!.audioClips.map((c) => scene2StartSeconds() + c.startSeconds)
    ].sort((a, b) => a - b);
    expect(global).toEqual(allBeepTimes());
    // Every beep must finish before the video ends.
    const lastBeep = allBeepTimes().pop() ?? 0;
    expect(lastBeep + EXPORT_TEST.beepSeconds).toBeLessThanOrEqual(EXPORT_TEST.totalSeconds);
  });

  it('the second scene and the crossfade give exactly the agreed total', () => {
    const scene2 = doc.scenes[1];
    expect(doc.scenes).toHaveLength(2);
    expect(scene2?.durationSeconds).toBe(EXPORT_TEST.scene2.durationSeconds);
    expect(scene2?.backgroundAssetId).toBeDefined();
    expect(scene2?.backgroundAssetId).not.toBe(doc.scenes[0]?.backgroundAssetId);
    expect(doc.scenes[0]?.transitionOut).toBe('crossfade');
    expect(doc.scenes[0]?.transitionOutSeconds).toBe(EXPORT_TEST.scene2.transitionSeconds);
    expect(projectDurationSeconds(doc)).toBe(EXPORT_TEST.totalSeconds);
    // Loading the test content again must not grow the project.
    const again = applyExportTestContent(doc);
    expect(again.scenes).toHaveLength(2);
  });

  it('the trimmed clips carry exactly the agreed trim values', () => {
    const clips = doc.scenes[0]!.audioClips;
    for (const spec of [EXPORT_TEST.trimmedWav, EXPORT_TEST.trimmedM4a]) {
      const clip = clips.find((c) => c.startSeconds === spec.clipStart);
      expect(clip?.trimStartSeconds).toBe(spec.trimStart);
      expect(clip?.durationSeconds).toBe(spec.duration);
    }
  });

  it('references exactly the generated asset files (plus the run-time M4A)', () => {
    const referenced = doc.assets.map((a) => a.file).sort();
    const generated = [...exportTestAssetFiles().map((f) => f.path), EXPORT_TEST.trimmedM4a.file].sort();
    expect(referenced).toEqual(generated);
  });
});

describe('the in-code PNG writer', () => {
  it('produces a valid PNG header with the requested size', () => {
    const png = solidPng(64, 36, [10, 20, 30, 255]);
    // PNG signature…
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    // …then the IHDR chunk with width and height as big-endian numbers.
    const view = new DataView(png.buffer);
    expect(view.getUint32(16)).toBe(64);
    expect(view.getUint32(20)).toBe(36);
  });
});
