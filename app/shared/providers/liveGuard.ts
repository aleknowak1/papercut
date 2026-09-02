// The AI-spend guard (ADR-016, DOC-09 rule 2). Live, paid AI calls are
// impossible unless Alek has deliberately set PAPERCUT_LIVE_AI=1. Checks,
// builds, and default development sessions never set it, so they can never
// spend money. There is no way around this function: provider factories call
// it before constructing anything that could reach a paid service.

export const LIVE_AI_ENV_VAR = 'PAPERCUT_LIVE_AI';

export function liveAiEnabled(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.[LIVE_AI_ENV_VAR] === '1';
}

export function assertLiveAiAllowed(purpose: string): void {
  if (!liveAiEnabled()) {
    throw new Error(
      `Refusing to use a live paid AI service for "${purpose}". ` +
        `Live calls are off by default (DOC-09); set ${LIVE_AI_ENV_VAR}=1 deliberately to enable them.`
    );
  }
}
