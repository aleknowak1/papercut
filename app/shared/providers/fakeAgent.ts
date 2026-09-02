// Fake agent provider (DOC-09 rule 1): returns a canned, deterministic
// proposal so the proposal-review UI and its checks can be built and run
// without ever calling a paid model. The edit list is a placeholder until
// the real agent schema is designed (OQ-012).

import type { AgentProposal, AgentProposedEdit, AgentProvider, AgentRequest } from './types';

export class FakeAgentProvider implements AgentProvider {
  readonly name = 'fake-agent';

  propose(request: AgentRequest): Promise<AgentProposal> {
    const edits: readonly AgentProposedEdit[] = [
        {
          kind: 'add-layer',
          description: 'Add a character layer entering from the left',
          params: { layerName: 'Character', fromX: -200, toX: 300 }
        },
        {
          kind: 'set-keyframe',
          description: 'Slide the layer into place over two seconds',
          params: { time: 2, x: 300, easing: 'ease-out' }
        },
        {
          kind: 'set-tts-line',
          description: 'Say one line, deadpan',
          params: { text: 'Well, this is awkward.', delivery: 'deadpan' }
        }
      ];
    return Promise.resolve({
      summary: `Canned proposal for: ${request.instruction}`,
      edits
    });
  }
}
