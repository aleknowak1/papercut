# DOC-07 — Open Questions and Risks

**Status:** Active
**Last updated:** 2026-09-02

Each item has an owner and a "must resolve by" milestone. Closed items stay listed with their resolution.

| ID | Question / Risk | Owner | Resolve by | Status | Resolution |
|----|-----------------|-------|------------|--------|------------|
| OQ-001 | BiRefNet weights are MIT but trained on the DIS5K dataset, which has academic terms. | — | — | Closed 2026-09-02 | Accepted without legal review: the author publishes the weights under MIT, the model is in wide commercial use, and the permissively licensed alternatives are worse or non-commercial. Documented in DOC-08 A8. |
| OQ-002 | Kokoro TTS relies on espeak-ng (GPLv3) for rare-word pronunciation; how to isolate or replace it. | — | — | Closed 2026-09-02 | No longer applicable: TTS moved to the cloud (ADR-010). |
| OQ-003 | FFmpeg build choice. | — | — | Closed 2026-09-02 | No FFmpeg: export uses Windows' built-in encoders via WebCodecs (ADR-013). Reopen only if the week-one prototype fails. |
| OQ-004 | Sound library sourcing: which CC0 / public-domain sources, how many clips for v1 (target: a few hundred), who curates and tags them, and how attribution is recorded in M-9.5. | Alek | Before v1.0 release | Open | — |
| OQ-005 | Product name. "PAPERCUT" is a placeholder. Check trademark availability before public use. | Alek | Before v1.5 (public launch) | Open | — |
| OQ-006 | Approve the technical stack in ADR-006. | Alek | Before development starts | Closed 2026-09-02 | Alek approved the stack when approving the Phase 1 plan. ADR-006 is Accepted; DOC-03 is Active. |
| OQ-007 | Minimum supported hardware and OS versions. | Alek | Before development starts | Closed 2026-09-02 | Windows 10/11 64-bit, 8 GB RAM, no GPU required. macOS deferred (ADR-012). |
| OQ-008 | Pricing: subscription is decided (ADR-008). Still open: price point, whether there is a free trial, and the monthly voice/agent usage cap per subscriber. | Alek | Before server implementation | Open | Subscription confirmed; details pending. |
| OQ-009 | Talking indicator design: pose-swap, subtle bob, or a small mouth-region wobble? Needs a quick visual experiment once the renderer exists. | Alek | During v1.0 development | Open | — |
| OQ-010 | Testing strategy for a non-programmer builder. | Claude | Before development starts | Closed 2026-09-02 | ADR-015: automated check suite (save/reopen, undo, render snapshots, export, network, licenses, AI-spend guard), grown with every feature. Never calls paid AI (ADR-016, DOC-09). |
| OQ-011 | Server hosting choice (e.g. Railway, Fly.io, Render, a VPS) and managed Postgres. Criteria: low ops burden for a solo non-programmer, predictable cost, easy merchant-of-record webhooks. | Claude to propose | Before server implementation | Open | — |
| OQ-012 | Agent output schema: the exact list of edit operations the agent may return and how proposals are previewed and accepted. Must be designed against the finished editor, not before it. | Claude to propose | After editor is usable, before agent implementation | Open | — |
| OQ-013 | What scene information is sent to the agent (text summary only; never photos). Define the summary format and confirm it satisfies the privacy statement in DOC-03 §6. | Claude to propose | Before agent implementation | Open | — |
| OQ-014 | Terms of service and privacy policy for a paid app that sends user-typed dialogue to OpenAI. | Claude to draft, Alek to approve | Before public launch (end of build order) | Open (path set) | Merchant of record supplies checkout and refund terms (ADR-014). Claude drafts a plain-language app ToS, privacy policy, and sign-up acceptable-use text covering OpenAI data flow, AI-voice disclosure, likeness rules, subscription scope, and usage caps. Not legal advice; a professional review is optional. |
| OQ-015 | H.264 patent position. | — | — | Closed 2026-09-02 | Only Windows' own encoders are used (ADR-013), which Microsoft licenses as part of Windows. Nothing is bundled. |
| OQ-016 | HEIC (iPhone photo) import. | — | — | Closed 2026-09-02 | Nothing bundled. Try Windows' own decoder (works when the user has Microsoft's HEIF extension); otherwise show a friendly "export as JPG" message with instructions. |
| OQ-017 | Platform AI-content labelling. | Alek | — | Closed 2026-09-02 | The app offers an optional "AI-generated" label on export (corner mark or end card) and the manual reminds users to enable each platform's own AI-content setting. Added to DOC-01 §5.1. |
| OQ-018 | Merchant of record choice: Paddle vs. Lemon Squeezy (fees, desktop-app license-key support, webhook quality, payout to Alek's country). | Claude to compare, Alek to decide | Before server implementation | Open | — |
| OQ-019 | Week-one export prototype: confirm WebCodecs H.264 + AAC encoding on Windows 10 and 11 meets quality, speed, and audio-sync targets (DOC-01 §7). If not, reopen OQ-003. | Claude | First week of development | Open | — |
| OQ-020 | Windows Application Control (Smart App Control) on Alek's laptop blocks unsigned native Node modules: Electron's install-time unzip helper was blocked during Phase 1 (worked around by extracting Electron with Windows' own tools; app itself runs fine — it is signed). Risk: onnxruntime-node (Phase 3) also ships a native module; verify it loads before building on it. Never disable the security setting; find a signed or alternative path instead. | Claude | Start of Phase 3 | Open | — |
