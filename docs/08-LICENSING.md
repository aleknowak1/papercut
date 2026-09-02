# DOC-08 — Licensing Register

**Status:** Active
**Last updated:** 2026-09-02
**Related:** ADR-006 (stack), ADR-009 (models), ADR-010/011 (OpenAI), ADR-012/013/014, OQ-014, OQ-018, OQ-019

---

## 1. Purpose

PAPERCUT is a paid, closed-source product. Every third-party component it ships, links to, or depends on must be permitted for that use. This register lists each component, its license as verified against the license text on the stated date, what the license obliges us to do, and whether it is cleared. Nothing enters the product without a row here.

**This register is not legal advice.** The project deliberately chooses only well-established, permissively licensed or OS-provided components so that no item requires legal review (see §8).

## 2. The rules (from ADR-009)

| Rule | Meaning |
|------|---------|
| **Permissive only, inside the app** | MIT, BSD, Apache 2.0, ISC, PostgreSQL, and similar may be bundled and linked freely. |
| **LGPL: separate process or dynamic link only** | LGPL code may not be compiled into the app. It may be shipped as a separate executable or dynamically linked library, with source offered and notices shown. |
| **GPL / AGPL: separate process only, never linked** | Allowed only as a standalone program the app launches, never as a library, and only when a permissive alternative is unavailable. |
| **Non-commercial, research-only, "call us": never** | Not permitted in any form. |
| **Attribution always** | Every component's copyright and license text is reproduced in the app's About → Licenses screen (Manual M-9.5). |

## 3. Register — application (shipped to users)

| # | Component | Purpose | License | Verified | Obligations | Status |
|---|-----------|---------|---------|----------|-------------|--------|
| A1 | Electron | App shell | MIT | 2026-09-02, repo LICENSE | Reproduce notice | **Cleared** |
| A2 | Chromium (inside Electron) | Rendering engine | BSD-3-Clause plus many permissive sub-licenses | via Electron | Electron ships the notices; reproduce them | **Cleared** |
| A3 | Node.js (inside Electron) | Runtime | MIT (plus permissive deps) | 2026-09-02, repo LICENSE | Reproduce notice | **Cleared** |
| A4 | TypeScript | Language / compiler (build-time only; not shipped) | Apache 2.0 | 2026-09-02, repo LICENSE.txt | None at runtime | **Cleared** |
| A5 | React | UI | MIT | 2026-09-02, repo LICENSE | Reproduce notice | **Cleared** |
| A6 | PixiJS | Canvas rendering | MIT | 2026-09-02, repo LICENSE | Reproduce notice | **Cleared** |
| A7 | ONNX Runtime (onnxruntime-node) | Runs BiRefNet locally | MIT | 2026-09-02, repo LICENSE | Reproduce notice | **Cleared** |
| A8 | BiRefNet_lite and BiRefNet (weights, ONNX) | Background removal | MIT | 2026-09-02, repo LICENSE and HF model card | Reproduce notice. Training data (DIS5K) has separate academic terms; the author's MIT license on the weights governs redistribution, and the model is in wide commercial use. | **Cleared** (OQ-001 closed) |
| A9 | electron-builder | Installers (build-time only) | MIT | 2026-09-02, repo LICENSE | None at runtime | **Cleared** |
| A10 | Windows Media Foundation H.264 and AAC encoders, via WebCodecs (Chromium) | Video/audio encoding for export | Part of Windows; licensed by Microsoft to Windows users | 2026-09-02 | Nothing shipped, nothing to attribute. Requires Windows 10+ (ADR-012). | **Cleared** (ADR-013) |
| A11 | mp4-muxer | Writes the .mp4 container | MIT | Verify at dependency lock | Reproduce notice | **Cleared (pending lock)** |
| A12 | FFmpeg (fallback only, not planned) | Only if OQ-019 fails | LGPL 2.1+ | 2026-09-02, ffmpeg.org/legal | If ever used: LGPL build, separate process, publish source, attribute (§5.2). Never GPL builds or libx264. | **Not in use** |
| A13 | HEIC image decoding | Importing iPhone photos | libheif and libde265 are LGPL; HEVC is patent-encumbered | 2026-09-02, libheif README | **Not bundled.** Use Windows' own decoder when the user has Microsoft's HEIF extension; otherwise show an "export as JPG" message. | **Cleared** (OQ-016 closed) |
| A14 | Fonts for captions | Text overlays | Must be SIL Open Font License (OFL) or similar | per font, at selection | Reproduce OFL notice per font; do not sell fonts standalone | **Pending selection** |
| A15 | Sound library clips | Bundled sounds | Must be CC0 or equivalent public-domain dedication only (no CC-BY, to avoid per-clip attribution in user videos) | per clip, at curation | Keep a per-clip source record in `sounds/SOURCES.csv` | **Pending curation** (OQ-004) |
| A16 | Other npm packages | Utilities | Each must be MIT/BSD/Apache/ISC | Automated check at every build (§7) | Reproduce notices | **Ongoing** |
| A17 | caniuse-lite (build-time only; not shipped) | Browser-support data used inside the build tools (browserslist) | CC-BY-4.0 | 2026-09-02, repo LICENSE | None at runtime: it never enters the shipped app. The license check enforces that it stays out of the production dependency tree. | **Cleared (build-time exception)** |
| A18 | truncate-utf8-bytes (build-time only; not shipped) | Filename utility inside electron-builder | WTFPL | 2026-09-02, repo LICENSE | None at runtime: build-time only, permissive do-anything license. The license check enforces that it stays out of the production dependency tree. | **Cleared (build-time exception)** |

