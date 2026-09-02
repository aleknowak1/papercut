// ADR-015 check "AI-spend guard" (ADR-016, DOC-09): no check, build, or
// default configuration can ever call a paid AI service.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createProviders } from '../../app/shared/providers/factory';
import { LIVE_AI_ENV_VAR, liveAiEnabled } from '../../app/shared/providers/liveGuard';

const appDir = join(__dirname, '..', '..', 'app');

function allSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...allSourceFiles(full));
    else if (/\.(ts|tsx|js|mjs|html|css)$/.test(entry.name)) files.push(full);
  }
  return files;
}

describe('AI-spend guard', () => {
  it(`${LIVE_AI_ENV_VAR} is not set while checks run`, () => {
    expect(process.env[LIVE_AI_ENV_VAR]).toBeUndefined();
    expect(liveAiEnabled()).toBe(false);
  });

  it('the default provider configuration is the fakes', () => {
    const providers = createProviders();
    expect(providers.tts.name).toBe('fake-tts');
    expect(providers.agent.name).toBe('fake-agent');
  });

  it('asking for live providers without the env var fails loudly', () => {
    expect(() => createProviders('live')).toThrow(/PAPERCUT_LIVE_AI/);
  });

  it('no paid AI service address appears anywhere in app code', () => {
    // The app must never talk to a paid AI service directly — at launch it
    // talks only to the company server (ADR-005), and today to nothing.
    const forbidden = /openai|elevenlabs|api\.anthropic/i;
    for (const file of allSourceFiles(appDir)) {
      const text = readFileSync(file, 'utf8');
      expect(forbidden.test(text), `${file} mentions a paid AI service`).toBe(false);
    }
  });
});
