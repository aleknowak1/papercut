// Development-only helpers behind the dev buttons on the opened-project
// view (Phase 2, OQ-019). Loaded with a dynamic import that only exists in
// development builds; none of this ships. The real export screen is Phase 9.

import { REFERENCE_SIZE } from '../export/frameSource';
import { exportProject } from '../export/exportProject';
import type { OpenedProject } from '../../../shared/ipc';
import { applyExportTestContent } from '../../../../tests/fixtures/exportTestProject';
import { writeExportTestAssets } from './exportTestAssets';

export const DEV_EXPORT_FILE = 'export-dev.mp4';

/** Fills the open project with the ten-second export test content and saves it. */
export async function loadTestContent(opened: OpenedProject): Promise<OpenedProject> {
  await writeExportTestAssets(opened.projectDir);
  const document = applyExportTestContent(opened.document);
  await window.papercut.saveProjectDocument(opened.projectDir, document);
  return { projectDir: opened.projectDir, document };
}

/** Exports the open project to export-dev.mp4 in its folder; returns a summary. */
export async function exportOpenProject(
  opened: OpenedProject,
  onProgress?: (framesDone: number, frameCount: number) => void
): Promise<string> {
  const [width, height] = REFERENCE_SIZE[opened.document.format] ?? [1920, 1080];
  const result = await exportProject({
    document: opened.document,
    width,
    height,
    acceleration: 'auto',
    debugOverlay: true,
    readAsset: (path) => window.papercut.readProjectFile(opened.projectDir, path),
    onProgress
  });
  await window.papercut.writeProjectFile(opened.projectDir, DEV_EXPORT_FILE, result.mp4);
  const seconds = (result.wallMillis / 1000).toFixed(1);
  const megabytes = (result.mp4.byteLength / 1024 / 1024).toFixed(1);
  return (
    `Exported ${result.frameCount} frames (${result.durationSeconds} s) at ${width}×${height} ` +
    `in ${seconds} s using the ${result.encoder} encoder — ${megabytes} MB → ${DEV_EXPORT_FILE}`
  );
}
