// OQ-020 gate probe: proves onnxruntime-node loads and BiRefNet_lite runs a
// real inference on this machine, on CPU only, and reports numbers. Used from
// plain Node (probe-node.cjs) and from an Electron utility process
// (probe-electron.cjs + probe-worker.cjs).
//
// The gate proves "runs", not "segments beautifully": BiRefNet was trained on
// photographs, so a synthetic test image may segment imperfectly for model
// reasons that have nothing to do with OQ-020. Pass criteria are deliberately
// loose: model loads, inference completes, the mask has the right dimensions
// and is neither empty nor solid. Cutout quality is judged by Alek on a real
// photo.

'use strict';

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const MODEL_INPUT = 1024; // BiRefNet's fixed input size (1024x1024)

// ---------- synthetic test image (nothing downloaded, nothing shipped) ----------

/** Deterministic pseudo-random generator so every run sees the same image. */
function makeRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * A clearly separated figure-like shape (head + shoulders + torso) in a dark
 * consistent colour, centred on a busy background (random-coloured
 * checkerboard with per-pixel noise). Returns raw RGBA plus the ground-truth
 * figure mask so coverage can be measured.
 */
function generateTestImage(width, height) {
  const rand = makeRand(20260902);
  const rgba = new Uint8Array(width * height * 4);
  const truth = new Uint8Array(width * height); // 1 = figure

  const cell = Math.max(24, Math.round(width / 30));
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const cellColor = new Uint8Array(cols * rows * 3);
  for (let i = 0; i < cols * rows; i++) {
    cellColor[i * 3] = 90 + Math.floor(rand() * 165);
    cellColor[i * 3 + 1] = 90 + Math.floor(rand() * 165);
    cellColor[i * 3 + 2] = 90 + Math.floor(rand() * 165);
  }

  // Figure geometry, proportional to the image.
  const cx = width / 2;
  const headCy = height * 0.3;
  const headR = Math.min(width, height) * 0.11;
  const shoulderY = height * 0.42;
  const torsoBottom = height * 0.8;
  const torsoHalfW = width * 0.17;

  const inFigure = (x, y) => {
    const dxh = x - cx;
    const dyh = y - headCy;
    if (dxh * dxh + dyh * dyh <= headR * headR) return true; // head
    if (y >= shoulderY && y <= torsoBottom) {
      // Torso with softly rounded shoulders.
      const t = Math.min(1, (y - shoulderY) / (headR * 1.2));
      const halfW = torsoHalfW * (0.55 + 0.45 * t);
      if (Math.abs(x - cx) <= halfW) return true;
    }
    // Neck.
    if (y > headCy && y < shoulderY && Math.abs(x - cx) <= headR * 0.45) return true;
    return false;
  };

  const noise = makeRand(777);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const rowCell = Math.floor(y / cell) * cols;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x);
      if (inFigure(x, y)) {
        const n = Math.floor(noise() * 14);
        rgba[p] = 24 + n;
        rgba[p + 1] = 28 + n;
        rgba[p + 2] = 44 + n;
        truth[i] = 1;
      } else {
        const c = (rowCell + Math.floor(x / cell)) * 3;
        const n = Math.floor(noise() * 40) - 20;
        rgba[p] = Math.max(0, Math.min(255, cellColor[c] + n));
        rgba[p + 1] = Math.max(0, Math.min(255, cellColor[c + 1] + n));
        rgba[p + 2] = Math.max(0, Math.min(255, cellColor[c + 2] + n));
      }
      rgba[p + 3] = 255;
      p += 4;
    }
  }
  return { rgba, truth, width, height };
}

// ---------- pre/post processing ----------

/** Bilinear resize of RGBA pixels. */
function resizeRgbaBilinear(src, sw, sh, dw, dh) {
  const dst = new Uint8Array(dw * dh * 4);
  const xr = sw / dw;
  const yr = sh / dh;
  for (let dy = 0; dy < dh; dy++) {
    const sy = Math.min(sh - 1.001, (dy + 0.5) * yr - 0.5);
    const y0 = Math.max(0, Math.floor(sy));
    const fy = sy - y0;
    const y1 = Math.min(sh - 1, y0 + 1);
    for (let dx = 0; dx < dw; dx++) {
      const sx = Math.min(sw - 1.001, (dx + 0.5) * xr - 0.5);
      const x0 = Math.max(0, Math.floor(sx));
      const fx = sx - x0;
      const x1 = Math.min(sw - 1, x0 + 1);
      const p00 = (y0 * sw + x0) * 4;
      const p01 = (y0 * sw + x1) * 4;
      const p10 = (y1 * sw + x0) * 4;
      const p11 = (y1 * sw + x1) * 4;
      const d = (dy * dw + dx) * 4;
      for (let c = 0; c < 4; c++) {
        const top = src[p00 + c] * (1 - fx) + src[p01 + c] * fx;
        const bot = src[p10 + c] * (1 - fx) + src[p11 + c] * fx;
        dst[d + c] = Math.round(top * (1 - fy) + bot * fy);
      }
    }
  }
  return dst;
}

