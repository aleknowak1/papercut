// The local BiRefNet segmentation provider (ADR-009/ADR-017): the real
// implementation of the SegmentationProvider interface from
// app/shared/providers/types.ts. It lives in the main process — not the
// shared provider factory — because it needs Electron's utility processes;
// the factory keeps serving the fakes for tts/agent (ADR-016).
//
// Image in (PNG), cutout PNG out: original pixels + new alpha (DOC-01 §5).
// Oversized inputs are capped to the 4096 working-copy rule first
// (ADR-017); normal imports arrive already capped by the renderer.

import { randomUUID } from 'node:crypto';
import type { SegmentationProvider } from '../../shared/providers/types';
import {
  cappedWorkingSize,
  resizeRgbaBilinear
} from '../../shared/segmentation/pixels';
import { decodePngRgba } from './png';
import type { SegmentationModel } from '../../shared/segmentation/types';
import { segmentationService } from './service';

export class LocalBiRefNetProvider implements SegmentationProvider {
  readonly name: string;

  constructor(private readonly model: SegmentationModel = 'lite') {
    this.name = model === 'lite' ? 'birefnet-lite-local' : 'birefnet-hd-local';
  }

  async removeBackground(imageBytes: Uint8Array): Promise<Uint8Array> {
    const decoded = decodePngRgba(imageBytes);
    const capped = cappedWorkingSize(decoded.width, decoded.height);
    // Cap the working copy (ADR-017 rule 2); the original file is never touched.
    let rgba = decoded.rgba;
    if (capped.width !== decoded.width || capped.height !== decoded.height) {
      rgba = resizeRgbaBilinear(decoded.rgba, decoded.width, decoded.height, capped.width, capped.height);
    }
    const result = await segmentationService.enqueue(
      randomUUID(),
      this.model,
      rgba,
      capped.width,
      capped.height
    );
    return result.cutoutPng;
  }
}
