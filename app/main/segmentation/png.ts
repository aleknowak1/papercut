// PNG encode/decode for raw RGBA pixels, using only zlib (Node's built-in
// in the main/worker processes; the renderer never needs this module).
// Written by hand so cutout pixels never pass through a browser canvas —
// canvases premultiply alpha and can subtly alter colours, which would
// break the "original pixels + new alpha" rule (DOC-01 §5).
//
// Scope: 8-bit RGB/RGBA, no interlace, no palette — everything this app
// writes itself. Anything else is refused with a plain error (user files
// are decoded by Chromium in the renderer, not here).

import { deflateSync, inflateSync } from 'node:zlib';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

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
  for (let i = 0; i < bytes.length; i++) {
    c = (CRC_TABLE[(c ^ (bytes[i] ?? 0)) & 0xff] ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** Encodes raw RGBA pixels as a PNG file (filter 0, RGBA 8-bit). */
export function encodePngRgba(rgba: Uint8Array, width: number, height: number): Buffer {
  if (rgba.length !== width * height * 4) {
    throw new Error(`encodePngRgba: expected ${width * height * 4} bytes, got ${rgba.length}`);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from(PNG_SIGNATURE),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

export interface DecodedPng {
  readonly width: number;
  readonly height: number;
  /** Always RGBA, 4 bytes per pixel (RGB input gets alpha 255). */
  readonly rgba: Uint8Array;
}

/** Decodes an 8-bit RGB/RGBA non-interlaced PNG (filters 0–4). */
export function decodePngRgba(file: Uint8Array): DecodedPng {
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (file[i] !== PNG_SIGNATURE[i]) throw new Error('Not a PNG file.');
  }
  const view = Buffer.from(file.buffer, file.byteOffset, file.byteLength);
  let pos = 8;
  let width = 0;
  let height = 0;
  let colourType = -1;
  const idat: Buffer[] = [];
  while (pos + 12 <= view.length) {
    const length = view.readUInt32BE(pos);
    const type = view.toString('ascii', pos + 4, pos + 8);
    const data = view.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8] ?? 0;
      colourType = data[9] ?? -1;
      if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth ${bitDepth} (only 8).`);
      if (colourType !== 6 && colourType !== 2) {
        throw new Error(`Unsupported PNG colour type ${colourType} (only RGB/RGBA).`);
      }
      if (data[12] !== 0) throw new Error('Interlaced PNGs are not supported here.');
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + length;
  }
  if (width === 0 || height === 0 || idat.length === 0) throw new Error('Malformed PNG.');

  const channels = colourType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length !== (stride + 1) * height) throw new Error('PNG pixel data has the wrong size.');

  // Undo per-scanline filters (PNG spec: none/sub/up/average/paeth).
  const unfiltered = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = unfiltered.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? unfiltered.subarray((y - 1) * stride, y * stride) : undefined;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? (out[x - channels] ?? 0) : 0;
      const up = prev ? (prev[x] ?? 0) : 0;
      const upLeft = prev && x >= channels ? (prev[x - channels] ?? 0) : 0;
      let value = line[x] ?? 0;
      switch (filter) {
        case 0:
          break;
        case 1:
          value = (value + left) & 0xff;
          break;
        case 2:
          value = (value + up) & 0xff;
          break;
        case 3:
          value = (value + ((left + up) >> 1)) & 0xff;
          break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          const paeth = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
          value = (value + paeth) & 0xff;
          break;
        }
        default:
          throw new Error(`Unknown PNG filter type ${filter}.`);
      }
      out[x] = value;
    }
  }

  if (channels === 4) return { width, height, rgba: new Uint8Array(unfiltered) };
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = unfiltered[i * 3] ?? 0;
    rgba[i * 4 + 1] = unfiltered[i * 3 + 1] ?? 0;
    rgba[i * 4 + 2] = unfiltered[i * 3 + 2] ?? 0;
    rgba[i * 4 + 3] = 255;
  }
  return { width, height, rgba };
}
