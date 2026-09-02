// Scratch folders for tests, under tests/output/, removed when the suite
// ends — the standing housekeeping rule (CLAUDE.md "Every change"): a green
// run leaves tests/output/ empty. Unit-test diagnostics live in assertion
// messages, not files, so these folders are removed even on failure; the
// end-to-end checks (export, segmentation) are the ones that keep output
// for diagnosis when they fail.

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll } from 'vitest';

const outputRoot = join(__dirname, '..', 'output');

/**
 * Returns a maker of per-test scratch dirs (tests/output/<prefix>-XXXX),
 * all removed when the calling suite finishes.
 */
export function suiteOutputDirs(prefix: string): () => string {
  mkdirSync(outputRoot, { recursive: true });
  const created: string[] = [];
  afterAll(() => {
    for (const dir of created) rmSync(dir, { recursive: true, force: true });
  });
  return () => {
    const dir = mkdtempSync(join(outputRoot, `${prefix}-`));
    created.push(dir);
    return dir;
  };
}
