// The segmentation queue (ADR-017): jobs run one at a time in an Electron
// utility process; the UI never blocks. The design rule from the Phase 3
// plan: imports enqueue jobs, each job reports status (queued / cutting
// out / done / failed), and a job can be cancelled — a queued job is
// removed, a running one is stopped by ending the worker process (ONNX
// Runtime cannot abort a run in flight; ending the process truly stops the
// compute).
//
// Memory policy (DOC-13 §10.3): the worker keeps its loaded model between
// jobs while the queue has work, and the whole worker process is ended the
// moment the queue goes idle — everything returns to the OS. The next job
// pays one respawn + model load (~5–8 s), which only happens after a quiet
// period.
//
// The Electron pieces (utilityProcess, app paths) are behind a small
// factory so the queue's behaviour is testable in plain unit tests with a
// fake worker.

import type {
  FromWorkerMessage,
  SegmentationJobUpdate,
  SegmentationModel,
  SegmentationTimings,
  WorkerRunMessage
} from '../../shared/segmentation/types';

/** The slice of a utility process the queue needs (fakeable in tests). */
export interface WorkerHandle {
  postMessage(message: WorkerRunMessage): void;
  kill(): void;
  onMessage(listener: (message: FromWorkerMessage) => void): void;
  onExit(listener: (code: number) => void): void;
}

export type WorkerFactory = () => WorkerHandle;

/** The real thing: forks app/main/segmentation/worker.ts (built alongside main). */
function electronWorkerFactory(): WorkerHandle {
  // Lazy require so importing this module never drags Electron into tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app, utilityProcess } = require('electron') as typeof import('electron');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require('node:path') as typeof import('node:path');
  const modelsDir = app.isPackaged
    ? join(process.resourcesPath, 'models')
    : join(app.getAppPath(), 'models');
  const child = utilityProcess.fork(join(__dirname, 'segmentation-worker.js'), [], {
    serviceName: 'papercut-segmentation',
    env: { ...process.env, PAPERCUT_MODELS_DIR: modelsDir }
  });
  return {
    postMessage: (message) => child.postMessage(message),
    kill: () => child.kill(),
    onMessage: (listener) => child.on('message', listener),
    onExit: (listener) => child.on('exit', listener)
  };
}

export interface SegmentationJobResult {
  readonly cutoutPng: Uint8Array;
  readonly timings: SegmentationTimings;
  readonly workerRssAfterMB: number;
}

interface Job {
  readonly jobId: string;
  readonly model: SegmentationModel;
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
  readonly resolve: (result: SegmentationJobResult) => void;
  readonly reject: (error: Error) => void;
}

export class CancelledError extends Error {
  constructor() {
    super('Cutout cancelled.');
    this.name = 'CancelledError';
  }
}

export class SegmentationService {
  private pending: Job[] = [];
  private running: Job | undefined;
  private worker: WorkerHandle | undefined;
  private updateListeners = new Set<(update: SegmentationJobUpdate) => void>();

  constructor(private readonly workerFactory: WorkerFactory = electronWorkerFactory) {}

  /** The Assets panel (and the checks) subscribe here for status pushes. */
  onUpdate(listener: (update: SegmentationJobUpdate) => void): () => void {
    this.updateListeners.add(listener);
    return () => this.updateListeners.delete(listener);
  }

  private emit(update: SegmentationJobUpdate): void {
    for (const listener of this.updateListeners) listener(update);
  }

  /** Queues one cutout. Resolves with the finished PNG; rejects on failure/cancel. */
  enqueue(
    jobId: string,
    model: SegmentationModel,
    rgba: Uint8Array,
    width: number,
    height: number
  ): Promise<SegmentationJobResult> {
    return new Promise<SegmentationJobResult>((resolve, reject) => {
      this.pending.push({ jobId, model, width, height, rgba, resolve, reject });
      this.emit({ jobId, status: 'queued' });
      this.dispatch();
    });
  }

  /** True if the job was found (still queued or currently running). */
  cancel(jobId: string): boolean {
    const queuedAt = this.pending.findIndex((job) => job.jobId === jobId);
    if (queuedAt >= 0) {
      const job = this.pending[queuedAt];
      this.pending.splice(queuedAt, 1);
      this.emit({ jobId, status: 'cancelled' });
      job?.reject(new CancelledError());
      return true;
    }
    if (this.running?.jobId === jobId) {
      const job = this.running;
      this.running = undefined;
      // Ending the process is the only way to truly stop a run in flight.
      this.stopWorker();
      this.emit({ jobId, status: 'cancelled' });
      job.reject(new CancelledError());
      this.dispatch();
      return true;
    }
    return false;
  }

  /** Queued plus running (the checks assert one-at-a-time behaviour). */
  get depth(): number {
    return this.pending.length + (this.running ? 1 : 0);
  }

  /** True while the worker process exists (the checks assert idle shutdown). */
  get workerAlive(): boolean {
    return this.worker !== undefined;
  }

  private dispatch(): void {
    if (this.running) return;
    const job = this.pending.shift();
    if (!job) {
      // Idle: end the worker so every byte returns to the OS (DOC-13 §10.3).
      this.stopWorker();
      return;
    }
    this.running = job;
    this.ensureWorker().postMessage({
      kind: 'run',
      jobId: job.jobId,
      model: job.model,
      width: job.width,
      height: job.height,
      rgba: job.rgba
    });
  }

  private ensureWorker(): WorkerHandle {
    if (this.worker) return this.worker;
    const worker = this.workerFactory();
    worker.onMessage((message) => {
      if (this.worker === worker) this.onWorkerMessage(message);
    });
    worker.onExit((code) => {
      // Deliberate stops clear this.worker first; reaching here with a
      // running job means the worker died underneath it.
      if (this.worker === worker) {
        this.worker = undefined;
        const job = this.running;
        if (job) {
          this.running = undefined;
          this.emit({
            jobId: job.jobId,
            status: 'failed',
            error: `The cutout worker stopped unexpectedly (code ${code}). The photo was not changed; try again.`
          });
          job.reject(new Error(`Segmentation worker exited with code ${code}.`));
        }
        this.dispatch();
      }
    });
    this.worker = worker;
    return worker;
  }

  private stopWorker(): void {
    const worker = this.worker;
    this.worker = undefined;
    worker?.kill();
  }

  private onWorkerMessage(message: FromWorkerMessage): void {
    if (message.kind === 'released') return;
    const job = this.running;
    if (!job || job.jobId !== message.jobId) return; // stale (e.g. after cancel)
    if (message.kind === 'stage') {
      this.emit({
        jobId: job.jobId,
        status: message.stage === 'loading-model' ? 'loading-model' : 'cutting-out'
      });
      return;
    }
    this.running = undefined;
    if (message.kind === 'done') {
      this.emit({ jobId: job.jobId, status: 'done', timings: message.timings });
      job.resolve({
        cutoutPng: message.cutoutPng,
        timings: message.timings,
        workerRssAfterMB: message.rssAfterMB
      });
    } else {
      this.emit({ jobId: job.jobId, status: 'failed', error: message.message });
      job.reject(new Error(message.message));
    }
    this.dispatch();
  }
}

/** One queue for the whole app (one cutout at a time, ADR-017). */
export const segmentationService = new SegmentationService();
