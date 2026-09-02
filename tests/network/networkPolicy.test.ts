// ADR-015 check "No unexpected network": the policy allows nothing on the
// network in production, and it is actually wired into the app.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APPROVED_ORIGINS, isRequestAllowed } from '../../app/main/networkPolicy';

describe('network policy', () => {
  it('the production approved-origins list is empty (nothing until Phase 10)', () => {
    expect(APPROVED_ORIGINS).toHaveLength(0);
  });

  it('blocks all outside network requests in production', () => {
    expect(isRequestAllowed('https://example.com/anything')).toBe(false);
    expect(isRequestAllowed('http://example.com/')).toBe(false);
    expect(isRequestAllowed('https://api.example-ai-service.com/v1/audio')).toBe(false);
    expect(isRequestAllowed('wss://example.com/socket')).toBe(false);
    expect(isRequestAllowed('not a url')).toBe(false);
    expect(isRequestAllowed('ftp://example.com/file')).toBe(false);
  });

  it('allows the local schemes the app is built from', () => {
    expect(isRequestAllowed('file:///C:/apps/papercut/out/renderer/index.html')).toBe(true);
    expect(isRequestAllowed('data:image/png;base64,AAAA')).toBe(true);
    expect(isRequestAllowed('blob:file:///some-id')).toBe(true);
    expect(isRequestAllowed('devtools://devtools/bundled/inspector.html')).toBe(true);
  });

  it('allows only the dev server during development', () => {
    const dev = 'http://localhost:5173';
    expect(isRequestAllowed('http://localhost:5173/src/main.tsx', dev)).toBe(true);
    expect(isRequestAllowed('ws://localhost:5173/', dev)).toBe(true);
    expect(isRequestAllowed('http://localhost:9999/', dev)).toBe(false);
    expect(isRequestAllowed('https://example.com/', dev)).toBe(false);
  });

  it('the blocker is wired into the app startup', () => {
    // The policy only protects anything if index.ts actually installs it.
    const source = readFileSync(join(__dirname, '..', '..', 'app', 'main', 'index.ts'), 'utf8');
    expect(source).toContain('isRequestAllowed');
    expect(source).toContain('onBeforeRequest');
    expect(source).toContain('cancel: !allowed');
  });
});
