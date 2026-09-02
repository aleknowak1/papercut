// Pure pixel operations for the cutout pipeline (ADR-017, DOC-13 §9.5).
// Everything here is plain arithmetic on raw RGBA buffers — no canvas, no
// native code — so the "original pixels + new alpha" rule (DOC-01 §5) is
// enforceable byte for byte and testable in ordinary unit tests.

/** The model's fixed input size. BiRefNet accepts exactly 1024×1024. */
export const MODEL_INPUT_SIZE = 1024;

/** Working copies for cutouts are capped at this long-edge size (ADR-017). */
export const WORKING_COPY_MAX_LONG_EDGE = 4096;

export interface PixelSize {
  readonly width: number;
  readonly height: number;
}

/**
 * The size a photo's working copy should have: unchanged when the long edge
 * is within the cap, otherwise scaled down proportionally so the long edge
 * equals the cap. Never scales up.
 */
export function cappedWorkingSize(width: number, height: number): PixelSize {
  const longEdge = Math.max(width, height);
  if (longEdge <= WORKING_COPY_MAX_LONG_EDGE) return { width, height };
  const scale = WORKING_COPY_MAX_LONG_EDGE / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

/** Bilinear resize of raw RGBA pixels. */
export function resizeRgbaBilinear(
  src: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): Uint8Array {
  const dst = new Uint8Array(dstWidth * dstHeight * 4);
  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;
  for (let dy = 0; dy < dstHeight; dy++) {
    const sy = Math.min(srcHeight - 1.001, Math.max(0, (dy + 0.5) * yRatio - 0.5));
    const y0 = Math.floor(sy);
    const fy = sy - y0;
    const y1 = Math.min(srcHeight - 1, y0 + 1);
    for (let dx = 0; dx < dstWidth; dx++) {
      const sx = Math.min(srcWidth - 1.001, Math.max(0, (dx + 0.5) * xRatio - 0.5));
      const x0 = Math.floor(sx);
      const fx = sx - x0;
      const x1 = Math.min(srcWidth - 1, x0 + 1);
      const p00 = (y0 * srcWidth + x0) * 4;
      const p01 = (y0 * srcWidth + x1) * 4;
      const p10 = (y1 * srcWidth + x0) * 4;
      const p11 = (y1 * srcWidth + x1) * 4;
      const d = (dy * dstWidth + dx) * 4;
      for (let c = 0; c < 4; c++) {
        const top = (src[p00 + c] ?? 0) * (1 - fx) + (src[p01 + c] ?? 0) * fx;
        const bottom = (src[p10 + c] ?? 0) * (1 - fx) + (src[p11 + c] ?? 0) * fx;
        dst[d + c] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
  }
  return dst;
}

/** Bilinear resize of a single-channel float mask (values 0..1). */
export function resizeMaskBilinear(
  src: Float32Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): Float32Array {
  const dst = new Float32Array(dstWidth * dstHeight);
  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;
  for (let dy = 0; dy < dstHeight; dy++) {
    const sy = Math.min(srcHeight - 1.001, Math.max(0, (dy + 0.5) * yRatio - 0.5));
    const y0 = Math.floor(sy);
    const fy = sy - y0;
    const y1 = Math.min(srcHeight - 1, y0 + 1);
    for (let dx = 0; dx < dstWidth; dx++) {
      const sx = Math.min(srcWidth - 1.001, Math.max(0, (dx + 0.5) * xRatio - 0.5));
      const x0 = Math.floor(sx);
      const fx = sx - x0;
      const x1 = Math.min(srcWidth - 1, x0 + 1);
      const top = (src[y0 * srcWidth + x0] ?? 0) * (1 - fx) + (src[y0 * srcWidth + x1] ?? 0) * fx;
      const bottom = (src[y1 * srcWidth + x0] ?? 0) * (1 - fx) + (src[y1 * srcWidth + x1] ?? 0) * fx;
      dst[dy * dstWidth + dx] = top * (1 - fy) + bottom * fy;
    }
  }
  return dst;
}

/**
 * ImageNet-normalised planar (CHW) float32 input — the preprocessing
 * BiRefNet expects. Input must be MODEL_INPUT_SIZE² RGBA.
 */
export function rgbaToModelInput(rgba1024: Uint8Array): Float32Array {
  const n = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
  const out = new Float32Array(3 * n);
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      out[c * n + i] = ((rgba1024[i * 4 + c] ?? 0) / 255 - (mean[c] ?? 0)) / (std[c] ?? 1);
    }
  }
  return out;
}

/** Turns the model's raw output (logits) into a 0..1 mask. */
export function logitsToMask(logits: Float32Array): Float32Array {
  const mask = new Float32Array(logits.length);
  for (let i = 0; i < logits.length; i++) mask[i] = 1 / (1 + Math.exp(-(logits[i] ?? 0)));
  return mask;
}

/**
 * The output rule from DOC-01 §5: the cutout is the ORIGINAL pixels with a
 * new alpha channel. RGB bytes are copied through untouched; only alpha is
 * written, from the mask.
 */
export function composeCutout(rgba: Uint8Array, mask: Float32Array): Uint8Array {
  const pixelCount = mask.length;
  const out = new Uint8Array(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    out[i * 4] = rgba[i * 4] ?? 0;
    out[i * 4 + 1] = rgba[i * 4 + 1] ?? 0;
    out[i * 4 + 2] = rgba[i * 4 + 2] ?? 0;
    out[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, mask[i] ?? 0)) * 255);
  }
  return out;
}
