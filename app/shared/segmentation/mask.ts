// Pure mask-editing operations for the mask editor (M-2.4): brush stamps,
// edge feathering, and the patch mechanism its local undo uses. Plain
// arithmetic on a Uint8Array alpha mask (0 = removed, 255 = kept) — no
// canvas, no DOM — so a known stroke on a known mask gives exactly the
// expected pixels in a unit test.

export interface DirtyRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type BrushMode = 'add' | 'erase';

/**
 * Stamps one circular brush dab. The centre is fully applied; the last
 * ~1.5 px of the radius fades out so edges are not jagged. Returns the
 * touched rectangle (clamped to the mask), or undefined if nothing was hit.
 */
export function stampBrush(
  mask: Uint8Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number,
  mode: BrushMode
): DirtyRect | undefined {
  const target = mode === 'add' ? 255 : 0;
  const x0 = Math.max(0, Math.floor(centerX - radius));
  const y0 = Math.max(0, Math.floor(centerY - radius));
  const x1 = Math.min(width - 1, Math.ceil(centerX + radius));
  const y1 = Math.min(height - 1, Math.ceil(centerY + radius));
  if (x1 < x0 || y1 < y0) return undefined;
  const edge = Math.min(1.5, radius); // soft rim width in pixels
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > radius) continue;
      const coverage = Math.min(1, (radius - distance) / edge);
      const i = y * width + x;
      mask[i] = Math.round(target * coverage + (mask[i] ?? 0) * (1 - coverage));
    }
  }
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/**
 * Softens the mask's edges: two passes of a separable box blur of the given
 * radius (a good gaussian approximation). radius 0 changes nothing.
 */
export function featherMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number
): void {
  if (radius <= 0) return;
  const r = Math.round(radius);
  const temp = new Float32Array(width * height);
  const current = new Float32Array(mask);
  for (let pass = 0; pass < 2; pass++) {
    // Horizontal.
    for (let y = 0; y < height; y++) {
      let sum = 0;
      const row = y * width;
      for (let x = -r; x <= r; x++) sum += current[row + Math.max(0, Math.min(width - 1, x))] ?? 0;
      for (let x = 0; x < width; x++) {
        temp[row + x] = sum / (2 * r + 1);
        const leaving = Math.max(0, Math.min(width - 1, x - r));
        const entering = Math.max(0, Math.min(width - 1, x + r + 1));
        sum += (current[row + entering] ?? 0) - (current[row + leaving] ?? 0);
      }
    }
    // Vertical.
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += temp[Math.max(0, Math.min(height - 1, y)) * width + x] ?? 0;
      for (let y = 0; y < height; y++) {
        current[y * width + x] = sum / (2 * r + 1);
        const leaving = Math.max(0, Math.min(height - 1, y - r));
        const entering = Math.max(0, Math.min(height - 1, y + r + 1));
        sum += (temp[entering * width + x] ?? 0) - (temp[leaving * width + x] ?? 0);
      }
    }
  }
  for (let i = 0; i < mask.length; i++) mask[i] = Math.round(current[i] ?? 0);
}

// ---- patches: what the editor's local undo stores (memory ∝ painted area) ----

export interface MaskPatch {
  readonly rect: DirtyRect;
  /** The mask bytes of rect BEFORE the change, row by row. */
  readonly before: Uint8Array;
}

/** Copies rect's bytes out of the mask (call BEFORE changing them). */
export function extractPatch(mask: Uint8Array, width: number, rect: DirtyRect): MaskPatch {
  const before = new Uint8Array(rect.width * rect.height);
  for (let y = 0; y < rect.height; y++) {
    const from = (rect.y + y) * width + rect.x;
    before.set(mask.subarray(from, from + rect.width), y * rect.width);
  }
  return { rect, before };
}

/** Puts a patch's bytes back (undoing whatever happened inside its rect). */
export function applyPatch(mask: Uint8Array, width: number, patch: MaskPatch): void {
  for (let y = 0; y < patch.rect.height; y++) {
    const to = (patch.rect.y + y) * width + patch.rect.x;
    mask.set(patch.before.subarray(y * patch.rect.width, (y + 1) * patch.rect.width), to);
  }
}