## 4. Register — company server (not shipped; runs on our infrastructure)

| # | Component | Purpose | License | Verified | Obligations | Status |
|---|-----------|---------|---------|----------|-------------|--------|
| S1 | Node.js | Runtime | MIT | 2026-09-02 | None (not distributed) | **Cleared** |
| S2 | PostgreSQL | Database | PostgreSQL License (BSD/MIT-like, "for any purpose") | 2026-09-02, postgresql.org/about/licence | None | **Cleared** |
| S3 | Merchant of record SDK (Paddle or Lemon Squeezy; OQ-018) | Payments, tax, invoices | Commercial service; SDKs are MIT | Verify at selection | Follow merchant's terms; it is the legal seller | **Pending selection** |
| S4 | OpenAI API (gpt-4o-mini-tts, GPT-4o-mini class) | Voices, agent | Commercial service under OpenAI Terms of Use, Service Terms, Usage Policies | 2026-09-02 | See §5.3 | **Cleared with obligations** |

Server-side software is used, not distributed, so even GPL components would be permissible there. We still prefer permissive licenses for simplicity.

## 5. Obligations in detail

### 5.1 Attribution screen
About → Licenses lists every component in §3 with its copyright line and full license text. Generated automatically at build time from package metadata plus a hand-maintained list for non-npm items (FFmpeg, BiRefNet, fonts, sounds).

### 5.2 FFmpeg (LGPL) checklist, from ffmpeg.org/legal — **retained for the fallback case only (ADR-013)**
1. Build (or obtain) FFmpeg **without** `--enable-gpl` and `--enable-nonfree`.
2. Ship it as a **separate executable** the app launches; never compile it into the app.
3. Publish the **exact source** used for our binaries, with the configure line, on our website, and link to it from the About screen.
4. Mention FFmpeg and the LGPL v2.1 in the About screen and the EULA.
5. Do not rename the binary to hide what it is.

### 5.3 OpenAI
- **Output ownership:** OpenAI's Terms of Use assign Output to the customer ("you own the Output"). Generated speech and agent proposals belong to us / our users. Output may not be used to build competing models.
- **Required disclosure for TTS:** the TTS documentation requires that we "provide a clear disclosure to end users that the TTS voice they are hearing is AI-generated and not a human voice." → The voice picker and the manual (M-5.1) state this plainly. Exported videos do **not** need a burned-in label under OpenAI's terms, and the app offers an optional "AI-generated" label for platform rules (OQ-017).
- **Likeness:** usage policies prohibit using "someone's likeness, including their photorealistic image or voice, without their consent in ways that could confuse authenticity." → Users agree to this at sign-up (acceptable-use checkbox, DOC-01 §5.1); the app never offers voice cloning in v1.
- **Custom voices:** OpenAI offers custom voices with consent recordings (up to 20 per organization). This is a possible v2 path for "narrate as yourself" that keeps us within OpenAI's terms.
- **Consumer ChatGPT voice restriction does not apply:** the non-commercial restriction on "ChatGPT Voice Output" is for the consumer app, not the API we use.

## 6. Video codec patents (separate from software licenses)

H.264 is covered by patent pools regardless of which encoder software is used; an MIT-licensed encoder grants no patent rights. PAPERCUT avoids the question entirely by using only the encoders that ship with Windows, which Microsoft licenses to Windows users (ADR-013). Nothing codec-related is bundled or downloaded. If the fallback FFmpeg path is ever taken, it must still use Windows' hardware/software encoder (`h264_mf`) rather than libx264 or any bundled software encoder.

## 7. Enforcement

- A license checker runs on every build and fails the build if any npm dependency is not on the allow-list (MIT, BSD-2/3, Apache-2.0, ISC, 0BSD, CC0-1.0, PostgreSQL, Unlicense, Python-2.0, BlueOak). Anything else must be added to this register by hand first.
- If the FFmpeg fallback is ever adopted, its provenance (build source, configure line, SHA-256) is recorded here first.
- Every sound clip and font has a source row before it is added to the repository.
- This register is reviewed at every release and its "Last updated" date bumped.

## 8. Summary of what is clear vs. not

**Clear today:** the entire application stack (Electron, Chromium, Node, TypeScript, React, PixiJS, ONNX Runtime, electron-builder, BiRefNet, Windows' own encoders), the server stack (Node, Postgres), and OpenAI as a service provider with its disclosure and likeness obligations handled in-app.

**Lawyer-free paths set:** terms and privacy via the merchant of record's checkout terms plus a template service (OQ-014); tax via the merchant of record (ADR-014).

**Pending routine selection, no legal risk:** merchant of record (OQ-018), mp4-muxer version lock, fonts (OFL only), sound clips (CC0 only, OQ-004).

**No items require legal review.**
