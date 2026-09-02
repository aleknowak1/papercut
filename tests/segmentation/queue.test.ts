// The segmentation queue's behaviour (ADR-017): one job at a time, status
// updates, cancellation of queued and running jobs, worker ended when idle,
// and a crashed worker failing the job in plain language. Uses a fake
// worker; the real worker + model are exercised by scripts/check-segmentation.mjs.

import { describe, expect, it } from 'vitest';
import { CancelledError, SegmentationService } from '../../app/main/segmentation/service';
import type { WorkerHandle } from '../../app/main/segmentation/service';
import type {
  FromWorkerMessage,
  SegmentationJobUpdate,
  WorkerRunMessage
} from '../../app/shared/segmentation/types';

class FakeWorker implements WorkerHandle {
  received: WorkerRunMessage[] = [];
  killed = false;
  private messageListener: ((message: FromWorkerMessage) => void) | undefined;
  private exitListener: ((code: number) => void) | undefined;

  postMessage(message: WorkerRunMessage): void {
    this.received.push(message);
  }
  kill(): void {
    this.killed = true;
  }
  onMessage(listener: (message: FromWorkerMessage) => void): void {
    this.messageListener = listener;
  }
  onExit(listener: (code: number) => void): void {
    this.exitListener = listener;
  }

  emit(message: FromWorkerMessage): void {
    this.messageListener?.(message);
  }
  crash(code: number): void {
    this.exitListener?.(code);
  }
  finishJob(jobId: string): void {
    this.emit({
      kind: 'done',
      jobId,
      cutoutPng: new Uint8Array([1]),
      timings: { shrinkMs: 1, modelMs: 2, maskMs: 1, encodeMs: 1, totalMs: 5 },
      rssAfterMB: 100
    });
  }
}

function serviceWithFakes(): { service: SegmentationService; workers: FakeWorker[] } {
  const workers: FakeWorker[] = [];
  const service = new SegmentationService(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  return { service, workers };
}

const rgba = new Uint8Array(4);

describe('one job at a time', () => {
  it('holds the second job until the first finishes', async () => {
    const { service, workers } = serviceWithFakes();
    const first = service.enqueue('a', 'lite', rgba, 1, 1);
    const second = service.enqueue('b', 'lite', rgba, 1, 1);
    expect(workers).toHaveLength(1);
    expect(workers[0]!.received.map((m) => m.jobId)).toEqual(['a']);
    expect(service.depth).toBe(2);

    workers[0]!.finishJob('a');
    await first;
    expect(workers[0]!.received.map((m) => m.jobId)).toEqual(['a', 'b']);
    workers[0]!.finishJob('b');
    await second;
    expect(service.depth).toBe(0);
  });

  it('keeps the worker between jobs and ends it when the queue is idle', async () => {
    const { service, workers } = serviceWithFakes();
    const first = service.enqueue('a', 'lite', rgba, 1, 1);
    const second = service.enqueue('b', 'lite', rgba, 1, 1);
    workers[0]!.finishJob('a');
    expect(workers[0]!.killed).toBe(false); // still needed for job b
    workers[0]!.finishJob('b');
    await Promise.all([first, second]);
    expect(workers[0]!.killed).toBe(true); // idle -> memory back to the OS
    expect(service.workerAlive).toBe(false);
    expect(workers).toHaveLength(1); // never a second process
  });
});

describe('status updates', () => {
  it('reports queued, then cutting out, then done', async () => {
    const { service, workers } = serviceWithFakes();
    const updates: SegmentationJobUpdate[] = [];
    service.onUpdate((update) => updates.push(update));
    const job = service.enqueue('a', 'lite', rgba, 1, 1);
    workers[0]!.emit({ kind: 'stage', jobId: 'a', stage: 'loading-model' });
    workers[0]!.emit({ kind: 'stage', jobId: 'a', stage: 'model' });
    workers[0]!.finishJob('a');
    await job;
    expect(updates.map((u) => u.status)).toEqual(['queued', 'loading-model', 'cutting-out', 'done']);
  });
});

describe('cancellation', () => {
  it('removes a queued job without touching the worker', async () => {
    const { service, workers } = serviceWithFakes();
    const first = service.enqueue('a', 'lite', rgba, 1, 1);
    const second = service.enqueue('b', 'lite', rgba, 1, 1);
    expect(service.cancel('b')).toBe(true);
    await expect(second).rejects.toBeInstanceOf(CancelledError);
    expect(workers[0]!.killed).toBe(false);
    workers[0]!.finishJob('a');
    await first;
  });

  it('stops the worker process to cancel a running job, then continues the queue', async () => {
    const { service, workers } = serviceWithFakes();
    const first = service.enqueue('a', 'lite', rgba, 1, 1);
    const second = service.enqueue('b', 'lite', rgba, 1, 1);
    expect(service.cancel('a')).toBe(true);
    await expect(first).rejects.toBeInstanceOf(CancelledError);
    expect(workers[0]!.killed).toBe(true); // the only way to stop a run in flight
    expect(workers).toHaveLength(2); // a fresh worker picked up job b
    expect(workers[1]!.received.map((m) => m.jobId)).toEqual(['b']);
    workers[1]!.finishJob('b');
    await second;
  });

  it('returns false for a job it does not know', () => {
    const { service } = serviceWithFakes();
    expect(service.cancel('nope')).toBe(false);
  });
});

describe('a crashed worker', () => {
  it('fails the running job in plain language and serves the next job', async () => {
    const { service, workers } = serviceWithFakes();
    const updates: SegmentationJobUpdate[] = [];
    service.onUpdate((update) => updates.push(update));
    const first = service.enqueue('a', 'lite', rgba, 1, 1);
    const second = service.enqueue('b', 'lite', rgba, 1, 1);
    workers[0]!.crash(9);
    await expect(first).rejects.toThrow(/exited with code 9/);
    const failed = updates.find((u) => u.status === 'failed');
    expect(failed?.error).toMatch(/stopped unexpectedly/);
    expect(failed?.error).toMatch(/photo was not changed/);
    expect(workers).toHaveLength(2);
    workers[1]!.finishJob('b');
    await second;
  });
});