/** Bilinear resize of a single-channel float mask. */
function resizeMaskBilinear(src, sw, sh, dw, dh) {
  const dst = new Float32Array(dw * dh);
  const xr = sw / dw;
  const yr = sh / dh;
  for (let dy = 0; dy < dh; dy++) {
    const sy = Math.min(sh - 1.001, (dy + 0.5) * yr - 0.5);
    const y0 = Math.max(0, Math.floor(sy));
    const fy = sy - y0;
    const y1 = Math.min(sh - 1, y0 + 1);
    for (let dx = 0; dx < dw; dx++) {
      const sx = Math.min(sw - 1.001, (dx + 0.5) * xr - 0.5);
      const x0 = Math.max(0, Math.floor(sx));
      const fx = sx - x0;
      const x1 = Math.min(sw - 1, x0 + 1);
      const top = src[y0 * sw + x0] * (1 - fx) + src[y0 * sw + x1] * fx;
      const bot = src[y1 * sw + x0] * (1 - fx) + src[y1 * sw + x1] * fx;
      dst[dy * dw + dx] = top * (1 - fy) + bot * fy;
    }
  }
  return dst;
}

/** ImageNet-normalised CHW float32 input, the preprocessing BiRefNet expects. */
function toModelInput(rgba1024) {
  const n = MODEL_INPUT * MODEL_INPUT;
  const out = new Float32Array(3 * n);
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      out[c * n + i] = (rgba1024[i * 4 + c] / 255 - mean[c]) / std[c];
    }
  }
  return out;
}

function float32ToFloat16Bits(f32) {
  const out = new Uint16Array(f32.length);
  const buf = new DataView(new ArrayBuffer(4));
  for (let i = 0; i < f32.length; i++) {
    buf.setFloat32(0, f32[i], true);
    const bits = buf.getUint32(0, true);
    const sign = (bits >>> 16) & 0x8000;
    let exp = ((bits >>> 23) & 0xff) - 127 + 15;
    let mant = (bits >>> 13) & 0x3ff;
    if (exp <= 0) { exp = 0; mant = 0; } else if (exp >= 31) { exp = 31; mant = 0; }
    out[i] = sign | (exp << 10) | mant;
  }
  return out;
}

function float16BitsToFloat32(u16) {
  const out = new Float32Array(u16.length);
  for (let i = 0; i < u16.length; i++) {
    const h = u16[i];
    const sign = (h & 0x8000) ? -1 : 1;
    const exp = (h >>> 10) & 0x1f;
    const mant = h & 0x3ff;
    if (exp === 0) out[i] = sign * mant * 2 ** -24;
    else if (exp === 31) out[i] = mant ? NaN : sign * Infinity;
    else out[i] = sign * (1 + mant / 1024) * 2 ** (exp - 15);
  }
  return out;
}

const sigmoid = (v) => 1 / (1 + Math.exp(-v));

// ---------- the probe ----------

/**
 * Loads the model, runs a real inference on the synthetic image, applies the
 * loose gate criteria, measures time and memory. Returns a plain JSON report.
 */
