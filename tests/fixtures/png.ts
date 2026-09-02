// Writes a minimal, valid PNG image entirely in code — no image library,
// nothing downloaded. Used only by test fixtures (never shipped) to create
// the solid-colour images the export test project needs.
//
// The PNG's pixel data is wrapped in "stored" (uncompressed) zlib blocks,
// which every PNG reader accepts. Files are a little larger than a real
// encoder would make; for tiny solid-colour fixtures that is irrelevant.

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
  let crc = 0xffffffff;
  for (const b of bytes) crc = (CRC_TABLE[(crc ^ b) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Wraps raw bytes in a zlib stream using stored (uncompressed) deflate blocks. */
function zlibStored(raw: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])]; // zlib header
  const MAX = 65535;
  for (let at = 0; at < raw.length; at += MAX) {
    const part = raw.subarray(at, Math.min(at + MAX, raw.length));
    const final = at + MAX >= raw.length ? 1 : 0;
    const header = new Uint8Array(5);
    header[0] = final;
    new DataView(header.buffer).setUint16(1, part.length, true);
    new DataView(header.buffer).setUint16(3, ~part.length & 0xffff, true);
    blocks.push(header, part);
  }
  const trailer = new Uint8Array(4);
  new DataView(trailer.buffer).setUint32(0, adler32(raw));
  blocks.push(trailer);

  const total = blocks.reduce((sum, b) => sum + b.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const b of blocks) {
    out.set(b, at);
    at += b.length;
  }
  return out;
}

/** A width×height PNG filled with one colour (red, green, blue, alpha: 0-255). */
export function solidPng(
  width: number,
  height: number,
  rgba: readonly [number, number, number, number]
): Uint8Array {
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // compression 0, filter 0, interlace 0 stay zero

  // Each scanline: one filter byte (0 = none) then RGBA pixels.
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4);
    for (let x = 0; x < width; x++) {
      raw.set(rgba, row + 1 + x * 4);
    }
  }

  const parts = [
    new Uint8Array(PNG_SIGNATURE),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibStored(raw)),
    chunk('IEND', new Uint8Array(0))
  ];
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
