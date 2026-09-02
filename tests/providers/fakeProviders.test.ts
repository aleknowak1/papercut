import { describe, expect, it } from 'vitest';
import { createProviders } from '../../app/shared/providers/factory';

describe('fake providers', () => {
  it('fake TTS returns a valid, deterministic WAV', async () => {
    const { tts } = createProviders();
    const request = { text: 'Hello there, suitcase.', delivery: 'deadpan', voice: 'voice-1' };
    const first = await tts.synthesize(request);
    const second = await tts.synthesize(request);

    const header = String.fromCharCode(...first.audioWav.slice(0, 4));
    expect(header).toBe('RIFF');
    expect(first.durationSeconds).toBeGreaterThan(0);
    // Deterministic byte-for-byte: same input, same audio — the property the
    // caching rule (DOC-09 rule 3) relies on.
    expect(first.audioWav).toEqual(second.audioWav);
  });

  it('longer text produces longer fake audio', async () => {
    const { tts } = createProviders();
    const short = await tts.synthesize({ text: 'Hi.', delivery: '', voice: 'v' });
    const long = await tts.synthesize({
      text: 'This is a much longer line of dialogue that should take a while to say.',
      delivery: '',
      voice: 'v'
    });
    expect(long.durationSeconds).toBeGreaterThan(short.durationSeconds);
  });

  it('fake agent returns a canned proposal with edits', async () => {
    const { agent } = createProviders();
    const proposal = await agent.propose({
      instruction: 'make Dave walk in from the left',
      sceneSummary: 'Scene 1: empty, 10s'
    });
    expect(proposal.edits.length).toBeGreaterThan(0);
    expect(proposal.summary).toContain('make Dave walk in from the left');
  });
});
