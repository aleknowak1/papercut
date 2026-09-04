// Writes the export test project's asset files into a project folder: the
// in-code images and WAVs from tests/fixtures, plus the trimmed M4A —
// which needs Chromium's AAC encoder, so its bytes are made here at run
// time from the fixture's samples. Used by the export check's fixture
// build and the "Load test content" dev button. Development only; never
// ships.

import {
  EXPORT_TEST,
  exportTestAssetFiles,
  trimmedM4aSamples
} from '../../../../tests/fixtures/exportTestProject';
import { makeM4aFromSamples } from './audioFixtureCheck';

export async function writeExportTestAssets(projectDir: string): Promise<void> {
  for (const file of exportTestAssetFiles()) {
    await window.papercut.writeProjectFile(projectDir, file.path, file.bytes);
  }
  const m4a = await makeM4aFromSamples(trimmedM4aSamples());
  await window.papercut.writeProjectFile(projectDir, EXPORT_TEST.trimmedM4a.file, m4a);
}
