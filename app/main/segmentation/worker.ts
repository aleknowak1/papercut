// The segmentation worker: runs INSIDE an Electron utility process — a
// separate OS process, so the model's heavy compute can never freeze the
// window and a native crash can never take the app down (DOC-03 §1,
// ADR-017). Exactly one job runs at a time; the queue in service.ts
// guarantees it never sends a second job before the first answers.
//
// ONNX Runtime settings per DOC-13 §10.2: memory arena OFF (measured both
// faster and returns memory to the OS after each job); everything else at
// defaults. The model stays loaded between jobs and is dropped on
// 'release' (DOC-13 §10.3: resident while working, released when idle).

import { statSync } from 'node:fs';
import { join } from 'node:path';
import type {
  FromWorkerMessage,
  SegmentationModel,
  SegmentationTimings,
  ToWorkerMessage,
  WorkerRunMessage
} from '../../shared/segmentation/types';
import {
  MODEL_INPUT_SIZE,
  composeCutout,
  logitsToMask,
  resizeMaskBilinear,
  resizeRgbaBilinear,
  rgbaToModelInput
} from '../../shared/segmentation/pixels';
import { encodePngRgba } from './png';

// onnxruntime-node is a native module and must not be bundled; it is
// declared external in electron.vite.config.ts and resolved at runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ort = require('onnxruntime-node') as typeof import('onnxruntime-node');

const MODEL_FILES: Record<SegmentationModel, string> = {
  lite: 'birefnet_lite_fp32.onnx',
  hd: 'birefnet_full_fp32.onnx'
};

const modelsDir = process.env['PAPERCUT_MODELS_DIR'];
if (!modelsDir) throw new Error('Segmentation worker started without PAPERCUT_MODELS_DIR.');

const parentPort = process.parentPort;
const post = (message: FromWorkerMessage): void => parentPort.postMessage(message);
const rssMB = (): number => Math.round(process.memoryUsage().rss / 1e6);

type OrtSession = Awaited<ReturnType<typeof ort.InferenceSession.create>>;
const sessions = new Map<SegmentationModel, OrtSession>();

async function getSession(model: SegmentationModel, jobId: string): Promise<{ session: OrtSession; loadModelMs?: number }> {
  const existing = sessions.get(model);
  if (existing) return { session: existing };

  const modelPath = join(modelsDir as string, MODEL_FILES[model]);
  try {
    statSync(modelPath);
  } catch {
    throw new Error(
      `The ${model} cutout model is missing (${modelPath}). ` +
        `Fetch it with: node scripts/fetch-models.mjs ${model === 'lite' ? 'lite' : 'full_fp32'}`
    );
  }
  post({ kind: 'stage', jobId, stage: 'loading-model' });
  const t0 = performance.now();
  const session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
    enableCpuMemArena: false // DOC-13 §10.2: faster AND frees memory after each job
  });
  sessions.set(model, session);
  return { session, loadModelMs: Math.round(performance.now() - t0) };
}

async function runJob(message: WorkerRunMessage): Promise<void> {
  const { jobId, model, width, height, rgba } = message;
  const tTotal = performance.now();
  const { session, loadModelMs } = await getSession(model, jobId);

  post({ kind: 'stage', jobId, stage: 'shrinking' });
  const tShrink = performance.now();
  const small = resizeRgbaBilinear(rgba, width, height, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const input = rgbaToModelInput(small);
  const shrinkMs = Math.round(performance.now() - tShrink);

  post({ kind: 'stage', jobId, stage: 'model' });
  const tModel = performance.now();
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  if (inputName === undefined || outputName === undefined) {
    throw new Error('The model file has no input/output — it looks corrupted; re-fetch it.');
  }
  const results = await session.run({
    [inputName]: new ort.Tensor('float32', input, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE])
  });
  const modelMs = Math.round(performance.now() - tModel);

  post({ kind: 'stage', jobId, stage: 'mask' });
  const tMask = performance.now();
  const output = results[outputName];
  if (output === undefined) throw new Error('The model returned no output.');
  const logits = Float32Array.from(output.data as Float32Array);
  const mask1024 = logitsToMask(logits);
  const mask = resizeMaskBilinear(mask1024, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, width, height);
  const cutout = composeCutout(rgba, mask);
  const maskMs = Math.round(performance.now() - tMask);

  post({ kind: 'stage', jobId, stage: 'encoding' });
  const tEncode = performance.now();
  const cutoutPng = encodePngRgba(cutout, width, height);
  const encodeMs = Math.round(performance.now() - tEncode);

  const timings: SegmentationTimings = {
    loadModelMs,
    shrinkMs,
    modelMs,
    maskMs,
    encodeMs,
    totalMs: Math.round(performance.now() - tTotal)
  };
  post({ kind: 'done', jobId, cutoutPng: new Uint8Array(cutoutPng), timings, rssAfterMB: rssMB() });
}

function releaseSessions(): void {
  for (const session of sessions.values()) {
    void session.release();
  }
  sessions.clear();
  (globalThis as { gc?: () => void }).gc?.();
  post({ kind: 'released', rssAfterMB: rssMB() });
}

parentPort.on('message', (event: { data: ToWorkerMessage }) => {
  const message = event.data;
  if (message.kind === 'release') {
    releaseSessions();
    return;
  }
  runJob(message).catch((error: unknown) => {
    post({ kind: 'error', jobId: message.jobId, message: String(error instanceof Error ? error.message : error) });
  });
});
