// The segmentation worker's job types and message protocol (ADR-017).
// The worker is an Electron utility process (a separate OS process, DOC-03
// §1 "workers"); these types are shared by the worker, the main-process
// queue, and the renderer's Assets panel.

export type SegmentationModel = 'lite' | 'hd';

/** What the queue reports about one job as it moves along. */
export type SegmentationJobStatus =
  | 'queued'
  | 'loading-model'
  | 'cutting-out'
  | 'done'
  | 'failed'
  | 'cancelled';

export interface SegmentationTimings {
  readonly loadModelMs?: number;
  readonly shrinkMs: number;
  readonly modelMs: number;
  readonly maskMs: number;
  readonly encodeMs: number;
  readonly totalMs: number;
}

/** Sent from the queue to the worker. Pixels are raw RGBA (already capped). */
export interface WorkerRunMessage {
  readonly kind: 'run';
  readonly jobId: string;
  readonly model: SegmentationModel;
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

/** Tells the worker to drop any loaded model and give its memory back. */
export interface WorkerReleaseMessage {
  readonly kind: 'release';
}

export type ToWorkerMessage = WorkerRunMessage | WorkerReleaseMessage;

export interface WorkerStageMessage {
  readonly kind: 'stage';
  readonly jobId: string;
  readonly stage: 'loading-model' | 'shrinking' | 'model' | 'mask' | 'encoding';
}

export interface WorkerDoneMessage {
  readonly kind: 'done';
  readonly jobId: string;
  /** The finished cutout: original pixels + new alpha, as a PNG file. */
  readonly cutoutPng: Uint8Array;
  readonly timings: SegmentationTimings;
  /** Worker process memory after the job, for the memory rule check. */
  readonly rssAfterMB: number;
}

export interface WorkerErrorMessage {
  readonly kind: 'error';
  readonly jobId: string;
  readonly message: string;
}

export interface WorkerReleasedMessage {
  readonly kind: 'released';
  readonly rssAfterMB: number;
}

export type FromWorkerMessage =
  | WorkerStageMessage
  | WorkerDoneMessage
  | WorkerErrorMessage
  | WorkerReleasedMessage;

/** What the Assets panel sees for each job (pushed over IPC). */
export interface SegmentationJobUpdate {
  readonly jobId: string;
  readonly status: SegmentationJobStatus;
  /** Present when status is 'failed'. Plain language. */
  readonly error?: string;
  /** Present when status is 'done'. */
  readonly timings?: SegmentationTimings;
}
