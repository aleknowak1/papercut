// The Export check (ADR-015) — and, with --measure, the OQ-019 measurement
// session. WebCodecs only exists inside a Chromium window, so this script
// starts the app in development mode with a hidden window; the window
// builds the ten-second test project, exports it, reads the .mp4 back, and
// reports through stdout. This script waits for the report, prints it in
// plain language, and exits 0 (pass) or 1 (fail).
//
// Run with: npm run check:export   (or: npm run measure:export)

import { spawn, spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const measure = process.argv.includes('--measure');
const MARKER = 'EXPORT-CHECK-RESULT ';
const TIMEOUT_MILLIS = 10 * 60 * 1000;

const child = spawn('npx', ['electron-vite', 'dev'], {
  cwd: root,
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    [measure ? 'PAPERCUT_EXPORT_MEASURE' : 'PAPERCUT_EXPORT_CHECK']: '1'
  }
});

const logLines = [];
let stdoutRest = '';
let finished = false;
const startedAt = Date.now();

function stopChild() {
  // shell:true means child.pid is the shell; /T takes the whole tree down.
  spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
}

function fail(message) {
  if (finished) return;
  finished = true;
  stopChild();
  console.error(`EXPORT CHECK FAILED — ${message}`);
  if (logLines.length > 0) {
    console.error('\nLast output from the app:');
    for (const line of logLines.slice(-40)) console.error(`  ${line}`);
  }
  process.exit(1);
}

function millisToSeconds(ms) {
  return (ms / 1000).toFixed(1);
}

function driftTable(verification) {
  const rows = ['  beep at   sound vs picture   sound vs plan'];
  for (const beep of verification.beeps) {
    const at = `${beep.nominalSeconds.toFixed(1)} s`.padStart(7);
    const av =
      beep.audioVsVideoMs === undefined ? 'not found' : `${beep.audioVsVideoMs.toFixed(1)} ms`;
    const an =
      beep.audioVsNominalMs === undefined ? 'not found' : `${beep.audioVsNominalMs.toFixed(1)} ms`;
    rows.push(`  ${at}   ${av.padStart(16)}   ${an.padStart(13)}`);
  }
  return rows.join('\n');
}

function printRun(run) {
  const v = run.verification;
  const size = (run.sizeBytes / 1024 / 1024).toFixed(1);
  console.log(`${run.label}:`);
  console.log(
    `  exported in ${run.exportSeconds.toFixed(1)} s, ${run.encoder} encoder (${run.videoCodec}), ${size} MB`
  );
  console.log(
    `  read back: ${v.durationSeconds.toFixed(3)} s, ${v.width}×${v.height}, ` +
      `${v.fps.toFixed(2)} fps, ${v.frameCount} frames, audio ${v.audioDurationSeconds.toFixed(3)} s`
  );
  console.log(driftTable(v));
  for (const problem of v.problems) console.log(`  PROBLEM: ${problem}`);
}

function finish(payload) {
  if (finished) return;
  finished = true;
  stopChild();

  if (payload.error !== undefined) {
    console.error('EXPORT CHECK FAILED — the app reported an error:');
    console.error(payload.error);
    process.exit(1);
  }

  const runs = payload.kind === 'measure' ? payload.runs : [payload.run];
  for (const run of runs) printRun(run);
  for (const fixture of payload.audioFixtures ?? []) {
    const decoded =
      fixture.decodedSeconds === undefined ? 'did not decode' : `${fixture.decodedSeconds} s`;
    console.log(`Audio fixture ${fixture.format}: ${decoded}${fixture.problem ? ` PROBLEM: ${fixture.problem}` : ' ✓'}`);
  }
  if (payload.projectDir !== undefined) {
    console.log(`Files: ${payload.projectDir}`);
  }
  const wall = millisToSeconds(Date.now() - startedAt);
  if (payload.ok) {
    console.log(`Export check passed (whole check took ${wall} s including app start-up).`);
    process.exit(0);
  }
  console.error(`EXPORT CHECK FAILED (after ${wall} s) — see PROBLEM lines above.`);
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
        fail(`could not read the app's report: ${error}`);
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
  if (!finished) fail(`the app exited (code ${code}) before reporting a result.`);
});
setTimeout(() => fail(`no result after ${TIMEOUT_MILLIS / 60000} minutes.`), TIMEOUT_MILLIS).unref?.();
