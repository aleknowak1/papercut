// Approves failed render snapshots (ADR-015): copies each *.actual.png the
// last failed check left in tests/output/snapshots/ over its reference in
// tests/snapshots/, then empties the output folder. Run this ONLY after
// looking at the contact sheet and deciding the new look is right; commit
// the changed references afterwards.
//
// Run with: npm run snapshots:approve

import { copyFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(root, 'tests', 'output', 'snapshots');
const referenceDir = join(root, 'tests', 'snapshots');

if (!existsSync(outputDir)) {
  console.log('Nothing to approve: tests/output/snapshots/ does not exist.');
  console.log('(It appears only when the snapshot check fails. Run: npm run check:export)');
  process.exit(0);
}

const actuals = readdirSync(outputDir).filter((f) => f.endsWith('.actual.png'));
if (actuals.length === 0) {
  console.log('Nothing to approve: no .actual.png files in tests/output/snapshots/.');
  process.exit(0);
}

for (const file of actuals) {
  const name = file.slice(0, -'.actual.png'.length);
  copyFileSync(join(outputDir, file), join(referenceDir, `${name}.png`));
  console.log(`approved: ${name} → tests\\snapshots\\${name}.png`);
}
rmSync(outputDir, { recursive: true, force: true });
console.log(`${actuals.length} reference(s) updated and tests/output/snapshots/ emptied.`);
console.log('Commit the changed files under tests/snapshots/ to make the approval stick.');
