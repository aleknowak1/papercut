# DOC-02 — Decision Log (Architecture Decision Records)

**Status:** Active
**Last updated:** 2026-09-02

Each entry records one decision: what was decided, why, what was rejected, and what it commits us to. Decisions are never edited after acceptance; a new ADR supersedes an old one.

---

## ADR-001 — Motion style is cut-out animation

**Date:** 2026-09-02 · **Status:** Accepted

**Decision:** Characters and props are photo cutouts animated as 2D layers (position, scale, rotation, flip, opacity, pose swaps). AI-generated video motion is not used in v1 and, if ever added, will be an optional per-shot effect (see DOC-01 §5.4).

**Reasoning:** Cut-out animation keeps every element an editable layer, runs on any laptop, costs nothing per second of video, is fully predictable, and matches the intended comedic style. AI video motion is slow, expensive, hard to control, and produces flat footage that cannot be edited afterward.

**Rejected:** AI image-to-video as the primary motion engine.

**Consequences:** The core of the product is a 2D layer compositor with a keyframe timeline. Pose swapping and motion presets carry the expressive load.

---

## ADR-002 — Desktop application, built with web technology

**Date:** 2026-09-02 · **Status:** Accepted

**Decision:** PAPERCUT is a downloadable desktop app built with web technologies (see ADR-006 for the specific stack). **Amended by ADR-012: Windows only for v1; macOS later.**

**Reasoning:** Local video rendering, direct file access, offline use, and no hosting costs. Web tech keeps the codebase in one language, has the largest ecosystem, and is the most AI-assist-friendly path for a non-programmer builder.

**Rejected:** Browser web app (needs server-side rendering, clunky file access, ongoing hosting cost). Native per-platform apps (two codebases).

---

## ADR-003 — Version 1 is fully offline and self-contained

**Date:** 2026-09-02 · **Status:** Superseded by ADR-008

**Decision:** v1.0 requires no account, no internet, and no API keys. All AI features in v1 (background removal, text-to-speech) run locally on CPU using bundled open models.

**Reasoning:** Removes the largest sources of friction and support burden at launch. Lets the manual editor mature before any server exists. Models of sufficient quality exist under permissive licenses (see ADR-004).

**Consequences:** Photo generation, sound generation, and the AI agent are deferred to versions that include a company server (ADR-005).

---

## ADR-004 — Bundled local models and their licenses

**Date:** 2026-09-02 · **Status:** Superseded by ADR-009

**Decision:** Bundle the following, verified for commercial redistribution:

| Purpose | Model | License | Notes |
|---------|-------|---------|-------|
| Background removal (primary) | BiRefNet | MIT | Trained on DIS5K dataset which has separate academic terms; model license governs redistribution. Flag for legal review (OQ-001). |
| Background removal (light fallback) | ISNet (DIS) general-use | Apache 2.0 | Same dataset footnote. |
| Text-to-speech | Kokoro-82M | Apache 2.0 | Explicitly welcomes commercial deployment. Depends on espeak-ng (GPLv3) for rare-word pronunciation — must be isolated or replaced (OQ-002). |
| Video encoding | FFmpeg | LGPL / GPL depending on build | Run as a separate process, or use LGPL build. Never link GPL code into the app (OQ-003). |

**Rule:** No component with a GPL, AGPL, non-commercial, or "research only" license may be linked into the application. GPL tools may only be invoked as separate processes, and this must be confirmed by legal review before v1 ships.

---

## ADR-005 — Cloud AI runs through a company server, never user keys

**Date:** 2026-09-02 · **Status:** Accepted

**Decision:** Any feature needing a commercial cloud model (the agent, premium voices, photo/sound generation) calls a server owned by the company, which holds the API keys. Users never enter API keys. This server also hosts accounts, licensing, and payments.

**Reasoning:** Bring-your-own-key is a poor experience for a paid consumer product. Embedding a key in a desktop app is unsafe: the app is fully readable by anyone who installs it and the key would be extracted and abused. A proxy server is the only safe design, and it doubles as the account system.

