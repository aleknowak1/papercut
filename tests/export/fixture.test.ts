// The ten-second export test project is a valid, saveable project document
// with its beeps and keyframes exactly where the export check expects them.
import { describe, expect, it } from 'vitest';
import { newProject } from '../../app/shared/document/create';
import { validateProjectDocument } from '../../app/shared/document/validate';
import { EXPORT_TEST, applyExportTestContent, exportTestAssetFiles } from '../fixtures/exportTestProject';
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

  it('places one beep clip at each of the agreed times', () => {
    const starts = doc.scenes[0]?.audioClips.map((c) => c.startSeconds);
    expect(starts).toEqual([...EXPORT_TEST.beepTimes]);
    // The last beep must finish before the video ends.
    const lastBeep = EXPORT_TEST.beepTimes[EXPORT_TEST.beepTimes.length - 1] ?? 0;
    expect(lastBeep + EXPORT_TEST.beepSeconds).toBeLessThanOrEqual(EXPORT_TEST.durationSeconds);
  });

  it('references exactly the generated asset files', () => {
    const referenced = doc.assets.map((a) => a.file).sort();
    const generated = exportTestAssetFiles()
      .map((f) => f.path)
      .sort();
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
