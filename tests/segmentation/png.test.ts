// The hand-written PNG encode/decode used for cutout files.

import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodePngRgba, encodePngRgba } from '../../app/main/segmentation/png';

function randomRgba(width: number, height: number, seed = 42): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  let s = seed;
  for (let i = 0; i < out.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out[i] = s & 0xff;
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
/** Builds a PNG by hand with a chosen per-scanline filter, to test the decoder. */
function pngWithFilter(width: number, height: number, filter: number, filtered: number[]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = filter;
    for (let x = 0; x < stride; x++) raw[y * (stride + 1) + 1 + x] = filtered[y * stride + x] ?? 0;
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

describe('encode → decode round trip', () => {
  it('returns identical pixels, including alpha', () => {
    const rgba = randomRgba(21, 13);
    const decoded = decodePngRgba(encodePngRgba(rgba, 21, 13));
    expect(decoded.width).toBe(21);
    expect(decoded.height).toBe(13);
    expect(Buffer.from(decoded.rgba).equals(Buffer.from(rgba))).toBe(true);
  });
});

describe('decoder filters (PNG spec)', () => {
  it('undoes the "sub" filter (type 1)', () => {
    // One row, two pixels: raw [10,20,30,40] then deltas [5,5,5,5] → second pixel = [15,25,35,45].
    const png = pngWithFilter(2, 1, 1, [10, 20, 30, 40, 5, 5, 5, 5]);
    const decoded = decodePngRgba(png);
    expect(Array.from(decoded.rgba)).toEqual([10, 20, 30, 40, 15, 25, 35, 45]);
  });

  it('undoes the "up" filter (type 2)', () => {
    // Two rows, one pixel; second row is deltas against the first.
    const raw = Buffer.concat([
      Buffer.from([0, 100, 110, 120, 255]), // row 0: filter none
      Buffer.from([2, 1, 2, 3, 0]) // row 1: filter up
    ]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(1, 0);
    ihdr.writeUInt32BE(2, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0))
    ]);
    const decoded = decodePngRgba(png);
    expect(Array.from(decoded.rgba)).toEqual([100, 110, 120, 255, 101, 112, 123, 255]);
  });
});

describe('refusals in plain language', () => {
  it('refuses non-PNG bytes', () => {
    expect(() => decodePngRgba(new Uint8Array([1, 2, 3]))).toThrow(/Not a PNG/);
  });

  it('refuses a size mismatch when encoding', () => {
    expect(() => encodePngRgba(new Uint8Array(10), 5, 5)).toThrow(/expected/);
  });
});