**Rejected:** Bring-your-own-key. Embedded key. Local large language model (quality and hardware requirements too high for the target user).

**Consequences:** The agent cannot ship before accounts exist. Cloud AI usage is a per-user cost the business must price into subscriptions. (Timing revised by ADR-008: both are in v1.0.)

---

## ADR-006 — Technical stack

**Date:** 2026-09-02 · **Status:** Accepted (approved by Alek at Phase 1 start, 2026-09-02; closes OQ-006)

**Decision:**

| Layer | Choice | Why |
|-------|--------|-----|
| App shell | Electron | Mature, huge ecosystem, best-documented path for web-tech desktop apps; easiest to get AI coding help with. |
| Language | TypeScript | Catches whole categories of bugs before they run; essential when code is AI-generated. |
| UI | React | Standard; component model suits panel-based editor UIs. |
| Canvas / rendering | PixiJS (WebGL 2D) | Fast layered 2D image compositing, transforms, filters; same renderer used for preview and export so what you see is what you get. |
| Timeline / state | Custom, with a single immutable project document and undo/redo history | A video editor lives or dies by undo; one source of truth keeps it sane. |
| Local AI runtime | ONNX Runtime (Node bindings) | Runs BiRefNet on CPU without Python. |
| Company server | Node.js (TypeScript) API on a managed host; Postgres database; payments via a merchant of record (ADR-014) | Same language as the app; small surface (auth, subscription check, proxy to OpenAI). Host choice is OQ-011. |
| Video export | Render frames with PixiJS off-screen → encode with the operating system's H.264/AAC encoders through WebCodecs → mux with mp4-muxer (MIT). No FFmpeg. (ADR-013) | Deterministic, matches preview exactly, zero codec licensing. |
| Project format | A folder: `project.json` + `assets/` + `cache/` | Human-readable, robust, easy to back up and to version. |
| Packaging | electron-builder | Standard Windows installer (.exe); macOS (.dmg) when ADR-012 is revisited. |

**Rejected:** Tauri (smaller binaries but Rust backend adds a second language and less AI-assist coverage). Python backend sidecar (packaging pain, two runtimes). Godot / Unity (wrong tool for a video editor).

---

## ADR-007 — Documentation structure

**Date:** 2026-09-02 · **Status:** Accepted

**Decision:** The document set and conventions in DOC-00 are adopted. Every change gets a DOC-04 entry. The manual (DOC-05) is updated in the same change as the feature it describes.

**Reasoning:** The builder is not a programmer and needs to be able to return after weeks away and understand exactly what exists and why. Numbered, never-renumbered IDs make everything referenceable.

---

## ADR-008 — Version 1 includes the company server, accounts, subscription, cloud TTS, and the agent

**Date:** 2026-09-02 · **Status:** Accepted · **Supersedes:** ADR-003

