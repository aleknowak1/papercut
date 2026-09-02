// Driver for the Segmentation check (ADR-015): runs under Electron, forks
// the REAL built segmentation worker (out/main/segmentation-worker.js) into
// a real utility process, feeds it the code-generated fixture image, and
// verifies the result. Never shipped: lives in scripts/, outside the
// packaged files list.
//
// Verifies (loose mask criteria per the gate rule in DOC-13):
//   - the worker starts and the model loads
//   - the mask has the right size and separates figure from background
//   - the cutout is the ORIGINAL pixels plus alpha (RGB byte-identical)
//   - the worker's memory after the job is back down (DOC-13 §10 rule)
// Reports (does not fail on) the time per photo.
'use strict';

const { app, utilityProcess } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { generateTestImage } = require('./oq020/probe-core.cjs');

const root = path.resolve(__dirname, '..');
const MARKER = 'SEG-CHECK-RESULT ';
const model = process.argv.includes('--hd') ? 'hd' : 'lite';
const WIDTH = 3000;
const HEIGHT = 4000;

function report(payload) {
  console.log(MARKER + JSON.stringify(payload));
  app.exit(payload.ok ? 0 : 1);
}

/** Decodes a PNG our own encoder wrote (8-bit RGBA, filter 0 only). */
function decodeOwnPng(file) {
  const buf = Buffer.from(file);
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (pos + 12 <= buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') {
      width = buf.readUInt32BE(pos + 8);
      height = buf.readUInt32BE(pos + 12);
    } else if (type === 'IDAT') {
      idat.push(buf.subarray(pos + 8, pos + 8 + length));
    }
    pos += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    if (raw[y * (stride + 1)] !== 0) throw new Error('Unexpected PNG filter in own output.');
    rgba.set(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), y * stride);
  }
  return { width, height, rgba };
}

app.whenReady().then(() => {
  const workerFile = path.join(root, 'out', 'main', 'segmentation-worker.js');
  const image = generateTestImage(WIDTH, HEIGHT);
  const stages = [];
  const t0 = Date.now();

  const child = utilityProcess.fork(workerFile, [], {
    serviceName: 'segcheck-worker',
    env: { ...process.env, PAPERCUT_MODELS_DIR: path.join(root, 'models') }
  });

  const timeout = setTimeout(() => {
    child.kill();
    report({ ok: false, error: 'The segmentation worker gave no result within 5 minutes.', stages });
  }, 5 * 60 * 1000);

  child.on('exit', (code) => {
    clearTimeout(timeout);
    report({ ok: false, error: `The worker exited early (code ${code}).`, stages });
  });

  child.on('message', (message) => {
    if (message.kind === 'stage') {
      stages.push(message.stage);
      return;
    }
    clearTimeout(timeout);
    if (message.kind === 'error') {
      child.kill();
      report({ ok: false, error: message.message, stages });
      return;
    }

    // kind === 'done': verify everything.
    const problems = [];
    const decoded = decodeOwnPng(message.cutoutPng);
    if (decoded.width !== WIDTH || decoded.height !== HEIGHT) {
      problems.push(`Cutout is ${decoded.width}×${decoded.height}, expected ${WIDTH}×${HEIGHT}.`);
    }

    // Original pixels + alpha (DOC-01 §5): RGB must be byte-identical.
    let rgbMismatches = 0;
    for (let i = 0; i < WIDTH * HEIGHT; i++) {
      if (
        decoded.rgba[i * 4] !== image.rgba[i * 4] ||
        decoded.rgba[i * 4 + 1] !== image.rgba[i * 4 + 1] ||
        decoded.rgba[i * 4 + 2] !== image.rgba[i * 4 + 2]
      ) {
        rgbMismatches++;
      }
    }
    if (rgbMismatches > 0) {
      problems.push(`${rgbMismatches} pixels have altered colours — the cutout must be the original pixels plus alpha.`);
    }

    // Loose mask criteria (the gate rule: runs and separates, not "beautiful").
    let figureSum = 0;
    let figureCount = 0;
    let bgSum = 0;
    let bgCount = 0;
    for (let i = 0; i < WIDTH * HEIGHT; i++) {
      const alpha = decoded.rgba[i * 4 + 3] / 255;
      if (image.truth[i]) {
        figureSum += alpha;
        figureCount++;
      } else {
        bgSum += alpha;
        bgCount++;
      }
    }
    const figureMean = figureSum / figureCount;
    const bgMean = bgSum / bgCount;
    if (!(figureMean > 0.5)) problems.push(`Figure region mean alpha ${figureMean.toFixed(3)} (expected > 0.5).`);
    if (!(bgMean < 0.3)) problems.push(`Background region mean alpha ${bgMean.toFixed(3)} (expected < 0.3).`);

    // Memory rule (DOC-13 §10): the worker gives memory back after the job.
    if (message.rssAfterMB > 600) {
      problems.push(`Worker still held ${message.rssAfterMB} MB after the job (expected under 600 MB).`);
    }

    child.kill();
    report({
      ok: problems.length === 0,
      model,
      problems,
      stages,
      timings: message.timings,
      workerRssAfterMB: message.rssAfterMB,
      figureMeanAlpha: +figureMean.toFixed(4),
      backgroundMeanAlpha: +bgMean.toFixed(4),
      wallMs: Date.now() - t0
    });
  });

  child.postMessage({
    kind: 'run',
    jobId: 'segcheck',
    model,
    width: WIDTH,
    height: HEIGHT,
    rgba: image.rgba
  });
});
