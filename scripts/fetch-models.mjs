// Downloads the BiRefNet model files into models/ (git-ignored), verifying
// each against the pinned revision and SHA-256 in scripts/model-manifest.json.
// This is the ONLY code in the project that downloads anything; the app never
// does (ADR-009: models are bundled). A file whose hash does not match is
// deleted and the script fails loudly.
//
// Usage:
//   node scripts/fetch-models.mjs lite      (≈115 MB, the automatic cutout model)
//   node scripts/fetch-models.mjs full      (≈490 MB, the HD cutout model)
//   node scripts/fetch-models.mjs --all

import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modelsDir = join(root, 'models');
const manifestPath = join(root, 'scripts', 'model-manifest.json');

async function sha256OfFile(path) {
  const hash = createHash('sha256');
  const { createReadStream } = await import('node:fs');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

async function fetchModel(key, entry) {
  const dest = join(modelsDir, entry.localName);

  // Already present and correct? Then do nothing.
  try {
    const existing = await stat(dest);
    if (existing.size === entry.sizeBytes) {
      const hash = await sha256OfFile(dest);
      if (hash === entry.sha256) {
        console.log(`[${key}] ${entry.localName} already present, hash verified - nothing to do.`);
        return;
      }
    }
    console.log(`[${key}] ${entry.localName} exists but does not match the manifest - re-downloading.`);
    await rm(dest);
  } catch {
    // Not there yet - download it.
  }

  const url = `https://huggingface.co/${entry.repo}/resolve/${entry.revision}/${entry.remotePath}`;
  console.log(`[${key}] downloading ${(entry.sizeBytes / 1e6).toFixed(0)} MB`);
  console.log(`[${key}]   from ${url}`);

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`[${key}] download failed: HTTP ${response.status} ${response.statusText}`);
  }

  const partPath = `${dest}.part`;
  const hash = createHash('sha256');
  let received = 0;
  let lastLogged = 0;
  const counter = async function* (source) {
    for await (const chunk of source) {
      received += chunk.length;
      hash.update(chunk);
      if (received - lastLogged > 25e6) {
        lastLogged = received;
        console.log(`[${key}]   ${(received / 1e6).toFixed(0)} / ${(entry.sizeBytes / 1e6).toFixed(0)} MB`);
      }
      yield chunk;
    }
  };
  await pipeline(Readable.fromWeb(response.body), counter, createWriteStream(partPath));

  const actual = hash.digest('hex');
  if (received !== entry.sizeBytes || actual !== entry.sha256) {
    await rm(partPath, { force: true });
    throw new Error(
      `[${key}] REFUSED: downloaded file does not match the manifest.\n` +
        `  expected ${entry.sizeBytes} bytes, sha256 ${entry.sha256}\n` +
        `  received ${received} bytes, sha256 ${actual}\n` +
        `The partial file has been deleted. Nothing was installed.`,
    );
  }

  await rename(partPath, dest);
  console.log(`[${key}] OK: ${entry.localName} (${received} bytes, sha256 verified).`);
}

const args = process.argv.slice(2);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const keys = args.includes('--all') ? Object.keys(manifest.models) : args.filter((a) => manifest.models[a]);

if (keys.length === 0) {
  console.error('Usage: node scripts/fetch-models.mjs <lite|full|--all>');
  console.error(`Known models: ${Object.keys(manifest.models).join(', ')}`);
  process.exit(2);
}

await mkdir(modelsDir, { recursive: true });
for (const key of keys) {
  await fetchModel(key, manifest.models[key]);
}
console.log('Done. Models live in models/ during development (git-ignored).');
