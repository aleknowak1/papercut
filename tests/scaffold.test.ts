// Scaffold smoke test: the settings other checks rely on are actually set.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');

describe('scaffold', () => {
  it('TypeScript strict mode is on', () => {
    const tsconfig = JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8'));
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it('the app has a version number for the Home screen', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
