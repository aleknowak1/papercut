// The main-process half of the render-snapshot check (ADR-015): compares a
// frame the hidden check window rendered against the approved reference in
// tests/snapshots/, writes first-time references automatically (Phase 5
// decision i), and on a mismatch leaves expected/actual/diff images and a
// contact sheet under tests/output/snapshots/ for Alek to look at.
// Approving is `npm run snapshots:approve`.
//
// Registered only outside packaged builds (see ipc.ts), like every other
// dev channel. Tolerance (decision h): a pixel counts as different when
// any channel is off by more than 8/255; the frame fails when more than
// 0.5% of its pixels differ — a GPU driver's anti-aliasing wiggle passes,
// any real change fails.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SnapshotCompareResult, SnapshotRunSummary } from '../shared/ipc';
import { decodePngRgba, encodePngRgba } from './segmentation/png';

const CHANNEL_TOLERANCE = 8;
const BAD_PIXEL_FRACTION = 0.005;

const referenceDir = (): string => join(process.cwd(), 'tests', 'snapshots');
const outputDir = (): string => join(process.cwd(), 'tests', 'output', 'snapshots');

interface Mismatch {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly expected: Uint8Array;
  readonly actual: Uint8Array;
  readonly diff: Uint8Array;
}

let results: SnapshotCompareResult[] = [];
let mismatches: Mismatch[] = [];

/** Compares one rendered frame; writes it as the reference when none exists. */
export function checkSnapshotFrame(
  name: string,
  width: number,
  height: number,
  rgba: Uint8Array
): SnapshotCompareResult {
  const refPath = join(referenceDir(), `${name}.png`);
  const totalPixels = width * height;
  let result: SnapshotCompareResult;

  if (!existsSync(refPath)) {
    mkdirSync(referenceDir(), { recursive: true });
    writeFileSync(refPath, encodePngRgba(rgba, width, height));
    result = { name, status: 'new', badPixels: 0, totalPixels };
  } else {
    const reference = decodePngRgba(readFileSync(refPath));
    if (reference.width !== width || reference.height !== height) {
      // A size change is always a real change: every pixel counts as bad.
      const blank = new Uint8Array(totalPixels * 4);
      result = { name, status: 'mismatch', badPixels: totalPixels, totalPixels };
      mismatches.push({ name, width, height, expected: blank, actual: rgba, diff: blank });
      writeMismatchFiles(name, width, height, rgba, blank, blank);
    } else {
      // The diff image: unchanged pixels dimmed, differing pixels red.
      const diff = new Uint8Array(totalPixels * 4);
      let badPixels = 0;
      for (let i = 0; i < totalPixels; i++) {
        const at = i * 4;
        let worst = 0;
        for (let c = 0; c < 4; c++) {
          const delta = Math.abs((rgba[at + c] ?? 0) - (reference.rgba[at + c] ?? 0));
          if (delta > worst) worst = delta;
        }
        if (worst > CHANNEL_TOLERANCE) {
          badPixels++;
          diff[at] = 255;
          diff[at + 3] = 255;
        } else {
          const dim = Math.round((rgba[at] ?? 0) * 0.25);
          diff[at] = dim;
          diff[at + 1] = dim;
          diff[at + 2] = dim;
          diff[at + 3] = 255;
        }
      }
      if (badPixels / totalPixels <= BAD_PIXEL_FRACTION) {
        result = { name, status: 'match', badPixels, totalPixels };
      } else {
        result = { name, status: 'mismatch', badPixels, totalPixels };
        mismatches.push({ name, width, height, expected: reference.rgba, actual: rgba, diff });
        writeMismatchFiles(name, width, height, rgba, reference.rgba, diff);
      }
    }
  }
  results.push(result);
  return result;
}

function writeMismatchFiles(
  name: string,
  width: number,
  height: number,
  actual: Uint8Array,
  expected: Uint8Array,
  diff: Uint8Array
): void {
  mkdirSync(outputDir(), { recursive: true });
  writeFileSync(join(outputDir(), `${name}.expected.png`), encodePngRgba(expected, width, height));
  writeFileSync(join(outputDir(), `${name}.actual.png`), encodePngRgba(actual, width, height));
  writeFileSync(join(outputDir(), `${name}.diff.png`), encodePngRgba(diff, width, height));
}

/**
 * Ends the run: one contact sheet (expected | actual | diff per failing
 * moment) when anything mismatched, and the summary either way.
 */
export function finishSnapshotRun(): SnapshotRunSummary {
  let out: string | undefined;
  if (mismatches.length > 0) {
    out = outputDir();
    writeContactSheet(out);
  }
  const summary: SnapshotRunSummary = {
    results,
    ...(out !== undefined ? { outputDir: out } : {})
  };
  results = [];
  mismatches = [];
  return summary;
}

function writeContactSheet(dir: string): void {
  const GAP = 8;
  const sheetWidth = Math.max(...mismatches.map((m) => m.width * 3 + GAP * 2));
  const sheetHeight =
    mismatches.reduce((sum, m) => sum + m.height, 0) + GAP * (mismatches.length - 1);
  const sheet = new Uint8Array(sheetWidth * sheetHeight * 4);
  let top = 0;
  for (const m of mismatches) {
    const panes = [m.expected, m.actual, m.diff];
    for (let p = 0; p < panes.length; p++) {
      const pane = panes[p] ?? new Uint8Array(0);
      const left = p * (m.width + GAP);
      for (let y = 0; y < m.height; y++) {
        for (let x = 0; x < m.width; x++) {
          const from = (y * m.width + x) * 4;
          const to = ((top + y) * sheetWidth + left + x) * 4;
          sheet[to] = pane[from] ?? 0;
          sheet[to + 1] = pane[from + 1] ?? 0;
          sheet[to + 2] = pane[from + 2] ?? 0;
          sheet[to + 3] = 255;
        }
      }
    }
    top += m.height + GAP;
  }
  writeFileSync(join(dir, 'contact-sheet.png'), encodePngRgba(sheet, sheetWidth, sheetHeight));
}
