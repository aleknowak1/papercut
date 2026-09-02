// The Segmentation check (ADR-015): proves the cutout worker starts, the
// model loads, the code-generated fixture produces a sensible mask, the
// cutout is original-pixels-plus-alpha, and the worker returns its memory —
// using the REAL built worker in a REAL Electron utility process
// (scripts/segcheck-driver.cjs does the in-Electron half).
//
// Time per photo is REPORTED, never failed on (ADR-017 targets are judged
// by Alek). Missing model files fail loudly, naming the fetch script —
// this check never silently skips.
//
// Run with: npm run check:segmentation      (lite, part of npm run check)
//           npm run check:segmentation:hd   (the HD model, on demand)

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const hd = process.argv.includes('--hd');
const MARKER = 'SEG-CHECK-RESULT ';
const TIMEOUT_MILLIS = 6 * 60 * 1000;

const modelFile = hd ? 'birefnet_full_fp32.onnx' : 'birefnet_lite_fp32.onnx';
const fetchName = hd ? 'full_fp32' : 'lite';
if (!existsSync(join(root, 'models', modelFile))) {
  console.error(
    `SEGMENTATION CHECK FAILED — the model file models/${modelFile} is missing.\n` +
      `Fetch it (one-time download) with:\n  node scripts/fetch-models.mjs ${fetchName}`
  );
  process.exit(1);
}

const workerFile = join(root, 'out', 'main', 'segmentation-worker.js');
if (!existsSync(workerFile)) {
  console.log('Built worker not found; building first (npx electron-vite build)…');
  const build = spawnSync('npx', ['electron-vite', 'build'], { cwd: root, shell: true, stdio: 'inherit' });
  if (build.status !== 0 || !existsSync(workerFile)) {
    console.error('SEGMENTATION CHECK FAILED — could not build the app (see above).');
    process.exit(1);
  }
}

const args = ['electron', join('scripts', 'segcheck-driver.cjs')];
if (hd) args.push('--hd');
const child = spawn('npx', args, { cwd: root, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });

const logLines = [];
let stdoutRest = '';
let finished = false;
const startedAt = Date.now();

function stopChild() {
  spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
}

function fail(message) {
  if (finished) return;
  finished = true;
  stopChild();
  console.error(`SEGMENTATION CHECK FAILED — ${message}`);
  if (logLines.length > 0) {
    console.error('\nLast output:');
    for (const line of logLines.slice(-30)) console.error(`  ${line}`);
  }
  process.exit(1);
}

function finish(payload) {
  if (finished) return;
  finished = true;
  stopChild();

  if (payload.timings) {
    const t = payload.timings;
    const load = t.loadModelMs === undefined ? 'already loaded' : `${(t.loadModelMs / 1000).toFixed(1)} s`;
    console.log(`Segmentation check (${payload.model} model):`);
    console.log(`  model load: ${load}`);
    console.log(
      `  per photo: ${(t.totalMs / 1000).toFixed(1)} s ` +
        `(shrink ${t.shrinkMs} ms, model ${(t.modelMs / 1000).toFixed(1)} s, ` +
        `mask ${t.maskMs} ms, encode ${t.encodeMs} ms) — reported, not judged (ADR-017)`
    );
    console.log(
      `  mask: figure ${payload.figureMeanAlpha}, background ${payload.backgroundMeanAlpha}; ` +
        `worker held ${payload.workerRssAfterMB} MB after the job`
    );
  }
  for (const problem of payload.problems ?? []) console.error(`  PROBLEM: ${problem}`);
  if (payload.error) console.error(`  ERROR: ${payload.error}`);

  const wall = ((Date.now() - startedAt) / 1000).toFixed(1);
  if (payload.ok) {
    console.log(`Segmentation check passed (${wall} s in total). Nothing written to disk.`);
    process.exit(0);
  }
  console.error(`SEGMENTATION CHECK FAILED (after ${wall} s) — see above.`);
  process.exit(1);
}

child.stdout.on('data', (data) => {
  stdoutRest += String(data);
  let newline;
  while ((newline = stdoutRest.indexOf('\n')) >= 0) {
    const line = stdoutRest.slice(0, newline).trimEnd();
    stdoutRest = stdoutRest.slice(newline + 1);
    logLines.push(line);
    const at = line.indexOf(MARKER);
    if (at >= 0) {
      try {
        finish(JSON.parse(line.slice(at + MARKER.length)));
      } catch (error) {
        fail(`could not read the driver's report: ${error}`);
      }
    }
  }
});
child.stderr.on('data', (data) => {
  for (const line of String(data).split('\n')) {
    if (line.trim() !== '') logLines.push(line.trimEnd());
  }
});
child.on('exit', (code) => {
  if (!finished) fail(`the driver exited (code ${code}) before reporting.`);
});
setTimeout(() => fail(`no result after ${TIMEOUT_MILLIS / 60000} minutes.`), TIMEOUT_MILLIS).unref?.();