async function runProbe(options = {}) {
  const report = {
    environment: options.environment || 'node',
    node: process.version,
    electron: process.versions.electron || null,
    pid: process.pid,
    cpu: os.cpus()[0]?.model?.trim() || 'unknown',
    logicalCores: os.cpus().length,
    requestedProvider: options.ep || 'cpu',
    steps: [],
    pass: false,
  };
  const step = (name, detail) => {
    report.steps.push({ name, ...detail });
    console.error(`[probe] ${name}: ${detail.ok === false ? 'FAILED ' + detail.error : 'ok'}`);
  };

  // 1. The native module loads.
  let ort;
  const tLoad = process.hrtime.bigint();
  try {
    ort = require('onnxruntime-node');
    step('require onnxruntime-node', {
      ok: true,
      ms: Number(process.hrtime.bigint() - tLoad) / 1e6,
      version: require('onnxruntime-node/package.json').version,
    });
  } catch (error) {
    step('require onnxruntime-node', { ok: false, error: String(error) });
    return report;
  }

  // 2. The model file is present (fetched by scripts/fetch-models.mjs).
  const modelName = options.model || 'birefnet_lite_fp16.onnx';
  const modelPath = options.modelPath ||
    path.join(__dirname, '..', '..', 'models', modelName);
  report.model = path.basename(modelPath);
  if (!fs.existsSync(modelPath)) {
    step('model file present', {
      ok: false,
      error: `Model not found at ${modelPath}. Run: node scripts/fetch-models.mjs lite`,
    });
    return report;
  }
  step('model file present', { ok: true, path: modelPath, bytes: fs.statSync(modelPath).size });

  // 3. A session is created with the requested engine. DirectML (the GPU
  //    engine that ships, Microsoft-signed, inside onnxruntime-node) falls
  //    back to CPU if it cannot start — and the report says so honestly.
  let session;
  let providerUsed = 'cpu';
  const tSession = process.hrtime.bigint();
  try {
    if ((options.ep || 'cpu') === 'dml') {
      try {
        session = await ort.InferenceSession.create(modelPath, {
          executionProviders: ['dml'],
          graphOptimizationLevel: 'all',
          enableMemPattern: false, // DirectML requirement
        });
        providerUsed = 'dml';
      } catch (dmlError) {
        console.error(`[probe] DirectML unavailable, falling back to CPU: ${dmlError}`);
        report.dmlFallbackError = String(dmlError);
      }
    }
    if (!session) {
      session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
      });
    }
    report.providerUsed = providerUsed;
    step(`create session (${providerUsed})`, {
      ok: true,
      ms: Number(process.hrtime.bigint() - tSession) / 1e6,
      inputs: session.inputNames,
      outputs: session.outputNames,
    });
  } catch (error) {
    step('create session', { ok: false, error: String(error) });
    return report;
  }

  // Load-only mode: the OQ-020 question is answered once the native module
  // has loaded and built a session over the real model in this process type.
  if (options.loadOnly) {
    report.memory = { rssMB: Math.round(process.memoryUsage().rss / 1e6) };
    report.pass = report.steps.every((s) => s.ok !== false);
    return report;
  }

  // 4. Generate the synthetic photo at typical phone-photo size.
  const width = options.width || 3000;
  const height = options.height || 4000;
  const tGen = process.hrtime.bigint();
  const image = generateTestImage(width, height);
  step('generate test image', {
    ok: true,
    ms: Number(process.hrtime.bigint() - tGen) / 1e6,
    size: `${width}x${height}`,
  });

  // 5. Run the full per-photo pipeline: resize down, normalise, infer,
  //    resize the mask back up. One warm-up, then timed runs.
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  const runOnce = async () => {
    // Stage 1: shrink the photo to the model's fixed 1024x1024 input.
    const t0 = process.hrtime.bigint();
    const small = resizeRgbaBilinear(image.rgba, width, height, MODEL_INPUT, MODEL_INPUT);
    const f32 = toModelInput(small);
    const t1 = process.hrtime.bigint();
    // Stage 2: the model itself.
    let feeds;
    let usedType = 'float32';
    try {
      feeds = { [inputName]: new ort.Tensor('float32', f32, [1, 3, MODEL_INPUT, MODEL_INPUT]) };
      var results = await session.run(feeds);
    } catch (error) {
      // fp16-converted models can require float16 inputs; try that before giving up.
      usedType = 'float16';
      feeds = {
        [inputName]: new ort.Tensor('float16', float32ToFloat16Bits(f32), [1, 3, MODEL_INPUT, MODEL_INPUT]),
      };
      results = await session.run(feeds);
    }
    const t2 = process.hrtime.bigint();
    // Stage 3: scale the mask back up to the photo's size.
    const out = results[outputName];
    let logits;
    if (out.type === 'float16') logits = float16BitsToFloat32(out.data);
    else logits = Float32Array.from(out.data);
    const mask1024 = new Float32Array(logits.length);
    for (let i = 0; i < logits.length; i++) mask1024[i] = sigmoid(logits[i]);
    const maskFull = resizeMaskBilinear(mask1024, MODEL_INPUT, MODEL_INPUT, width, height);
    const t3 = process.hrtime.bigint();
    return {
      ms: Number(t3 - t0) / 1e6,
      stages: {
        shrinkToModelMs: Math.round(Number(t1 - t0) / 1e6),
        inferenceMs: Math.round(Number(t2 - t1) / 1e6),
        maskUpscaleMs: Math.round(Number(t3 - t2) / 1e6),
      },
      usedType,
      outDims: out.dims,
      mask1024,
      maskFull,
    };
  };

  let result;
  const runs = options.runs ?? 3;
  try {
    const times = [];
    for (let i = 0; i < runs; i++) {
      result = await runOnce();
      times.push(result.ms);
      console.error(`[probe] run ${i + 1}/${runs}: ${Math.round(result.ms)} ms (input ${result.usedType})`);
    }
    const sorted = [...times].sort((a, b) => a - b);
    step('inference (full per-photo pipeline)', {
      ok: true,
      timedRunsMs: times.map((t) => Math.round(t)),
      medianMs: Math.round(sorted[Math.floor(sorted.length / 2)]),
      lastRunStagesMs: result.stages,
      inputType: result.usedType,
      outputDims: result.outDims,
    });
  } catch (error) {
    step('inference (full per-photo pipeline)', { ok: false, error: String(error) });
    return report;
  }

  // 6. Loose gate criteria: right dimensions, mask neither empty nor solid,
  //    and the figure region reads brighter than the background region.
  const dimsOk =
    result.outDims.length === 4 &&
    result.outDims[2] === MODEL_INPUT &&
    result.outDims[3] === MODEL_INPUT;
  let figureSum = 0;
  let figureCount = 0;
  let bgSum = 0;
  let bgCount = 0;
  let foreground = 0;
  const total = width * height;
  for (let i = 0; i < total; i++) {
    const v = result.maskFull[i];
    if (v > 0.5) foreground++;
    if (image.truth[i]) { figureSum += v; figureCount++; } else { bgSum += v; bgCount++; }
  }
  const stats = {
    outputDimensionsCorrect: dimsOk,
    foregroundFraction: +(foreground / total).toFixed(4),
    meanMaskInFigureRegion: +(figureSum / figureCount).toFixed(4),
    meanMaskInBackgroundRegion: +(bgSum / bgCount).toFixed(4),
  };
  const notEmpty = stats.foregroundFraction > 0.01;
  const notSolid = stats.foregroundFraction < 0.9;
  const separates = stats.meanMaskInFigureRegion > stats.meanMaskInBackgroundRegion;
  step('mask sanity (loose, per the gate rule)', {
    ok: dimsOk && notEmpty && notSolid && separates,
    ...stats,
    criteria: { notEmpty, notSolid, figureBrighterThanBackground: separates },
  });

  // Optional: save the full-size mask and cutout as PNGs so the upscaled
  // result can be judged by eye (original pixels + new alpha, no canvas).
  if (options.saveDir) {
    const { encodePngRgba } = require('./png.cjs');
    fs.mkdirSync(options.saveDir, { recursive: true });
    const tag = `${path.basename(modelPath, '.onnx')}-${providerUsed}`;
    const maskRgba = new Uint8Array(width * height * 4);
    const cutoutRgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const a = Math.round(Math.max(0, Math.min(1, result.maskFull[i])) * 255);
      maskRgba[i * 4] = maskRgba[i * 4 + 1] = maskRgba[i * 4 + 2] = a;
      maskRgba[i * 4 + 3] = 255;
      cutoutRgba[i * 4] = image.rgba[i * 4];
      cutoutRgba[i * 4 + 1] = image.rgba[i * 4 + 1];
      cutoutRgba[i * 4 + 2] = image.rgba[i * 4 + 2];
      cutoutRgba[i * 4 + 3] = a;
    }
    const maskPath = path.join(options.saveDir, `${tag}-mask.png`);
    const cutoutPath = path.join(options.saveDir, `${tag}-cutout.png`);
    fs.writeFileSync(maskPath, encodePngRgba(maskRgba, width, height));
    fs.writeFileSync(cutoutPath, encodePngRgba(cutoutRgba, width, height));
    report.saved = { mask: maskPath, cutout: cutoutPath };
  }

  report.memory = {
    rssMB: Math.round(process.memoryUsage().rss / 1e6),
    note: 'RSS of this process after inference; peak sampled externally.',
  };
  report.pass = report.steps.every((s) => s.ok !== false);
  return report;
}

module.exports = { runProbe, generateTestImage, resizeRgbaBilinear, resizeMaskBilinear };
