# DOC-09 — AI Spend Policy

**Status:** Active
**Last updated:** 2026-09-02
**Related:** ADR-010 (TTS), ADR-011 (agent), ADR-015 (testing), ADR-016 (this policy)

---

## 1. Principle

Every call to a paid AI service (OpenAI, and any later provider) costs real money. The product is designed so that such calls are made **only when a real person asks for a real result**, and never as a side effect of development, testing, building, or the app idling. Where a result has already been paid for, it is reused, not regenerated.

## 2. Rules

| # | Rule | How it is enforced |
|---|------|--------------------|
| 1 | **Automated checks never call a paid AI service.** All tests, builds, and checks use recorded responses ("fixtures") or a fake provider that returns canned audio and canned agent proposals. | The test configuration wires the fake provider. A check fails if any test attempts a live network call to OpenAI. |
| 2 | **Development uses the fake provider by default.** The real provider is switched on only when Alek is deliberately trying a voice or the agent. | An explicit `PAPERCUT_LIVE_AI=1` setting is required for live calls; it is off unless set on purpose. |
| 3 | **Nothing is generated twice.** Every TTS result is cached by a fingerprint of (text, delivery note, voice, model). Every agent proposal is cached by a fingerprint of (instruction, scene summary, model). Same input → served from cache, no call. | Cache lives in the project folder (`assets/audio/`, `cache/agent/`) and, on the server, per user. |
| 4 | **Generate on demand, not on keystroke.** Voices are generated when the user presses *Generate* (or accepts an agent proposal), never automatically as they type. Preview scrubbing plays the cached clip or silence. | UI design rule; a check confirms no TTS call happens without an explicit action. |
| 5 | **Agent requests are compact.** The scene summary sent to the agent is a short text description (names, poses, positions, timings), never full project JSON, never images. Output is a strict short schema. | Summary size is measured and capped; a check fails if it exceeds the cap. |
| 6 | **Hard spending limits at the provider.** The OpenAI account has a monthly hard cap set to a small amount during development and a deliberate figure at launch. | Set in the OpenAI dashboard; recorded in this document when set. |
| 7 | **Every live call is logged** with its purpose, input size, and estimated cost, to a local log during development and per user on the server. | Weekly glance at the log during development; per-user cap enforcement on the server. |
| 8 | **Per-user caps at launch.** Each subscriber has a monthly allowance of voice minutes and agent requests, enforced on the server, with a clear in-app meter. | Server middleware; figures set in OQ-008. |
| 9 | **Cheapest capable model.** gpt-4o-mini-tts for voices and the GPT-4o-mini class for the agent (ADR-010, ADR-011). Any upgrade requires a new ADR with a cost estimate. | Decision log. |

## 3. What this means in practice

- Running the full check suite costs **$0.00** in AI usage, every time, forever.
- A day of editor development costs **$0.00** in AI usage unless Alek deliberately turns live calls on to try something.
- Re-exporting a video, reopening a project, scrubbing the timeline, or re-rendering after a visual tweak costs **$0.00**: the voices are already on disk.
- The only events that cost money are: a user generating a new or changed line of dialogue, and a user sending a new instruction to the agent.

## 4. Development budget

| Phase | Expected live AI usage | Notes |
|-------|------------------------|-------|
| Editor (first and longest phase) | None | No AI features exist yet. |
| Server | None | Built and tested against the fake provider. |
| Voices | A few dollars total | Alek tries voices and delivery notes; each try is cached. |
| Agent | Tens of dollars at most | Prompt tuning against a fixed set of ~20 test instructions, each result cached; iteration is on the prompt, not on repeated calls. |
| Launch onward | Per-user, capped, priced into the subscription | See OQ-008. |

## 5. Recorded limits

| Item | Value | Set on |
|------|-------|--------|
| OpenAI monthly hard cap (development) | *to be set by Alek when the key is created* | — |
| OpenAI monthly hard cap (launch) | *to be set with OQ-008* | — |
| Per-user monthly voice allowance | *OQ-008* | — |
| Per-user monthly agent requests | *OQ-008* | — |
