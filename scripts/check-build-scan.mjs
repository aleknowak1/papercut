// The production-build scan (ADR-015; started as a manual step in Phase 2,
// automated in Phase 3): builds the app the way the installer would and
// proves that
//   - no dev-only UI or check code is in the shipped renderer,
//   - no test-fixture code leaked into any shipped bundle,
//   - the segmentation worker was built and onnxruntime-node stayed
//     external (never bundled — it is a native module),
//   - the model files the packaged app will carry exist and match the
//     pinned manifest byte counts, and packaging is configured to ship them.
//
// Run with: npm run check:build-scan  (part of npm run check)

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const problems = [];

console.log('Building the app for production (npx electron-vite build)…');
const build = spawnSync('npx', ['electron-vite', 'build'], { cwd: root, shell: true, stdio: 'inherit' });
if (build.status !== 0) {
  console.error('BUILD SCAN FAILED — the production build itself failed (see above).');
  process.exit(1);
}

function filesUnder(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else out.push(full);
  }
  return out;
}

// 1. Dev/check/fixture code must not be in any shipped bundle.
//    Exception: the main process keeps its dev-only IPC handlers in the
//    bundle behind a hard `app.isPackaged` guard (the Phase 2 design,
//    CL-0018) — so its export-check marker is allowed in out/main only.
const FORBIDDEN = [
  'Load test content', // dev buttons (CL-0018)
  'Export prototype (dev)',
  'EXPORT-CHECK-RESULT', // the export check runner (allowed in out/main, guarded)
  'SEG-CHECK-RESULT', // the segmentation check driver
  'tests/fixtures', // fixture paths
  'generateTestImage', // the segmentation fixture generator
  'snapshotMoments', // the render-snapshot fixture and runner (Phase 5)
  'runSnapshots'
];
for (const file of filesUnder(join(root, 'out'))) {
  if (!/\.(js|html|css)$/.test(file)) continue;
  const relative = file.slice(root.length + 1);
  const isGuardedMain = relative.replaceAll('\\', '/').startsWith('out/main/');
  const text = readFileSync(file, 'utf8');
  for (const marker of FORBIDDEN) {
    if (marker === 'EXPORT-CHECK-RESULT' && isGuardedMain) continue;
    if (text.includes(marker)) {
      problems.push(`"${marker}" appears in ${relative} — dev/test code in the shipped build.`);
    }
  }
}

// 2. The segmentation worker exists and onnxruntime-node stayed external.
const workerFile = join(root, 'out', 'main', 'segmentation-worker.js');
if (!existsSync(workerFile)) {
  problems.push('out/main/segmentation-worker.js was not built.');
} else {
  const worker = readFileSync(workerFile, 'utf8');
  if (!worker.includes('onnxruntime-node')) {
    problems.push('The built worker never mentions onnxruntime-node — wiring looks wrong.');
  }
  if (statSync(workerFile).size > 1024 * 1024) {
    problems.push('The built worker is over 1 MB — onnxruntime-node may have been bundled instead of staying external.');
  }
}

// 3. Model files present and matching the pinned manifest (ADR-009/017:
//    bundled; the packaged app expects resources/models via extraResources).
const manifest = JSON.parse(readFileSync(join(root, 'scripts', 'model-manifest.json'), 'utf8'));
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const shippedModels = packageJson.build?.extraResources?.[0]?.filter ?? [];
for (const key of ['lite_fp32', 'full_fp32']) {
  const entry = manifest.models[key];
  const modelPath = join(root, 'models', entry.localName);
  if (!existsSync(modelPath)) {
    problems.push(
      `models/${entry.localName} is missing. Fetch it with: node scripts/fetch-models.mjs ${key}`
    );
  } else if (statSync(modelPath).size !== entry.sizeBytes) {
    problems.push(
      `models/${entry.localName} is ${statSync(modelPath).size} bytes; the manifest pins ${entry.sizeBytes}. Re-fetch it.`
    );
  }
  if (!shippedModels.includes(entry.localName)) {
    problems.push(`package.json extraResources does not ship ${entry.localName}.`);
  }
}

// 4. Packaging must carry the native module unpacked.
const asarUnpack = packageJson.build?.asarUnpack ?? [];
if (!asarUnpack.some((glob) => glob.includes('onnxruntime-node'))) {
  problems.push('package.json build.asarUnpack does not unpack onnxruntime-node (native modules cannot load from inside the archive).');
}

if (problems.length > 0) {
  console.error('BUILD SCAN FAILED:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('Build scan passed: no dev/test code in the shipped bundles; worker built; onnxruntime-node external; both fp32 models present, pinned, and configured to ship.');
