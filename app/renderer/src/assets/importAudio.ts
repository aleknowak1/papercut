// The renderer half of audio import (M-2.6): Chromium's built-in decoders
// prove the file is a playable sound and give its duration BEFORE anything
// is copied; the main process then copies the file unchanged into
// assets/audio/. Waveforms and the timeline are Phase 6.

import type { Asset } from '../../../shared/document/types';

export { formatDuration, isAudioPath } from '../../../shared/audioPaths';

/** Decodes with Chromium (no playback) and returns the duration in seconds. */
export async function decodeAudioDuration(bytes: Uint8Array): Promise<number> {
  const context = new OfflineAudioContext(1, 1, 48000);
  const copy = new Uint8Array(bytes); // detached from the IPC buffer
  const decoded = await context.decodeAudioData(copy.buffer as ArrayBuffer);
  return decoded.duration;
}

export interface AudioImportOutcome {
  readonly fileName: string;
  readonly asset?: Asset;
  readonly refused?: string;
}

/** Imports one sound: read → decode (readability + duration) → copy unchanged. */
export async function importOneAudio(
  projectDir: string,
  sourcePath: string,
  existingHashes: readonly string[]
): Promise<AudioImportOutcome> {
  const fileName = sourcePath.split(/[\\/]/).pop() ?? sourcePath;
  try {
    const bytes = await window.papercut.readImportAudioFile(sourcePath);
    let durationSeconds: number;
    try {
      durationSeconds = await decodeAudioDuration(bytes);
    } catch {
      throw new Error(
        `"${fileName}" could not be read as a sound — the file may be damaged or in a ` +
          'format Windows cannot decode. It was not added to the project.'
      );
    }
    const asset = await window.papercut.importAudioAsset(projectDir, sourcePath, {
      durationSeconds,
      existingHashes
    });
    return { fileName, asset };
  } catch (error) {
    return { fileName, refused: error instanceof Error ? error.message : String(error) };
  }
}

