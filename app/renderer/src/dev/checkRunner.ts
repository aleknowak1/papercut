// Runs the export check (ADR-015) or the OQ-019 measurement session inside
// the hidden dev window that scripts/check-export.mjs starts. Builds the
// ten-second test project in a scratch folder, exports it, verifies the
// .mp4 by reading it back, and reports the result to the main process,
// which prints it and exits. Development only; never ships.

import { EXPORT_TEST, applyExportTestContent, exportTestAssetFiles } from '../../../../tests/fixtures/exportTestProject';
import type { OpenedProject } from '../../../shared/ipc';
import { exportProject, type ProjectExportResult } from '../export/exportProject';
import { verifyExportedMp4, type ExportVerification } from './verifyMp4';

const MAX_DRIFT_MS = 50; // 1.5 frames at 30 fps

interface RunSummary {
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly acceleration: 'auto' | 'software';
  readonly encoder: string;
  readonly videoCodec: string;
  readonly exportSeconds: number;
  readonly sizeBytes: number;
  readonly mixedAudioPeak: number;
  readonly verification: ExportVerification;
}

async function buildFixtureProject(where: 'temp' | 'tests-output'): Promise<OpenedProject> {
  const created = await window.papercut.devCreateScratchProject('Export Test', '16:9', where);
  for (const file of exportTestAssetFiles()) {
    await window.papercut.writeProjectFile(created.projectDir, file.path, file.bytes);
  }
  const document = applyExportTestContent(created.document);
  await window.papercut.saveProjectDocument(created.projectDir, document);
  return { projectDir: created.projectDir, document };
}

async function runOne(
  opened: OpenedProject,
  label: string,
  width: number,
  height: number,
  acceleration: 'auto' | 'software',
  outputFile: string,
  update: (text: string) => void
): Promise<RunSummary> {
  update(`${label}: exporting…`);
  const result: ProjectExportResult = await exportProject({
    document: opened.document,
    width,
    height,
    acceleration,
    debugOverlay: true,
    readAsset: (path) => window.papercut.readProjectFile(opened.projectDir, path)
  });
  await window.papercut.writeProjectFile(opened.projectDir, outputFile, result.mp4);
  update(`${label}: verifying…`);
  const verification = await verifyExportedMp4(result.mp4, {
    durationSeconds: EXPORT_TEST.durationSeconds,
    width,
    height,
    fps: EXPORT_TEST.fps,
    beepTimes: EXPORT_TEST.beepTimes,
    maxDriftMs: MAX_DRIFT_MS
  });
  return {
    label,
    width,
    height,
    acceleration,
    encoder: result.encoder,
    videoCodec: result.videoCodec,
    exportSeconds: result.wallMillis / 1000,
    sizeBytes: result.mp4.byteLength,
    mixedAudioPeak: result.audioPeak,
    verification
  };
}

function report(payload: unknown): void {
  window.papercut.devReportExportCheck(JSON.stringify(payload));
}

// React StrictMode mounts effects twice in development; only one check may run.
let started = false;

export async function run(
  mode: 'export-check' | 'export-measure',
  update: (text: string) => void
): Promise<void> {
  if (started) return;
  started = true;
  try {
    if (mode === 'export-check') {
      const opened = await buildFixtureProject('temp');
      const summary = await runOne(
        opened,
        'Export check (1080p30)',
        1920,
        1080,
        'auto',
        'export-check.mp4',
        update
      );
      // The audio-import fixtures (M-2.6) ride in this window so the suite
      // boots the app once: WAV + generated M4A must decode with the right
      // duration through the same decoders the import path uses.
      update('audio fixtures…');
      const { verifyAudioFixtures } = await import('./audioFixtureCheck');
      const audioFixtures = await verifyAudioFixtures();
      report({
        ok:
          summary.verification.problems.length === 0 &&
          audioFixtures.every((f) => f.problem === undefined),
        kind: 'check',
        projectDir: opened.projectDir,
        run: summary,
        audioFixtures
      });
      return;
    }

    // Measurement session (OQ-019): three exports into tests/output so the
    // files can be watched afterwards.
    const opened = await buildFixtureProject('tests-output');
    const runs: RunSummary[] = [];
    runs.push(
      await runOne(opened, '1080p30, hardware allowed', 1920, 1080, 'auto', 'export-1080p.mp4', update)
    );
    runs.push(
      await runOne(
        opened,
        '1080p30, software forced (no-GPU path)',
        1920,
        1080,
        'software',
        'export-1080p-software.mp4',
        update
      )
    );
    runs.push(
      await runOne(opened, '720p30, hardware allowed', 1280, 720, 'auto', 'export-720p.mp4', update)
    );
    report({
      ok: runs.every((r) => r.verification.problems.length === 0),
      kind: 'measure',
      projectDir: opened.projectDir,
      runs
    });
  } catch (error) {
    const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
    report({ ok: false, kind: mode, error: detail });
  }
}
