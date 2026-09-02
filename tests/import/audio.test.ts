// Audio import (M-2.6): each file round-trips unchanged into the project
// folder and the document; duplicates and unsupported files refused in
// plain language. Decoding with real durations is covered by the audio
// fixtures inside the export check (Chromium decoders); MP3/OGG are
// verified by Alek with real files.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importAudioAsset, readImportAudioBytes } from '../../app/main/importAssets';
import { createProject, loadProject, saveProject } from '../../app/main/projectStore';
import { addAsset } from '../../app/shared/document/edits';
import { formatDuration, isAudioPath } from '../../app/shared/audioPaths';
import { toneWav } from '../fixtures/audioFixtures';
import { suiteOutputDirs } from '../helpers/testOutput';

const tempDir = suiteOutputDirs('audio');

describe('importAudioAsset', () => {
  it('copies the sound byte-for-byte and fills the record', () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'Sound', '9:16');
    const source = join(dir, 'my song.wav');
    writeFileSync(source, toneWav(2, 440));

    const asset = importAudioAsset(projectDir, source, {
      durationSeconds: 2,
      existingHashes: []
    });
    expect(asset.type).toBe('audio');
    expect(asset.file.startsWith('assets/audio/')).toBe(true);
    expect(asset.file.endsWith('.wav')).toBe(true);
    expect(asset.metadata.originalFileName).toBe('my song.wav');
    expect(asset.metadata.durationSeconds).toBe(2);
    expect(readFileSync(join(projectDir, asset.file)).equals(readFileSync(source))).toBe(true);
  });

  it('refuses duplicates and unsupported types in plain language', () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'SoundDupes', '9:16');
    const source = join(dir, 'twice.wav');
    writeFileSync(source, toneWav(1, 220));
    const first = importAudioAsset(projectDir, source, { durationSeconds: 1, existingHashes: [] });
    expect(() =>
      importAudioAsset(projectDir, source, {
        durationSeconds: 1,
        existingHashes: [first.metadata.contentHash ?? '']
      })
    ).toThrow(/already in this project/);
    writeFileSync(join(dir, 'song.flac'), toneWav(1, 220));
    expect(() => readImportAudioBytes(join(dir, 'song.flac'))).toThrow(/not a supported sound type/);
    expect(() => readImportAudioBytes(join(dir, 'gone.mp3'))).toThrow(/could not be read/);
  });

  it('a document with an audio asset saves and reopens field for field', () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'SoundDoc', '9:16');
    const source = join(dir, 'fx.wav');
    writeFileSync(source, toneWav(1.5, 550));
    const asset = importAudioAsset(projectDir, source, {
      durationSeconds: 1.5,
      existingHashes: []
    });
    const doc = addAsset(loadProject(projectDir), asset);
    saveProject(projectDir, doc);
    expect(loadProject(projectDir)).toEqual(doc);
  });
});

describe('panel helpers', () => {
  it('recognises audio files by extension, any case', () => {
    expect(isAudioPath('C:/sounds/Boom.MP3')).toBe(true);
    expect(isAudioPath('C:/sounds/voice.m4a')).toBe(true);
    expect(isAudioPath('C:/photos/pic.png')).toBe(false);
  });

  it('formats durations as minutes:seconds', () => {
    expect(formatDuration(2)).toBe('0:02.0');
    expect(formatDuration(83.4)).toBe('1:23.4');
  });
});