**Decision:** v1.0 ships as a connected product: the desktop app, a company server (accounts, subscription, and proxying to cloud AI with the company's keys), cloud text-to-speech, and the AI agent. There is no offline mode. Background removal remains local (ADR-009).

**Reasoning:** Cloud TTS (ADR-010) and the agent both require the company's API keys, and keys cannot live in the app (ADR-005). Once the server exists for one of them, deferring the other buys nothing. Simpler product story: one version, one subscription, everything included. Alek's stated preference is to accept higher running cost in exchange for a simpler v1.

**Rejected:** Offline v1 with local TTS (ADR-003): would have required bundling Kokoro and resolving its GPL dependency, and would have delayed the agent, which is the product's main draw.

**Consequences:**
- Build order is unchanged: editor → server → TTS → agent. Only the definition of "v1.0 done" moves.
- v1.0 requires internet for TTS and the agent. Editing, cutouts, and export still work without a connection.
- Per-user usage caps are required from day one on TTS and agent calls.
- DOC-01 §5 rewritten. OQ-002 (espeak-ng) closed as no longer applicable.

---

## ADR-009 — Background removal: BiRefNet, bundled in two sizes

**Date:** 2026-09-02 · **Status:** Accepted · **Supersedes:** ADR-004

**Decision:** Bundle BiRefNet (MIT) as ONNX in two sizes. **BiRefNet_lite** (≈115 MB, fp16) runs automatically on every character/prop import. **BiRefNet full** (≈490 MB, fp16) is offered as an "HD cutout" option in the mask editor for hard cases (hair, fur, thin straps, busy backgrounds). Both run on CPU via ONNX Runtime. ISNet is dropped. Kokoro is dropped (see ADR-010).

**Reasoning:** Cloud image-editing APIs regenerate the image rather than segmenting it, which alters the subject and breaks the photorealism promise. BiRefNet is best-in-class, permissively licensed, and fast enough on CPU. Two sizes give a fast default and a high-quality escalation without asking the user to download anything.

**Rule (unchanged from ADR-004):** No GPL, AGPL, non-commercial, or research-only component may be linked into the application. FFmpeg is invoked as a separate process (OQ-003).

**Consequences:** Installer grows by ≈600 MB. The hand mask editor (paint in/out, feather) is a required v1 feature, not optional. OQ-001 (DIS5K dataset terms) remains open for legal review.

---

## ADR-010 — Text-to-speech: OpenAI gpt-4o-mini-tts via the company server

**Date:** 2026-09-02 · **Status:** Accepted

**Decision:** Dialogue is voiced by OpenAI's gpt-4o-mini-tts, called by the company server. Each line carries text plus a natural-language delivery instruction (e.g. "deadpan, slightly annoyed"), which the user can type or the agent can set. The TTS layer is built behind a provider interface so a premium tier (e.g. ElevenLabs, including voice cloning) can be added later without app changes.

**Reasoning:** Instruction-steerable delivery is the single most useful TTS feature for comedy. Cost is ≈$0.015 per minute of speech, i.e. about one cent per typical video. Removes model bundling and the espeak-ng licensing issue entirely.

**Rejected:** Local Kokoro (GPL dependency, less expressive, no delivery steering). ElevenLabs as the v1 default (3–7× the cost; voice cloning needs a consent policy first).

---

## ADR-011 — Agent model: OpenAI GPT-4o-mini class, single vendor

**Date:** 2026-09-02 · **Status:** Accepted

**Decision:** The agent runs on OpenAI's lightweight model tier (GPT-4o-mini class, or its successor at build time), through the company server. OpenAI is therefore the single cloud vendor for v1 (TTS + agent): one key, one bill.

**Reasoning:** Capable enough for structured scene direction at low cost; single-vendor simplicity outweighs marginal quality differences at this stage. The server's provider interface keeps a switch to Anthropic or others cheap if quality tests later justify it.

**Consequences:** The agent's output format is a strict schema of ordinary project edits (add layer, set keyframe, add clip, set TTS line). It never produces anything the manual editor cannot represent (DOC-01 §3).

---

## ADR-012 — Windows only for v1

**Date:** 2026-09-02 · **Status:** Accepted · **Amends:** ADR-002

**Decision:** v1 ships for Windows 10 and 11 (64-bit) only. macOS support is deferred until it can be tested on real hardware.

**Reasoning:** Alek has no Mac to test on. Shipping an untested platform is worse than not shipping it. The stack (Electron) keeps a later macOS build cheap.

**Consequences:** Minimum spec (OQ-007) becomes Windows 10+ 64-bit, 8 GB RAM, no GPU. HEIC import and video encoding decisions only need Windows answers. Code must still avoid Windows-only shortcuts where a portable option costs nothing, so the macOS build later is a packaging job, not a rewrite.

---

## ADR-013 — Video export uses the operating system's encoders; no FFmpeg

**Date:** 2026-09-02 · **Status:** Accepted (subject to a week-one prototype)

**Decision:** Export renders frames with PixiJS off-screen, encodes video (H.264) and audio (AAC) through the WebCodecs API built into Chromium/Electron, which uses the encoders that ship with Windows (Media Foundation: hardware-accelerated when available, Microsoft's software encoder otherwise), and writes the .mp4 with the MIT-licensed mp4-muxer library. No FFmpeg binary is shipped.

**Reasoning:** Removes every codec licensing and patent question from DOC-08 at once: Microsoft licenses these encoders as part of Windows. No LGPL checklist, no source publication, no third-party binary download. Fewer moving parts to package.

**Rejected:** Bundled FFmpeg (LGPL checklist plus the H.264 encoder question). GPL builds (never). Cisco OpenH264 download (unnecessary on Windows).

**Risk and fallback:** WebCodecs H.264/AAC encoding must be proven on Windows 10 and 11 in the first week of development (quality, speed, audio sync). If it falls short, fall back to an LGPL FFmpeg build launched as a separate process, still using Windows' hardware encoder, following DOC-08 §5.2.

---

## ADR-014 — Payments through a merchant of record

**Date:** 2026-09-02 · **Status:** Accepted

**Decision:** Subscriptions are sold through a merchant of record (Paddle or Lemon Squeezy; choice is OQ-018) rather than directly through Stripe.

**Reasoning:** A merchant of record is legally the seller: it collects and remits VAT/sales tax worldwide, issues invoices, handles refunds and chargebacks, and supplies checkout terms. Selling directly would make Alek responsible for tax registration in every jurisdiction with customers, which is the single largest hidden compliance burden for a solo software business and not something to attempt without professional help.

**Rejected:** Stripe directly (lower fees, but full tax responsibility).

**Consequences:** Fees are roughly 5% plus payment costs instead of roughly 3%. The company server integrates with the merchant's webhooks to learn subscription status; the app never handles card details.

---

## ADR-015 — Automated checks guard the things a non-programmer cannot see

**Date:** 2026-09-02 · **Status:** Accepted · **Closes:** OQ-010

**Decision:** The project keeps a suite of automated checks that run on every code change; a change that fails any check is not accepted. Every new feature is added together with its check in the same change. The initial suite:

| Check | What it proves |
|-------|----------------|
| Save / reopen | A sample project saved and reopened is identical, field for field. |
| Undo | Twenty random edits followed by twenty undos return the project to its exact starting state. |
| Render snapshots | A fixed set of reference frames renders pixel-identical to previously approved images; any difference is shown as a visual diff for Alek to approve or reject. |
| Export | A ten-second test project exports to an .mp4 with the expected duration, resolution, frame rate, and audio/video alignment. |
| No unexpected network | The app makes no network request except to the approved endpoints (OpenAI during development; the company server at launch). |
| License allow-list | Every dependency is on the DOC-08 allow-list. |
| AI-spend guard | No check and no default development configuration makes a live call to a paid AI service (DOC-09). |

**Reasoning:** Code is written by an AI and reviewed by a non-programmer. Visible failures are caught by use; silent regressions (corrupted saves, drifted audio, shifted keyframes) are not. Automated checks turn "all checks pass" into a statement with a precise meaning.

**Consequences:** Alek never needs to read the checks. When a render snapshot changes, Alek looks at a before/after image and says yes or no. Checks cost nothing to run (ADR-016).

---

## ADR-016 — Paid AI usage is spent only on real user results

**Date:** 2026-09-02 · **Status:** Accepted

**Decision:** No automated check, build, or default development session ever calls a paid AI service. Tests and development use a fake provider with recorded responses. Every paid result is cached by a fingerprint of its inputs and never regenerated for the same inputs. Generation happens only on an explicit user action. Spending limits are set at the provider and per user. Full rules in DOC-09.

**Reasoning:** Alek's direction: be very careful with AI spending, and do not waste tokens on testing. Making this structural (fake provider by default, live calls opt-in, caching everywhere) removes the possibility of accidental spend rather than relying on care.

**Consequences:** Development of the editor and server costs $0 in AI usage. Voice and agent development cost a few dollars to tens of dollars in total. Launch costs are per user, capped, and priced into the subscription (OQ-008).
