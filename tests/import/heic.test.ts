// HEIC import (OQ-016, DOC-08 A13): the decision logic and both outcomes,
// without downloading a HEIC (none can be generated in code — the "works"
// path with a real iPhone photo is verified by Alek). The conversion
// pipeline itself (powershell.exe 5.1 + Windows' imaging components) IS
// exercised for real, by feeding it a PNG renamed .heic: Windows sniffs
// file contents, decodes it, and proves spawn/decode/encode/exit wiring.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HEIC_HELP_MESSAGE,
  classifyConversionError,
  convertHeicToPng,
  isHeicPath
} from '../../app/main/heic';
import { importImageAsset } from '../../app/main/importAssets';
import { createProject } from '../../app/main/projectStore';
import { solidPng } from '../fixtures/png';
import { suiteOutputDirs } from '../helpers/testOutput';

const tempDir = suiteOutputDirs('heic');

describe('what counts as a HEIC', () => {
  it('recognises .heic and .heif in any case', () => {
    expect(isHeicPath('C:/photos/IMG_0001.HEIC')).toBe(true);
    expect(isHeicPath('C:/photos/pic.heif')).toBe(true);
    expect(isHeicPath('C:/photos/pic.jpg')).toBe(false);
  });
});

describe('the "decoder missing" decision', () => {
  it('maps the Windows missing-codec error to the friendly path', () => {
    expect(
      classifyConversionError('No imaging component suitable to complete this operation was found.')
    ).toBe('no-decoder');
    expect(classifyConversionError('Exception 0x88982F50 something')).toBe('no-decoder');
    expect(classifyConversionError('The file is corrupted')).toBe('unreadable');
  });

  it('shows the friendly export-as-JPG message and adds nothing', async () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'Heic Missing', '9:16');
    const source = join(dir, 'photo.heic');
    writeFileSync(source, new Uint8Array([1, 2, 3]));
    const pretendNoDecoder = async (): Promise<{ ok: false; reason: 'no-decoder' }> => ({
      ok: false,
      reason: 'no-decoder'
    });
    await expect(
      importImageAsset(
        projectDir,
        source,
        'background',
        { width: 1, height: 1, existingHashes: [] },
        pretendNoDecoder
      )
    ).rejects.toThrow(HEIC_HELP_MESSAGE);
  });

  it('a damaged file gets its own plain message, not the decoder one', async () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'Heic Bad', '9:16');
    const source = join(dir, 'broken.heic');
    writeFileSync(source, new Uint8Array([1, 2, 3]));
    const pretendUnreadable = async (): Promise<{
      ok: false;
      reason: 'unreadable';
      detail: string;
    }> => ({ ok: false, reason: 'unreadable', detail: 'the file is damaged' });
    await expect(
      importImageAsset(
        projectDir,
        source,
        'background',
        { width: 1, height: 1, existingHashes: [] },
        pretendUnreadable
      )
    ).rejects.toThrow(/could not be read as a photo/);
  });
});

describe('a converted HEIC lands in the project as a PNG', () => {
  it('stores the converted bytes with the original name in the record', async () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'Heic Ok', '9:16');
    const source = join(dir, 'holiday.heic');
    writeFileSync(source, new Uint8Array([0x00])); // never read by the fake
    const png = solidPng(4, 4, [7, 8, 9, 255]);
    const fakeConvert = async (_src: string, dest: string): Promise<{ ok: true }> => {
      writeFileSync(dest, png);
      return { ok: true };
    };
    const asset = await importImageAsset(
      projectDir,
      source,
      'character-prop',
      { width: 4, height: 4, existingHashes: [] },
      fakeConvert
    );
    expect(asset.file.endsWith('.png')).toBe(true);
    expect(asset.metadata.originalFileName).toBe('holiday.heic');
    expect(readFileSync(join(projectDir, asset.file)).equals(Buffer.from(png))).toBe(true);
  });
});

describe('the real Windows conversion pipeline', () => {
  it('powershell.exe decodes and re-encodes an image end to end', async () => {
    // A PNG wearing a .heic name: Windows sniffs content, so this proves
    // the whole spawn → decode → PNG-encode → exit path on this machine
    // without any HEIC file. (A real HEIC additionally needs the HEIF
    // extension, which Alek verifies with a real iPhone photo.)
    const dir = tempDir();
    const source = join(dir, 'not-really.heic');
    writeFileSync(source, solidPng(6, 5, [200, 100, 50, 255]));
    const dest = join(dir, 'converted.png');
    const result = await convertHeicToPng(source, dest);
    expect(result).toEqual({ ok: true });
    const out = readFileSync(dest);
    // PNG signature.
    expect(Array.from(out.subarray(0, 4))).toEqual([137, 80, 78, 71]);
  }, 30000);
});
