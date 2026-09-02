// The one place providers are constructed. Everything defaults to the fakes;
// asking for live providers without PAPERCUT_LIVE_AI=1 fails loudly
// (ADR-016). The live tts/agent providers do not exist yet — they arrive
// with the company server (Phases 10-12) and will still pass through the
// same guard.

import { FakeAgentProvider } from './fakeAgent';
import { FakeTtsProvider } from './fakeTts';
import { assertLiveAiAllowed } from './liveGuard';
import type { AgentProvider, TtsProvider } from './types';

export type ProviderMode = 'fake' | 'live';

export interface Providers {
  readonly tts: TtsProvider;
  readonly agent: AgentProvider;
}

export function createProviders(mode: ProviderMode = 'fake'): Providers {
  if (mode === 'live') {
    assertLiveAiAllowed('tts and agent');
    throw new Error(
      'Live providers are not built yet: they arrive with the company server (Phase 10 onward).'
    );
  }
  return {
    tts: new FakeTtsProvider(),
    agent: new FakeAgentProvider()
  };
}
