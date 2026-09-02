// The provider layer (DOC-03 §7): one interface per AI capability. The rest
// of the app only ever talks to these interfaces, so where the work happens
// (local model, company server, a fake in tests) can change without app
// changes. v1 wiring: local BiRefNet for segmentation (Phase 3); the company
// server for tts and agent (Phases 10-12). Until then, the fakes.

/** Background removal: image in, PNG with transparency out. */
export interface SegmentationProvider {
  readonly name: string;
  removeBackground(imageBytes: Uint8Array): Promise<Uint8Array>;
}

export interface TtsRequest {
  readonly text: string;
  /** Plain-English delivery instruction, e.g. "deadpan, slightly annoyed". */
  readonly delivery: string;
  readonly voice: string;
}

export interface TtsResult {
  /** A complete WAV file. */
  readonly audioWav: Uint8Array;
  readonly durationSeconds: number;
}

export interface TtsProvider {
  readonly name: string;
  synthesize(request: TtsRequest): Promise<TtsResult>;
}

export interface AgentRequest {
  /** What the user asked for, e.g. "make Dave walk in from the left". */
  readonly instruction: string;
  /** Compact text summary of the current scene — never full JSON, never images (DOC-09 rule 5). */
  readonly sceneSummary: string;
}

/**
 * One proposed edit. The exact operation list is OQ-012, designed against
 * the finished editor; until then this stays a plain description the
 * proposal UI can show.
 */
export interface AgentProposedEdit {
  readonly kind: string;
  readonly description: string;
  readonly params: Readonly<Record<string, string | number | boolean>>;
}

export interface AgentProposal {
  readonly summary: string;
  readonly edits: readonly AgentProposedEdit[];
}

export interface AgentProvider {
  readonly name: string;
  propose(request: AgentRequest): Promise<AgentProposal>;
}
