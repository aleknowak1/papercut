# DOC-11 — Development Workflow

**Status:** Active
**Last updated:** 2026-09-05 (Appendix I: Phase 7b kickoff prompt and Alek's decisions a–k)
**Purpose:** How Alek and Claude build PAPERCUT day to day. Tools, session rhythm, roles, and the standing files that keep every session on track.

---

## 1. Tools and where things live

| Thing | Where | Why |
|-------|-------|-----|
| Code and docs | `C:\Users\Alek\Documents\Claude Code Projects\papercut`, containing `docs/` (these documents) and the application code | Phases 1–2 must run and be tested on Windows (ADR-012, ADR-013). The repo is the source of truth. |
| Coding tool | **Claude Code** on the laptop, opened in that folder | Runs, tests, and commits locally. |
| Planning conversations | This Cowork project | For decisions, docs, and questions. Docs are mirrored here; the repo copy wins if they differ. |
| Version history | **git** (managed by Claude Code) | Every change is a saved point that can be undone. |
| Off-site backup | Private GitHub repository: `https://github.com/aleknowak1/papercut.git` | Laptop loss ≠ project loss. Claude Code pushes after each session. |

## 2. Standing files in the repo

| File | Purpose |
|------|---------|
| `CLAUDE.md` (repo root) | Read automatically by Claude Code at the start of every session. Holds the standing orders (§3). Never delete it. |
| `docs/` | DOC-00 to DOC-11. Claude Code reads DOC-10 first, then whatever the task needs. |

## 3. Standing orders (the content of `CLAUDE.md`)

The full text is in Appendix A. In summary, every session Claude Code must:

1. Read `docs/10-PROJECT-TRACKER.md` first, then `docs/02-DECISIONS.md`, and the docs relevant to the task.
2. Follow every accepted ADR. If a task seems to require deviating, stop and ask; do not improvise a new architecture.
3. Never call a paid AI service from checks, builds, or default development configuration (DOC-09). Live calls require `PAPERCUT_LIVE_AI=1` set deliberately.
4. Add or update the relevant check in the same change as any feature (ADR-015). All checks must pass before a commit.
5. Update `docs/04-CHANGELOG.md` and `docs/10-PROJECT-TRACKER.md` in the same change as any code change. Write the manual section (`docs/05-MANUAL.md`) when a feature becomes usable.
6. Respect the content rules in DOC-00 §3.6 and the licensing rules in DOC-08 (permissive licenses only; the license check enforces it).
7. Windows 10/11 only, but no gratuitous Windows-only code where a portable option costs nothing.
8. End each session with: what changed, what checks passed, what Alek should try, and what is next.

## 4. Session rhythm

1. **Open** Claude Code in `C:\Users\Alek\Documents\Claude Code Projects\papercut`. Select the model (`/model`): Fable for foundational phases, Opus for contained feature work (see DOC-10 §2 "Model" column).
2. **Paste** the phase kickoff prompt (Claude provides it in the Cowork planning session; kickoff prompts are kept in the appendices of this document) or, for a continuing phase, a one-liner: *"Read CLAUDE.md and DOC-10, then continue Phase N: <task>."*
3. **Plan first** for anything foundational: ask for a plan and approve it before code is written. Skip for small, well-defined tasks.
4. **Build.** Claude Code writes code, runs checks, fixes failures.
5. **Verify.** Alek runs the app and tries what the session said to try. Approve or reject any render-snapshot diffs.
6. **Close.** Claude Code commits, pushes, writes the DOC-04 entry, updates DOC-10, and states the next task.

One task per session where possible. Long, wandering sessions cost more and lose the thread. If a session goes wrong, say so; git can return to the last good point.

## 5. Roles

| Alek | Claude |
|------|--------|
| Decides (ADRs, open questions, priorities) | Proposes, builds, documents |
| Runs the app and reports what he sees, in plain words | Turns reports into fixes with checks |
| Approves or rejects visual snapshot diffs | Keeps checks green |
| Curates sounds, chooses names, sets prices, approves legal text | Drafts all of the above |
| Says "go" and "stop" | Never deviates from an ADR without asking |

Alek never needs to read code. If a session's explanation is not understandable in plain language, that is a defect to raise.

## 6. Agents (sub-agents in Claude Code)

| Phase | Use |
|-------|-----|
| 1–3 | **None for building.** One coherent design, one builder. |
| End of 1, 5, 10, 12 | **Reviewer agent:** a fresh agent that has not seen the code audits it against DOC-02 and DOC-03 and lists deviations. Cheap insurance on the foundations. |
| 4 onward | **Parallel builders** are acceptable for independent features (e.g. transitions and captions at the same time), because the check suite catches what they break. Never two agents on the same file. |

Sub-agents multiply token cost. Use them where parallelism or independence buys something, not by default.

## 7. Keeping the Cowork project docs in sync

The repo's `docs/` folder is authoritative. When the docs change during coding, Alek can add the repo folder to a Cowork session and ask Claude to sync the project copies. Until then, a planning session should assume the repo copy may be newer.

## 8. Cost habits

- Fable for foundations, Opus for the long tail (DOC-10 §2).
- Plan mode before big builds prevents expensive wrong turns.
- Focused sessions; `/compact` when a session grows long.
- No sub-agents unless §6 says so.
- Paid AI (OpenAI) usage stays at zero until Phase 11 (DOC-09).

---

## Appendix A — `CLAUDE.md` (copy into the repo root verbatim)

```markdown
# PAPERCUT — standing orders for Claude Code

You are building PAPERCUT, a paid Windows desktop app that turns a user's own
photos into cut-out-animated comedy videos. Alek, the owner, is not a programmer.
Everything you do must be explainable to him in plain language.

## Repository
- Local folder: C:\Users\Alek\Documents\Claude Code Projects\papercut
- GitHub remote (origin): https://github.com/aleknowak1/papercut.git

## Before doing anything
1. Read docs/10-PROJECT-TRACKER.md (where we are).
2. Read docs/02-DECISIONS.md (every accepted decision, ADR-001 to ADR-016).
3. Read the docs relevant to the task (docs/00-INDEX.md lists them).

## Non-negotiable rules
- Follow every accepted ADR. If a task seems to need a deviation, STOP and ask.
  Do not invent a new architecture or swap a library on your own.
- Stack (ADR-006/013): Electron + TypeScript + React + PixiJS, ONNX Runtime for
  BiRefNet, WebCodecs + mp4-muxer for export. No FFmpeg. No Python.
- Windows 10/11 only (ADR-012), but avoid Windows-only code where a portable
  option costs nothing.
- NEVER call a paid AI service (OpenAI or any other) from tests, builds, or the
  default dev configuration (DOC-09). All checks use the fake provider. Live
  calls require the env var PAPERCUT_LIVE_AI=1, set deliberately by Alek.
- Every feature ships with its check (ADR-015). All checks pass before commit.
- Permissive licenses only (DOC-08). The license check enforces the allow-list.
  Never add GPL/AGPL/non-commercial dependencies.
- No bundled templates, stock photos, or sample projects in the product.
  Test fixtures live under tests/fixtures and never ship.
- Follow the content rules in docs/00-INDEX.md §3.6.

## Every change
- Update docs/04-CHANGELOG.md (new CL-NNNN row, newest first) and
  docs/10-PROJECT-TRACKER.md in the SAME change as the code.
- Every check cleans up its own output (tests/output/) when it succeeds; a
  green `npm run check` leaves tests/output/ empty. A failed check may keep
  its output for diagnosis and must say where it left it.
- When a feature becomes usable, write its section in docs/05-MANUAL.md.
- Commit with a clear message. Push to origin.

## Ending a session
Report in plain language: what changed, which checks pass, exactly what Alek
should open and try, and what the next task is.

## Style
- TypeScript strict mode. Small modules. Clear names.
- One immutable project document with undo/redo history (DOC-03 §3).
- UI: dense, functional, keyboard-friendly, slightly retro; clarity over polish.
```

## Appendix B — Phase 1 kickoff prompt (paste into Claude Code)

```
You are working in the PAPERCUT repository at:
C:\Users\Alek\Documents\Claude Code Projects\papercut
GitHub remote (origin): https://github.com/aleknowak1/papercut.git

Read CLAUDE.md in the repository root first. Then read, in this order:
docs/10-PROJECT-TRACKER.md, docs/02-DECISIONS.md, docs/03-ARCHITECTURE.md,
docs/08-LICENSING.md, docs/09-AI-SPEND-POLICY.md, docs/11-WORKFLOW.md.

We are starting Phase 1 (Scaffold). Do not write code yet. First produce a plan
for my approval that covers:

1. Repository layout (app, server placeholder, docs, tests, tests/fixtures).
2. Tooling: Electron + TypeScript (strict) + React + PixiJS, electron-builder for
   a Windows installer, a test runner, a license checker wired to the DOC-08
   allow-list, and a script that runs all checks with one command.
3. The project document format from DOC-03 section 3 as TypeScript types, with
   save/load to the project folder layout in DOC-03 section 2, and an undo/redo
   history.
4. A Home screen: choose format (9:16, 16:9, 1:1), choose save location, name
   and create a project, open an existing one. Dense, functional, slightly retro.
5. The provider layer (DOC-03 section 7) with interfaces for segmentation, tts,
   and agent, plus a fake provider for tts and agent that returns canned results.
6. The initial checks from ADR-015 that are possible now: save/reopen, undo,
   license allow-list, no-unexpected-network, AI-spend guard.
7. git: initialise the repository in this folder if not already, keep the
   existing .gitignore, README.md, CLAUDE.md and docs/, add the remote above as
   origin, and make the first commit and push.

Keep the plan short and in plain language, with a list of the decisions you
are making within the ADRs and any questions for me. After I approve, build it
one step at a time, running checks as you go, and finish with the session report
described in CLAUDE.md (what changed, which checks pass, what I should open and
try, what is next), and update docs/04-CHANGELOG.md and
docs/10-PROJECT-TRACKER.md.
```

## Appendix C — Phase 2 kickoff prompt (paste into Claude Code)

Model: Fable. Plan first. Purpose: prove or disprove ADR-013 on real Windows hardware (OQ-019). If the prototype fails the targets, Claude Code stops and reports; the fallback decision (reopening OQ-003, DOC-08 §5.2) is Alek's, made in a planning session.

```
You are working in the PAPERCUT repository at:
C:\Users\Alek\Documents\Claude Code Projects\papercut
GitHub remote (origin): https://github.com/aleknowak1/papercut.git

Read CLAUDE.md in the repository root first. Then read, in this order:
docs/10-PROJECT-TRACKER.md, docs/02-DECISIONS.md (ADR-013 and ADR-015 in
particular), docs/03-ARCHITECTURE.md (sections 3, 4.3 and 5),
docs/01-PRODUCT-SPEC.md (section 7), docs/07-OPEN-QUESTIONS.md (OQ-019 and
OQ-020), docs/08-LICENSING.md, docs/09-AI-SPEND-POLICY.md, docs/11-WORKFLOW.md,
and docs/04-CHANGELOG.md (to see what Phase 1 actually built).

Phase 1 is usable and verified. We are starting Phase 2: the export prototype
(OQ-019). Its only job is to prove or disprove ADR-013 on real Windows
hardware: PixiJS renders frames off-screen, WebCodecs encodes H.264 video and
AAC audio using the encoders built into Windows, and mp4-muxer writes the .mp4.
No FFmpeg, no Python, no new native Node modules (see OQ-020).

Do not write code yet. First produce a plan for my approval that covers:

1. A ten-second test project, generated by code under tests/fixtures (never
   shipped): a plain background, a moving coloured shape, a visible frame
   counter and timecode, and short beeps at exact known times (for example at
   0, 2.5, 5, 7.5 and 10 seconds). Generate the audio programmatically; do not
   download any sound file. This fixture must make audio drift obvious to the
   eye and ear, and measurable by a check.
2. The export pipeline described in DOC-03 section 4.3 as a small, separate
   module: off-screen PixiJS render at the project's resolution -> WebCodecs
   VideoEncoder (H.264, ask for hardware acceleration first, fall back to
   software) -> WebCodecs AudioEncoder (AAC) -> mp4-muxer -> file in the
   project folder. Report which encoder (hardware or software) was actually
   used. Keep the module independent of the editor so Phase 9 can reuse it.
3. A dev-only way to trigger it from the running app on the currently open
   project (a menu item or a button that only appears in development). The
   real export screen is Phase 9, not now.
4. The Export check from ADR-015, added to `npm run check`: it exports the
   test project and confirms duration, resolution, frame rate, frame count,
   and audio/video alignment by reading the resulting .mp4 back. Any parsing
   library you add must pass the DOC-08 license check. Tell me in the plan
   how the check will run WebCodecs (it needs a Chromium renderer, so it will
   probably run inside a headless Electron window) and how long it will take.
5. A measurement report, written to docs/ as a short table: export time for
   the 10-second project at 1080p30 and 720p30, extrapolated to 60 seconds
   and compared to the DOC-01 section 7 target (60 s of 1080p30 in under
   3 minutes without a GPU); file size; encoder used; audio drift measured in
   milliseconds at each beep; and your plain-language judgement of visual
   quality. Test on this laptop (Windows 11). Say clearly that Windows 10 is
   untested unless we have a Windows 10 machine.
6. The decision. If the results meet the targets, close OQ-019, change
   ADR-013's status from "Accepted (subject to a week-one prototype)" to
   "Accepted", and confirm mp4-muxer's license in DOC-08 row A11 now that it
   is locked. If they fall short, STOP and report; do not add FFmpeg or any
   other fallback on your own. That is my decision to make.
7. Anything from Phase 1 that must be finished for this to work (for example
   a real project document with at least one layer and a duration, if the
   scaffold's document is still empty). List it; do not expand scope beyond
   what the prototype needs.

Out of scope for this session: the editor, layers UI, timeline, platform
presets, the "AI-generated" label, progress bar, and the render-snapshot
check (Phase 5). No paid AI calls of any kind (DOC-09).

Keep the plan short and in plain language, with a list of the decisions you
are making within the ADRs and any questions for me. After I approve, build
it one step at a time, running `npm run check` as you go. Commit and push.
Finish with the session report described in CLAUDE.md (what changed, which
checks pass, exactly what I should open and try — including where the
exported .mp4 is and what to look and listen for — and what is next), and
update docs/04-CHANGELOG.md, docs/10-PROJECT-TRACKER.md, and
docs/07-OPEN-QUESTIONS.md in the same change.
```

## Appendix D — Phase 3 kickoff prompt (paste into Claude Code)

Model: Fable for foundations (gate, worker, provider, import, check scaffolding, step-6 design), then hand-off to Opus for contained feature work (DOC-10 §2). Plan first. Purpose: prove or stop on OQ-020 (onnxruntime-node vs Smart App Control) before any cutout feature is built on it; then assets and cutouts. If the gate fails, Claude Code stops and reports; the fallback decision is Alek's.

```
You are working in the PAPERCUT repository at:
C:\Users\Alek\Documents\Claude Code Projects\papercut
GitHub remote (origin): https://github.com/aleknowak1/papercut.git

Read CLAUDE.md in the repository root first. Then read, in this order:
docs/10-PROJECT-TRACKER.md, docs/02-DECISIONS.md (ADR-009 and ADR-015 in
particular), docs/03-ARCHITECTURE.md (sections 1, 2, 3, 4.1 and 5),
docs/01-PRODUCT-SPEC.md (section 5.1 and the "never regenerate the photo"
rule in section 5), docs/07-OPEN-QUESTIONS.md (OQ-020, and OQ-016 for HEIC),
docs/08-LICENSING.md (rows A7, A8 and A13), docs/09-AI-SPEND-POLICY.md,
docs/11-WORKFLOW.md, docs/05-MANUAL.md (to see the M-2 headings you will
fill in), docs/04-CHANGELOG.md (to see what Phases 1 and 2 actually built),
and app/shared/providers/types.ts (the SegmentationProvider interface you
will implement).

Phase 2 is closed: ADR-013 is proven, OQ-019 is closed, DOC-12 has the
numbers. We are starting Phase 3: assets and cutouts.

Housekeeping before anything else: the repository is one commit ahead of
GitHub (b11791a, docs only) — push it. A folder called _to_delete in the
repository root holds stale git lock files; it is untracked and can be
deleted. tests/output/ is full of leftover run folders from earlier check
runs (git-ignored, so harmless, but untidy): delete them now, and from now
on every check cleans up its own output when it finishes — a failed check
may keep its output for diagnosis, and must say where it left it. Add this
rule to CLAUDE.md under "Every change" so it holds for every future
session.

THE GATE COMES FIRST. Phase 3 rests on onnxruntime-node, a native Node
module. Windows Smart App Control on this laptop blocked an unsigned native
helper during Phase 1 (OQ-020). Before any cutout feature is designed on top
of it, we prove that it loads and runs here. Nobody disables, weakens, or
asks me to change Smart App Control or any other Windows security setting,
at any point, for any reason. If the answer is "it does not load", the
fallback is my decision, not yours.

Do not write code yet. First produce a plan for my approval that covers:

1. The OQ-020 gate (prove or stop).
   a. Add onnxruntime-node (MIT, DOC-08 row A7) as a dependency. Record what
      the install actually does on this machine (any postinstall step, any
      binary download) and whether Smart App Control interferes with it.
   b. Show that the module loads in plain Node, and then inside Electron
      (Electron 44) in the process where it will really run — not the
      renderer: a separate process so the UI never freezes (DOC-03 §1
      "workers"). Propose which kind of process (utility process or worker
      thread) and why.
   c. Fetch BiRefNet_lite (ONNX, fp16, ≈115 MB, MIT — ADR-009, DOC-08 A8)
      with a script (scripts/fetch-models) into models/, which is already
      git-ignored. The script records the exact source URL, file name,
      version and SHA-256, and refuses a file whose hash does not match. The
      app itself never downloads anything (ADR-009: bundled); only this
      build-time script talks to the internet. Tell me the download size
      before you run it. Say in the plan where the models live in
      development and where they will live inside the packaged app later.
   d. Run a real inference on a test image generated in code under
      tests/fixtures (never shipped, nothing downloaded): a clearly
      separated figure-like shape on a busy background is enough for a
      smoke test. Confirm the output is a mask of the right size with the
      foreground mostly opaque and the background mostly transparent.
   e. Measure on this laptop: seconds per photo at a typical phone-photo
      size on CPU only, peak memory, and how many threads were used. The
      DOC-03 §5 target is under 3 seconds per photo on a 2020-era laptop
      CPU. CPU is the baseline; do not depend on a GPU.
   f. Check the Windows event log for Smart App Control / code-integrity
      blocks the way CL-0022 did, so "it works" is proven, not assumed.
   g. THE DECISION. If the module loads, runs, and the numbers are
      acceptable: close OQ-020 in DOC-07 with the evidence, record the exact
      onnxruntime-node version and the model file details in DOC-08 rows A7
      and A8, put the numbers in a short docs/13 report in the style of
      DOC-12, and continue with the rest of the plan without waiting for
      me. If it is blocked at any step, or the numbers are far off target:
      STOP. Report exactly what was blocked (the event-log entries), what
      the same block would mean for customers on fresh Windows 11 machines
      where Smart App Control is on by default, and list the candidate
      paths with plain-language trade-offs (for example an in-browser WASM
      build of ONNX Runtime that needs no native module but is slower, a
      Microsoft-signed build, or anything else you find) — without choosing
      one. Do not build a cutout feature on a module that has not passed.

2. The segmentation worker and provider. Implement SegmentationProvider
   (app/shared/providers/types.ts) as the local BiRefNet provider, running
   in the separate process from step 1b, with a job queue, progress, and
   cancellation. Output rule from DOC-01 §5: the cutout is the original
   pixels with a new alpha channel — the photo is never regenerated,
   resampled, or "improved"; only the mask changes. The cutout is written to
   assets/cutouts/<id>.png (DOC-03 §2). Two model sizes behind one
   interface: BiRefNet_lite is the automatic default; BiRefNet full
   (≈490 MB, fetched by the same script) is the "HD cutout" option. Measure
   the full model's time per photo too and tell me the number.

3. Image import. JPG, PNG and WebP by drag-and-drop and by a button; the
   file is copied unchanged into assets/images/ and an asset record is added
   to the project document (DOC-03 §3) through the same undo-able edit path
   as everything else. On import the user says what the picture is:
   background (no cutout) or character/prop (automatic cutout runs). A
   thumbnail goes to cache/. Duplicate and unreadable files are refused in
   plain English. This needs an Assets panel in the opened-project view
   (which today is a placeholder): a dense list with thumbnails, type,
   cutout status, and the import controls. Keep it minimal; the full editor
   layout is Phase 4.

4. HEIC (iPhone photos) via Windows' own decoder — OQ-016, DOC-08 A13.
   Nothing is bundled: no libheif, no libde265, no native module. Propose a
   path that uses only what Windows ships and that respects the OQ-020
   constraint, for example a small script run as a separate signed Windows
   process (PowerShell with the Windows.Graphics.Imaging decoder) that
   converts the HEIC to a PNG for import. If the user's Windows lacks
   Microsoft's HEIF Image Extension, the app shows the friendly "export as
   JPG" message with instructions instead of an error. Tell me in the plan
   how to find out whether this laptop has the extension, and how you will
   test both outcomes (works / missing) without downloading a sample HEIC —
   generating one in code is not possible, so the "works" path is verified
   by me with a real iPhone photo if I have one, and the check covers the
   decision logic and the message.

5. Characters with several poses (M-2.5). A character is a named group of
   cutouts (poses) per DOC-03 §3 characters[]. Create a character, add a
   pose from an imported cutout, name and reorder poses, delete a pose. Keep
   it to the document and the Assets panel; nothing on a canvas yet.

6. The mask editor (M-2.4, M-2.4b). Opens any cutout: the original photo
   with the mask shown over it, brush to add and brush to erase, brush size,
   edge feather, zoom and pan, "Reset to automatic", and "HD cutout" (runs
   BiRefNet full and replaces the automatic mask). Design decision for the
   plan: how mask edits fit the immutable project document and undo/redo
   (DOC-03 §3) — for example, brush strokes undo locally inside the editor,
   and saving writes a new cutout file rather than overwriting, so a
   document-level undo can point back at the previous file. Choose the
   drawing surface (PixiJS or a plain canvas) and say why. Keyboard-friendly.

7. Audio import (M-2.6). MP3, WAV, M4A and OGG by drag-and-drop and button,
   copied unchanged into assets/audio/, asset record added, duration read by
   decoding with Chromium's built-in decoders, shown in the Assets panel
   with a play button. Waveforms and the timeline are Phase 6. For the check,
   generate what can be generated in code (WAV already exists from Phase 2;
   an M4A can be produced with the WebCodecs AAC encoder and mp4-muxer from
   Phase 2) and list the formats that can only be verified by me with a real
   file — do not download any sound file.

8. Checks (ADR-015), all part of `npm run check`:
   - Segmentation: the worker starts, the model loads, the fixture image
     produces a mask with the expected coverage, and the time per photo is
     reported (report, do not fail, on time). If the model files are missing
     the check fails with a plain message naming the fetch script; it never
     silently skips.
   - Import: each image format round-trips into the project folder and the
     document; save/reopen and undo checks still pass with assets present.
   - Cutout output is original pixels plus alpha (compare RGB to the source).
   - Mask editor: a known brush stroke and a known feather on a known mask
     give the expected pixels; reset restores the automatic mask; the undo
     design from step 6 is covered.
   - HEIC: the "decoder missing" path shows the message; the decoder call is
     wired and its result validated.
   - Audio: the generated fixtures decode with the right duration.
   - Characters: add/rename/reorder/delete poses round-trip and undo.
   - Existing checks stay green: license allow-list (onnxruntime-node must
     be on it; anything new goes through DOC-08 first), no unexpected
     network (loading a model or running the worker must not open any
     connection), AI-spend guard.
   - The production-build scan from Phase 2 is extended: no fixtures, no
     dev code, and the model files present where the packaged app expects
     them.
   - Every check, new and existing, removes its own output on success (the
     housekeeping rule above); the check suite leaves tests/output/ empty
     after a green run.
   Tell me how long `npm run check` will take afterwards (it is about 25 s
   now).

9. Manual sections (DOC-05), written when each feature becomes usable:
   M-2.1 (what makes a good photo), M-2.2, M-2.3, M-2.4, M-2.4b, M-2.5,
   M-2.6, and M-9.2 (supported file types, including the HEIC note).

10. Hand-off from Fable to Opus (DOC-10 §2 "Fable → Opus"). You (Fable) do
    steps 1 to 4 and the design decisions in step 6, plus the check
    scaffolding — the foundations. Steps 5, 6 (implementation), 7 and 9 are
    contained feature work for Opus. When the foundations are usable and
    green, commit, push, and end the session with a written hand-off in
    DOC-10 §1 "Next action" plus a one-line prompt for the Opus session,
    in the form DOC-11 §4 step 2 describes ("Read CLAUDE.md and DOC-10,
    then continue Phase 3: <task>"). Make the boundary clear in the plan;
    I may move it after reading the plan. No sub-agents in Phase 3
    (DOC-11 §6).

Out of scope for this phase: the scene canvas, layers UI, placing things,
keyframes, timeline, waveforms, the "talking" indicator, and the
render-snapshot check (Phase 5). No paid AI calls of any kind (DOC-09).

Keep the plan short and in plain language, with a list of the decisions you
are making within the ADRs and any questions for me. After I approve, build
it one step at a time — the gate first, and nothing past the gate until it
has passed — running `npm run check` as you go. Commit and push after each
usable step. Finish each session with the report described in CLAUDE.md
(what changed, which checks pass, exactly what I should open and try — for
the gate: which photo to import and what a good cutout looks like — and
what is next), and update docs/04-CHANGELOG.md, docs/10-PROJECT-TRACKER.md,
docs/07-OPEN-QUESTIONS.md and docs/08-LICENSING.md in the same change. Add
this kickoff prompt to docs/11-WORKFLOW.md as Appendix D, as was done for
Phase 2.
```

## Appendix E — Phase 4 kickoff prompt (paste into Claude Code)

Model: Alek selects via /model (DOC-10 §2 lists Opus for Phase 4; Phase 3 ran on Fable by Alek's choice). Plan first — Phase 4 introduces the PixiJS scene renderer, which the real export will reuse (ADR-006: what you see is what you get).

```
You are working in the PAPERCUT repository at:
C:\Users\Alek\Documents\Claude Code Projects\papercut
GitHub remote (origin): https://github.com/aleknowak1/papercut.git

Read CLAUDE.md in the repository root first. Then read, in this order:
docs/10-PROJECT-TRACKER.md (where we are), docs/02-DECISIONS.md (ADR-001,
ADR-006 and ADR-017 in particular), docs/03-ARCHITECTURE.md (sections 1, 2,
3 and 5), docs/01-PRODUCT-SPEC.md (section 5.1, the Layers row),
docs/04-CHANGELOG.md CL-0024 to CL-0035 (what Phase 3 actually built and
how its sessions were run), and docs/11-WORKFLOW.md.

Phases 0-3 are Complete and verified by me (CL-0034). The app today: Home
screen; project document with undo/redo wired into the UI and auto-save;
Assets panel (image and audio import, automatic cutouts in a one-at-a-time
background queue); Characters panel (poses); the mask editor. Nothing is
placed on any canvas yet. The export prototype (Phase 2) already renders
PixiJS off-screen and encodes through WebCodecs.

We are starting Phase 4: Scene and layers (DOC-10 §2, DOC-01 §5.1):

1. The scene canvas: a PixiJS view of the current scene inside the
   opened-project view, showing the project's format (9:16, 16:9, 1:1).
   It must be the SAME rendering approach the export uses, so that what
   the user sees is what exports (ADR-006/013) — say in the plan how the
   Phase 2 off-screen renderer and this live canvas share code.
2. Background: assign an imported background image to the scene.
3. Layers: add character layers (showing the character's current pose) and
   prop layers (a cutout directly); ordering (front/back); opacity; lock;
   hide. All through document edits and the existing undo path.
4. Placing and sizing on the canvas: select, drag to move, resize; say in
   the plan how a static placement maps to the DOC-03 §3 document (for
   example the layer's keyframe at time 0 — full keyframing is Phase 5)
   and how canvas dragging produces clean single undo steps, not one per
   mouse move.
5. Checks (ADR-015): layer edits round-trip save/reopen and undo; placement
   maps to the document exactly; existing checks stay green. The
   render-snapshot check stays Phase 5. Tell me what `npm run check` will
   cost afterwards (it is 71 s now; keep it around two minutes or less).
6. Manual sections M-3.1, M-3.2, M-3.3 as each becomes usable, and DOC-10
   rows updated in the same commits.

Do not write code yet. First produce a plan for my approval: the editor
layout (canvas + panels), the decisions you are making within the ADRs,
how the renderer is shared with export, what exactly is out of scope, and
any questions for me. DOC-11 §6 allows parallel builders from Phase 4 for
independent features — if the plan proposes any, name the boundaries
(never two agents on one file); otherwise build alone, one feature at a
time, committed and pushed when usable.

Out of scope for Phase 4: keyframes, easing, motion presets, pose swapping
on the timeline, camera pan/zoom, the timeline itself, transitions, text,
the export screen, waveforms, and the render-snapshot check (Phase 5+).
No paid AI calls (DOC-09). No new npm dependencies without a DOC-08 row
first. Every check cleans up tests/output/ on success. Update
docs/04-CHANGELOG.md, docs/10-PROJECT-TRACKER.md and docs/05-MANUAL.md in
the same commit as the code, and end each session with the report
described in CLAUDE.md. Add this kickoff prompt to docs/11-WORKFLOW.md as
Appendix E if it is not already there.
```

### Appendix E addendum — Alek's Phase 4 decisions (given with the kickoff; apply, do not re-ask)

a. Hidden layers are not drawn anywhere, export included. Locked layers
   still render; locking only blocks selection and dragging in the editor.
b. Background fit is the user's choice per scene: cover (scale to fill
   and crop, centred — the default) or stretch. Same code in the live
   canvas and export.
c. Add a Flip button now (flipX already exists in the keyframe). Rotation
   controls stay Phase 5, but rotation and flip from existing keyframes
   must still render.
d. The Layers panel shows the front-most layer at the top; layers[0] in
   the document is at the back.
e. A newly added layer is centred and scaled so it is at most half the
   frame height.
f. Keyframes stay in the reference space already used by the Phase 2
   code (1920×1080, 1080×1920, 1080×1080); the canvas fits that space to
   the available pixels.
g. Static placement is the layer's keyframe at time 0 (created when the
   layer is added; edited in place afterwards). Resize is uniform, since
   the document has a single scale. Opacity is that keyframe's opacity;
   the slider previews live and commits once on release.
h. A canvas drag moves only the sprite while the mouse is down and makes
   ONE setKeyframe edit on pointer-up (one undo step); Escape cancels with
   no edit. Selection is UI state only — not saved, not undoable.
i. Two optional fields on Layer (hidden, locked) and one on Scene
   (backgroundFit); update DOC-03 §3 in the same commit. Existing
   project.json files must load unchanged.

## Appendix F — Phase 5 kickoff prompt (paste into Claude Code)

Model: Fable for the foundations (verification record, animation engine, time strip and keyframe-at-playhead model, camera inside the renderer, render-snapshot check), then Opus for the contained feature work (DOC-10 §2); Alek may keep Fable throughout as in Phases 3–4. Plan first — Phase 5 introduces the animation engine every later phase (timeline, agent, export) renders through, and the render-snapshot check from ADR-015. Alek approved decisions a–k (addendum below) in the planning session; the prompt hands them over so they are not re-asked.

```
You are working in the PAPERCUT repository at:
C:\Users\Alek\Documents\Claude Code Projects\papercut
GitHub remote (origin): https://github.com/aleknowak1/papercut.git

Read CLAUDE.md in the repository root first. Then read, in this order:
docs/10-PROJECT-TRACKER.md (where we are), docs/02-DECISIONS.md (ADR-001,
ADR-006, ADR-011 and ADR-015 in particular), docs/03-ARCHITECTURE.md
(sections 1, 3 and 5), docs/01-PRODUCT-SPEC.md (section 5.1, the
Animation and Camera rows), docs/04-CHANGELOG.md CL-0037 to CL-0042 (what
Phase 4 actually built and how its sessions were run), docs/11-WORKFLOW.md
(Appendix E and its addendum show how Phase 4 was run; Appendix F is this
prompt and its addendum holds the decisions already made), docs/05-MANUAL.md
(M-3 as written, and the M-4.1 to M-4.6 headings you will fill in), and the
code Phase 5 builds on: app/shared/document/types.ts (Keyframe and
CameraKeyframe already exist), app/shared/document/edits.ts (setKeyframe,
removeKeyframe), app/shared/export/interpolate.ts (sampleLayer — easing is
stored but rendered linear today), app/shared/scene/geometry.ts
(timeZeroKeyframe and the reference space), app/renderer/src/scene/
sceneStage.ts (the ONE drawing path shared by canvas and export),
app/renderer/src/scene/SceneCanvas.tsx (selection, drag, one-undo-step
commits), app/renderer/src/export/frameSource.ts, and
app/renderer/src/dev/checkRunner.ts with scripts/check-export.mjs (how a
check runs inside the hidden Electron window).

Phases 0-4 are Complete. Alek verified Phase 4 and 4b by hand on
2026-09-03: background cover and stretch; adding cutouts and characters by
row button and by drag-and-drop onto the canvas; moving and resizing on
the canvas; drags as one undo step; Escape cancelling a drag; order, hide,
lock, opacity and flip; save and reopen. All worked. THIS IS NOT YET IN THE
CHANGE LOG. Your first commit, before any Phase 5 work: record it as the
next CL entry in docs/04-CHANGELOG.md (area "Verification", as CL-0034 did
for Phase 3), set Phase 4 to Complete in DOC-10 §2 and §1, remove the
Phase 4 try-out row from DOC-10 §5, and push.

The app today: Home screen; project document with undo/redo and auto-save;
Assets and Characters tabs; automatic cutouts in a background queue; the
mask editor; the three-column editor with the PixiJS scene canvas drawn by
sceneStage (the same code the export renders through); a Layers panel with
order/hide/lock/opacity/flip; placing and sizing on the canvas, where every
placement edit rewrites the layer's time-0 keyframe in place. Scenes are a
fixed 5 seconds with no way to change it. Nothing moves yet.

We are starting Phase 5: Animation (DOC-10 §2 row 5, DOC-01 §5.1 Animation
and Camera rows):

1. The animation engine, pure and shared. A new app/shared/animation/
   folder: easing.ts (the four curves — linear, ease-in, ease-out,
   ease-in-out — as plain functions of 0..1), interpolate.ts (moved from
   app/shared/export/, now applying the easing recorded on the keyframe a
   segment starts from; flip and pose stay step values), presets.ts (bob,
   walk, shake, pop as functions returning ordinary keyframes), camera.ts
   (the camera at time t as a transform, from Scene.cameraKeyframes; no
   camera keyframes means centred at zoom 1), and time.ts (the one
   function that turns a frame number into seconds and back, so "a
   keyframe at exactly the playhead" is exact equality, never a rounding
   error). Everything here is arithmetic covered by vitest tests. The
   canvas and export both consume it only through sceneStage, so what the
   user sees is what exports, structurally, as in Phase 4 (ADR-006/013).
   The camera is applied INSIDE sceneStage (the whole picture scaled and
   shifted so the camera's x/y sits at the frame centre), so export gets it
   with no extra code.

2. The time strip: a single thin row under the canvas — play/pause
   (Space), a scrubber from 0 to the scene duration, a time and frame
   readout, frame step (, and .), Prev/Next keyframe of the selected layer,
   a scene Duration field (1-120 s, through the existing setSceneDuration
   edit), and tick marks on the scrubber where the selected layer's
   keyframes sit. Play is a preview only: it calls sceneStage.update(t)
   every animation frame, writes nothing to the document, and stops at the
   scene end. The playhead is UI state — not saved, not undoable — like
   selection. No tracks, no dragging keyframes on the strip, no snap or
   zoom: that is Phase 6.

3. Keyframe authoring: the time-0 placement becomes "the keyframe at the
   playhead". Replace timeZeroKeyframe(layer) with keyframeAtPlayhead(
   layer, t): if the layer has a keyframe at exactly t, every canvas and
   inspector edit rewrites it in place, exactly as today; if not, the edit
   creates one at t seeded from how the layer looks at t (sampleLayer), so
   properties the edit did not touch keep their motion. With the playhead
   at 0 the app behaves exactly as it does now. The Layers panel's
   inspector for the selected layer grows X, Y, Scale, Rotation, Opacity
   fields, an Easing dropdown (the motion leaving this keyframe), a Pose
   dropdown for character layers, and Delete keyframe (removeKeyframe;
   the last keyframe cannot be deleted). Rotation also gets an on-canvas
   rotate handle above the selection box, committing once on release like
   a corner handle, Escape cancelling. Every edit stays one undo step
   through applyEdit.

4. Motion presets (M-4.4). For the selected layer, from the playhead:
   choose Bob, Walk, Shake or Pop, set two or three plain fields (duration
   — default to the scene end —, amount; Walk also a destination clicked
   on the canvas), press Apply. The preset BAKES ordinary keyframes into
   the layer in ONE undo step (one new edit function applying many
   keyframes); afterwards they are just keyframes. Preset keyframes are
   added on top of the layer's existing ones, replacing only same-time
   ones; values a preset does not drive are taken from the layer's motion
   at that time. Walk moves to the destination with a bob and a facing
   flip; Pop is scale 0 -> 1.15 -> 1 with a fade-in, ease-out. Presets are
   ordinary keyframes on purpose: the agent (Phase 12) only ever emits
   ordinary edits (ADR-011).

5. Pose swapping over time (M-4.5): the Pose dropdown at the playhead sets
   poseId on the keyframe there (rule 3); a pose holds until the next
   keyframe that names one. sceneStage already swaps textures.

6. Camera pan and zoom (M-4.6): a Camera button on the toolbar switches
   the canvas to camera mode — dragging pans, the wheel or a slider zooms,
   X/Y/Zoom fields in the inspector; each edit sets the camera keyframe at
   the playhead (same rule as layers, via new setCameraKeyframe /
   removeCameraKeyframe edits). Zoom is >= 1 and the view is clamped
   inside the frame (a pure function, checked), so a camera move never
   shows black edges. Picking, selection outlines and handles map through
   the camera transform (extend geometry.ts; checked as arithmetic).

7. The render-snapshot check (ADR-015), with nothing downloaded. A fixture
   project generated in code under tests/fixtures (the existing PNG writer:
   shapes with transparency, a gradient background, a two-pose "character")
   and a fixed list of about twelve named moments: static, mid-easing for
   each curve, rotation + flip, opacity, a pose swap, camera zoom + pan, one
   per motion preset. Each renders through the REAL sceneStage inside the
   hidden Electron window the export check already boots (as the audio
   fixture check rides in it — no second app start) at 480x270, is saved as
   PNG with our own encoder, and is compared to the approved references
   committed under tests/snapshots/. Tolerance: exact match with a small
   documented allowance for anti-aliased edges — at most 0.5 % of pixels
   differing by more than 8/255 per channel — so a GPU driver update does
   not fail the check while any real change does. On a mismatch the check
   FAILS and leaves tests/output/snapshots/ with expected, actual and diff
   images plus one contact sheet, and says exactly what to open; approving
   is one command, `npm run snapshots:approve`, which copies actual over
   reference for Alek to commit. First-time references are written
   automatically and listed in the session report for Alek to look at;
   every later change fails until approved. A green run leaves
   tests/output/ empty.

8. Other checks (ADR-015), all part of `npm run check`: easing curves hit
   known values; interpolation with easing at known times; presets produce
   the expected keyframes and one undo removes them all; keyframeAtPlayhead
   edits in place at an existing time and creates seeded keyframes
   otherwise; frame/second conversion is exact both ways; camera clamping
   and the camera-aware picking geometry as arithmetic; camera and
   keyframe edits round-trip save/reopen and undo; existing project.json
   files still load unchanged; the production-build scan finds no fixture
   or snapshot code shipping. Existing checks stay green. Tell me in the
   plan what `npm run check` will cost afterwards (86 s now; keep it
   around two minutes — the snapshot frames should add only a few seconds
   since they share the hidden window).

9. Manual sections M-4.1 to M-4.6 as each feature becomes usable, in the
   voice of M-3; DOC-10 §2/§3/§4 rows updated in the same commits.

10. Hand-off from Fable to Opus (DOC-10 §2 "Fable for keyframe engine ->
    Opus"). You (Fable) do the verification commit, steps 1, 2, 3, the
    camera inside sceneStage and its geometry (the renderer half of 6),
    and step 7 with its first references — the foundations. Steps 4, 5,
    the camera authoring UI (the editor half of 6), the rotate handle, and
    step 9 are contained feature work for Opus. When the foundations are
    usable and green, commit, push, and end the session with a written
    hand-off in DOC-10 §1 "Next action" plus a one-line prompt for the Opus
    session in the DOC-11 §4 step 2 form ("Read CLAUDE.md and DOC-10, then
    continue Phase 5: <task>"). Make the boundary clear in the plan; I may
    move it, or keep Fable throughout as in Phases 3 and 4. DOC-11 §6 allows
    parallel builders from Phase 4 for independent features — if the plan
    proposes any, name the boundaries (never two agents on one file);
    otherwise build alone, one feature at a time. At the END of Phase 5,
    DOC-11 §6 calls for a reviewer agent: a fresh agent that has not seen
    the code audits app/shared/animation and sceneStage against DOC-02 and
    DOC-03 and lists deviations; fix what it finds before closing the
    phase.

Do not write code yet (after the verification commit). First produce a
plan for my approval: the module layout, the time strip's exact controls,
how keyframeAtPlayhead replaces timeZeroKeyframe everywhere it is used,
how the camera transform goes through sceneStage and the picking geometry,
how the snapshot check rides in the hidden window and how its approve
command works, the decisions you are making within the ADRs, what exactly
is out of scope, and any questions for me. Decisions a-k below are already
made; do not re-ask them.

Out of scope for Phase 5: the multi-track timeline (tracks, dragging
keyframes, snap, timeline zoom — Phase 6), audio playback during preview
and audio clips (Phase 6), transitions (7), text (8), the talking
indicator (11), the export screen (9), per-property keyframe tracks
(keyframes stay whole-vector as DOC-03 §3 defines them), any bezier or
curve editor, and extra easing curves (bounce and overshoot wait for 1.x,
DOC-01 §5.2). No paid AI calls (DOC-09). No new npm dependencies without
a DOC-08 row first. No saved-format change: Keyframe and CameraKeyframe
already hold everything Phase 5 needs, and existing project.json files
must load unchanged (the existing check proves it). Every check cleans up
tests/output/ on success. Update docs/04-CHANGELOG.md,
docs/10-PROJECT-TRACKER.md and docs/05-MANUAL.md in the same commit as
the code, commit and push after each usable step, and end each session
with the report described in CLAUDE.md (what changed, which checks pass,
exactly what I should open and try — for the first session: scrub, play,
make one layer move between two keyframes, and look at the first snapshot
references — and what is next). This kickoff prompt is already archived
as docs/11-WORKFLOW.md Appendix F (CL-0042); do not add it again.
```

### Appendix F addendum — Alek's Phase 5 decisions (given with the kickoff; apply, do not re-ask)

a. Keyframe creation is automatic: any canvas or inspector edit at a time
   where the layer has no keyframe creates one at the playhead, seeded
   from the layer's motion at that time. An edit at an existing keyframe's
   time rewrites it in place. There is no separate "Add keyframe" button.
b. The playhead and every keyframe time snap to whole frames (1/fps),
   computed by one shared function, so equality of times is exact.
c. Easing stays the four existing presets (linear, ease-in, ease-out,
   ease-in-out). Bounce and overshoot wait for 1.x.
d. Motion presets bake into ordinary keyframes in one undo step. No
   separate "modifier" concept in the document.
e. Preset keyframes are added on top of the layer's existing keyframes
   from the playhead to the chosen end, replacing only same-time ones;
   values the preset does not drive come from the layer's motion at that
   time. The range is not cleared first.
f. Rotation: a number field in the inspector and an on-canvas rotate
   handle above the selection box; one undo step per drag, Escape cancels.
g. Camera zoom is >= 1 and the view is clamped inside the frame; a camera
   move never shows black edges.
h. Snapshot tolerance: exact match with a small documented allowance —
   at most 0.5 % of pixels differing by more than 8/255 per channel.
i. First-time snapshot references are written automatically and listed
   in the session report for Alek to look at; every later change fails the
   check until Alek approves it with `npm run snapshots:approve`.
j. Model: Fable for the foundations, Opus for the contained feature work,
   at the boundary in step 10; Alek may keep Fable throughout.
k. A scene Duration field (1-120 s) lives on the time strip.

## Appendix G — Phase 6 kickoff prompt (paste into Claude Code)

Model: Fable for the foundations (verification record, document fields and edits, the pure timeline module, previewSchedule, the mixer and decoder, the export change, all checks, M-5.5's mixing rules), then Opus for the timeline UI, its interactions, preview playback wiring and M-1.3 (DOC-10 §2 lists Opus for the phase; Alek chose the Phase 5 split). Plan first — the timeline is the editing surface every later phase (voices, sound library, agent) puts things on, and the audio path becomes the one export uses. Alek approved decisions a–m (addendum below) in the planning session; the prompt hands them over so they are not re-asked. No reviewer agent for this phase (DOC-11 §6 lists it for Phases 1, 5, 10 and 12).

```
You are working in the PAPERCUT repository at:
C:\Users\Alek\Documents\Claude Code Projects\papercut
GitHub remote (origin): https://github.com/aleknowak1/papercut.git

Read CLAUDE.md in the repository root first. Then read, in this order:
docs/10-PROJECT-TRACKER.md (where we are), docs/02-DECISIONS.md (ADR-001,
ADR-006, ADR-013 and ADR-015 in particular), docs/03-ARCHITECTURE.md
(sections 1, 2, 3, 4.3 and 5), docs/01-PRODUCT-SPEC.md (section 5.1, the
Sound and Timeline rows), docs/04-CHANGELOG.md CL-0042 to CL-0053 (what
Phase 5 actually built and how its sessions were run), docs/11-WORKFLOW.md
(Appendix F and its addendum show how Phase 5 was run; Appendix G is this
prompt and its addendum holds the decisions already made), docs/05-MANUAL.md
(M-4 as written; the M-1.3 and M-5.5 headings you will fill in), and the
code Phase 6 builds on: app/shared/document/types.ts (AudioClip, Keyframe,
CameraKeyframe), app/shared/document/edits.ts and validate.ts,
app/shared/animation/ (time.ts, keyframes.ts, camera.ts — the
frame-snapping and keyframe-at-playhead rules), app/shared/export/
audioMix.ts and wav.ts (the mixer: mono, 48 kHz WAV only today),
app/renderer/src/export/exportProject.ts (how clips reach the mixer),
app/renderer/src/assets/importAudio.ts (decoding through Chromium),
app/renderer/src/scene/TimeStrip.tsx (the strip the timeline replaces),
app/renderer/src/scene/LayersPanel.tsx and App.tsx (the editor layout and
playhead state), app/shared/scene/addToScene.ts (the Phase 4b "every road
in" pattern), tests/fixtures/audioFixtures.ts (the code-generated WAV and
M4A), and app/renderer/src/dev/checkRunner.ts with scripts/check-export.mjs.

Phases 0-5 are Complete. Alek verified the Phase 5 feature half by hand on
2026-09-04: the four motion presets applied and undone (Walk's destination
clicked on the canvas), camera mode with wheel zoom and drag pan at two
playhead positions gliding between them on play, and the rotate handle
with Escape mid-swing writing nothing. All worked. THIS IS NOT YET IN THE
CHANGE LOG. Your first commit, before any Phase 6 work: record it as the
next CL entry in docs/04-CHANGELOG.md (area "Verification", as CL-0048
did), remove the Phase 5 try-out row from DOC-10 §5, note the verification
in DOC-10 §1, and push.

The app today: Home screen; project document with undo/redo and
auto-save; Assets and Characters tabs (image and audio import; the ♪ rows
have Play/Stop); automatic cutouts; the mask editor; the three-column
editor with the PixiJS scene canvas drawn by sceneStage (the same code
the export renders through); Layers panel with the keyframe inspector,
motion presets and camera panel; the time strip under the canvas
(play/pause, frame-snapped scrubber with keyframe ticks, frame stepping,
keyframe jumps, Duration). Keyframes exist for layers and the camera.
Audio clips exist in the document (start, volume, fades) but nothing in
the UI creates one, preview is silent, and the export mixer accepts only
48 kHz WAV — an imported MP3, M4A or OGG clip would make export throw.

We are starting Phase 6: Timeline and audio (DOC-10 §2 row 6; DOC-01 §5.1
Timeline and Sound rows):

1. The pure timeline module, app/shared/timeline/: time <-> pixel mapping
   for a zoom level and scroll offset, the snap function (decision d:
   whole frames always; when within a screen-pixel tolerance, the
   playhead, other keyframes of the same track, clip edges and whole
   seconds — returns what it snapped to so the UI can show it), lane
   packing for overlapping clips (decision g), and previewSchedule(scene,
   fromTime, assetDurations): which clips sound from time t, each with its
   source offset, length and gain envelope after trim, volume and fades.
   previewSchedule feeds BOTH the Web Audio preview and the export mixer,
   so what Alek hears is what exports. All arithmetic, all under vitest.

2. Audio clips in the document (decision f). AudioClip gains two OPTIONAL
   fields: trimStartSeconds (how far into the sound the clip begins,
   default 0) and durationSeconds (how much of it plays, default: the rest
   of the sound). Existing project.json files load unchanged (the existing
   check proves it); validate.ts refuses nonsense values in plain language
   as it does for keyframes since CL-0052. Update DOC-03 §3 in the same
   commit. New edits through the one-undo-step path: moveAudioClip (start
   time, never below 0), trimAudioClip (start and length, never outside
   the sound's real extent — the edit takes the source duration), set
   volume / fade in / fade out, and moveKeyframe(layer, fromTime, toTime)
   plus moveCameraKeyframe, which refuse a destination frame that already
   holds a keyframe (the drag stops beside it, decision c). Every time
   passes through animation/time.ts so equality stays exact.

3. The mixer and the decoder (decision j). Export decodes EVERY clip
   through Chromium's decoder (OfflineAudioContext at 48 kHz, mono, the
   way importAudio.ts already does) instead of parseWav, so MP3, M4A, OGG
   and any sample rate export correctly; parseWav stays for the fixtures
   and tests. audioMix.ts takes trim from previewSchedule. Export stays
   mono; open OQ-024 in DOC-07 for stereo at Phase 9 (real export) — it
   touches the encoder config and verifyMp4.

4. The timeline (decisions a, b, c, d, e, g). It REPLACES the time strip:
   a panel under the canvas spanning the middle column, drawn with
   React/SVG (PixiJS stays reserved for the picture; nothing in sceneStage
   changes, so the 14 snapshots stay untouched). Header row: the strip's
   transport moved over (play/pause, frame step, prev/next keyframe,
   readout, Duration) plus the Snap toggle and a zoom slider. Then a ruler
   with the draggable playhead (scrub). Then the tracks, top to bottom: one
   Camera row, one row PER LAYER in Layers-panel order (front-most at the
   top; the background has no row), each showing its keyframes as
   diamonds, then the audio lanes. Clicking a diamond selects that layer
   (or camera mode) and moves the playhead to it, so the existing inspector
   edits that keyframe. Dragging a diamond moves the keyframe in time — one
   undo step on release, Escape cancels, occupied frames refused. Zoom by
   Ctrl+wheel and the slider from "whole scene fits" to 200 px per second;
   horizontal scroll by wheel / Shift+wheel; the view follows the playhead
   during play. With many layers the tracks scroll vertically at a fixed
   row height; a row is drawn from its own layer's keyframes only, memoised,
   so redraws stay cheap (DOC-03 §5: scrubbing responsive with 20 layers).
   Delete the TimeStrip component once the timeline carries everything it
   did (no two components doing one job).

5. Sounds onto the timeline (decision h), the Phase 4b way: an "Add to
   timeline" button on every ♪ row in the Assets tab (the clip lands at the
   playhead) and drag-and-drop from the row onto the audio lanes (it lands
   at the drop time), both through one shared module as addToScene.ts is.
   A clip is a block with the sound's name and a waveform drawn from
   decoded peaks held in memory for the session (decision k — nothing
   written to cache/). Overlapping clips pack into separate lanes
   automatically.

6. Editing a clip (decision h): drag the body to move; drag either edge to
   trim; small fade handles at the top corners set the fade lengths;
   select a clip and the right panel shows Start, Volume, Fade in, Fade
   out and Delete. Each interaction previews live and commits ONCE on
   release (one undo step), Escape cancels. A clip running past the scene
   end is drawn hatched from that point and is simply cut at export (the
   mixer already drops samples past the end). Selection of clips is UI
   state, like layer selection.

7. Hearing it (decision i): on play, the clips previewSchedule returns are
   scheduled through Web Audio (AudioBufferSourceNode + GainNode per clip:
   trim as the source offset and duration, volume and fades as the gain
   envelope) from the playhead; pause and the scene end stop sound at
   once; scrubbing is silent. Each sound is decoded once per session and
   cached in memory by asset id + file. Muting is not a feature yet; the
   Play/Stop button on the ♪ row stays as it is.

8. Checks (ADR-015), all part of `npm run check`: timeline mapping and
   snapping as arithmetic (including "snapped to what"); lane packing;
   previewSchedule at known times with trim, fades and overlap; the mixer
   with trim sample-for-sample; moveKeyframe / moveCameraKeyframe /
   clip edits round-trip save/reopen and undo; the occupied-frame refusal;
   older project.json files load unchanged; bad trim values refused. The
   export check gains a trimmed clip and an M4A clip (the code-generated
   AAC fixture from tests/fixtures/audioFixtures.ts) whose beeps must
   still land on their flashes within the existing drift limit — that
   proves the decoder path end to end. Snapshots must stay 14/14 unchanged.
   The production-build scan keeps proving no fixture code ships. Nothing
   downloaded. Tell me in the plan what `npm run check` will cost
   afterwards (about 90 s now; keep it around two minutes).

9. Manual (decision m): M-1.3 "A tour of the interface" written now as the
   full tour (home screen, the three columns, the canvas, the right panel,
   the timeline and its transport), and M-5.5 for placing, trimming,
   fading and mixing audio — both in the voice of M-3/M-4. M-1.4 waits for
   voices (Phase 11). DOC-10 §2/§3/§4 rows updated in the same commits.

10. Hand-off from Fable to Opus (decision l). You (Fable) do the
    verification commit and steps 1, 2, 3 and 8's foundations (the pure
    tests, the mixer/decoder tests, the extended export check), plus
    M-5.5's mixing rules — the foundations. Steps 4, 5, 6, 7 and M-1.3 are
    contained feature work for Opus. When the foundations are usable and
    green, commit, push, and end the session with a written hand-off in
    DOC-10 §1 "Next action" plus a one-line prompt for the Opus session in
    the DOC-11 §4 step 2 form ("Read CLAUDE.md and DOC-10, then continue
    Phase 6: <task>"). Make the boundary clear in the plan; I may move it.
    Build alone, one feature at a time (the timeline and the clip editing
    share one component, so there is no clean boundary for two agents).

Do not write code yet (after the verification commit). First produce a
plan for my approval: the module layout, the exact timeline layout and
header controls, how the time strip's state and keyboard handling move
into the timeline, how previewSchedule feeds both Web Audio and the mixer,
how the decoder replaces parseWav in export without touching the check's
fixtures, the decisions you are making within the ADRs, what exactly is
out of scope, and any questions for me. Decisions a-m below are already
made; do not re-ask them.

Out of scope for Phase 6: dialogue and TTS lines, the talking indicator
and attachedToLayerId behaviour (Phase 11), the sound library (13),
transitions and more than one scene on the timeline (7 — the timeline
shows the current scene), text (8), the export screen and stereo (9,
OQ-024), multi-select and copy/paste of keyframes or clips, ripple
editing, audio recording, waveform files on disk, per-property tracks,
and mute/solo. No paid AI calls (DOC-09). No new npm dependencies without
a DOC-08 row first. Every check cleans up tests/output/ on success. Update
docs/04-CHANGELOG.md, docs/10-PROJECT-TRACKER.md, docs/03-ARCHITECTURE.md
(§3 for the clip fields), docs/07-OPEN-QUESTIONS.md (OQ-024) and
docs/05-MANUAL.md in the same commit as the code, commit and push after
each usable step, live-verify each feature in the running app as the
Phase 4 and 5 sessions did, and end each session with the report
described in CLAUDE.md (what changed, which checks pass, exactly what I
should open and try — for the Opus session: drop a sound on the timeline,
trim it, fade it, play it, and drag a keyframe diamond — and what is
next). This kickoff prompt is already archived as docs/11-WORKFLOW.md
Appendix G (CL-0053); do not add it again.
```

### Appendix G addendum — Alek's Phase 6 decisions (given with the kickoff; apply, do not re-ask)

a. The timeline replaces the time strip; the strip's transport controls
   move into the timeline's header row. One component, not two.
b. The timeline is drawn with React/SVG, not PixiJS. PixiJS stays
   reserved for the scene picture; sceneStage does not change.
c. Keyframe diamonds are draggable in time on the timeline: one undo step
   on release, Escape cancels, a destination frame that already holds a
   keyframe is refused (the drag stops beside it).
d. Snap is on by default: whole frames always; within about six screen
   pixels also the playhead, other keyframes of the same track, clip
   edges and whole seconds. A Snap toggle turns the extras off.
e. Zoom by Ctrl+wheel and a slider, from "whole scene fits" to 200 px per
   second; horizontal scroll; the view follows the playhead during play.
f. AudioClip gains optional trimStartSeconds (default 0) and
   durationSeconds (default: the rest of the sound). Old files load
   unchanged. DOC-03 §3 updated with the change.
g. Overlapping clips pack into separate lanes automatically; nothing
   hides behind anything.
h. Sounds reach the timeline by an "Add to timeline" button on every ♪
   row (lands at the playhead) and by drag-and-drop onto the lanes (lands
   at the drop time), as Phase 4b did for the scene. Clips are edited by
   dragging body, edges and fade handles, plus Start / Volume / Fade in /
   Fade out / Delete fields in the right panel; one undo step each.
i. Preview audio plays through Web Audio during play with trim, volume
   and fades; pause stops it at once; scrubbing is silent.
j. Export decodes every clip through Chromium's decoder at 48 kHz mono
   (MP3, M4A, OGG and any sample rate now export correctly); export stays
   mono; stereo is OQ-024 for Phase 9.
k. Waveform peaks are computed from the decoded sound and held in memory
   for the session; nothing is written to cache/.
l. Model: Fable for the foundations, Opus for the timeline UI, at the
   boundary in step 10; Alek may move it.
m. M-1.3 is written now as the full interface tour; M-5.5 covers audio
   clips.
n. (From Alek's question) Every layer — each character and each prop —
   has its own row on the timeline in Layers-panel order; the camera has
   one row above them; the background has none. A row shows whole
   keyframes as diamonds, not per-property sub-rows.

## Appendix H — Phase 7 kickoff prompt (paste into Claude Code)

Model: Fable for the foundations (verification record, document fields and edits, projectTime and projectSchedule, the transition arithmetic, projectStage, export over every scene, the export check and the nine new snapshots, M-6.2's rules and M-6.3's timing text), then Opus for the scene strip, the Transition panel, canvas/timeline switching, play-through with sound, the ruler tints and M-6.1 (DOC-10 §2 lists Opus for the phase; Alek ran both halves of Phases 5 and 6 on Fable and may again). Plan first — the timing model and projectStage are the layer every later phase's export rides on. Alek approved decisions a–r (addendum below) in the planning session; the prompt hands them over so they are not re-asked. No reviewer agent for this phase (DOC-11 §6 lists it for Phases 1, 5, 10 and 12).

```
You are working in the PAPERCUT repository at:
C:\Users\Alek\Documents\Claude Code Projects\papercut
GitHub remote (origin): https://github.com/aleknowak1/papercut.git

Read CLAUDE.md in the repository root first. Then read, in this order:
docs/10-PROJECT-TRACKER.md (where we are), docs/02-DECISIONS.md (ADR-001,
ADR-006, ADR-013 and ADR-015 in particular), docs/03-ARCHITECTURE.md
(sections 3, 4.3 and 5), docs/01-PRODUCT-SPEC.md (section 5.1, the Scenes
and Timeline rows), docs/04-CHANGELOG.md CL-0053 to CL-0065 (what Phase 6
actually built and how its sessions were run), docs/11-WORKFLOW.md
(Appendix G and its addendum show how Phase 6 was run; Appendix H is this
prompt and its addendum holds the decisions already made), docs/05-MANUAL.md
(M-1.3 and M-5.5 as written; the M-6.1–M-6.3 headings you will fill in),
and the code Phase 7 builds on: app/shared/document/types.ts (Scene,
TransitionType — the seven types already exist), create.ts, edits.ts
(addScene, removeScene, renameScene, setSceneDuration, setSceneTransition)
and validate.ts, app/renderer/src/scene/sceneStage.ts (the ONE renderer the
canvas and export share — it does not change in this phase) and
SceneCanvas.tsx, app/renderer/src/timeline/Timeline.tsx and
previewPlayer.ts (the current scene only), app/renderer/src/export/
exportProject.ts and frameSource.ts (the first scene only today),
app/shared/timeline/previewSchedule.ts and app/shared/export/audioMix.ts
(per-scene audio), tests/fixtures/snapshotProject.ts and
app/renderer/src/dev/snapshotRunner.ts (the 14 moments), app/renderer/src/
dev/exportTestAssets.ts, checkRunner.ts and verifyMp4.ts (what the export
check can measure), and App.tsx (scene = doc.scenes[0], the play loop, the
selection state, the editor layout with the timeline dock).

Phases 0-6 are Complete. Phase 6b (CL-0064) moved the timeline below all
three columns, full window width, with a draggable divider for its height.
Alek tried it by hand on 2026-09-04 and accepted it: the timeline spans the
window, the divider resizes it, the canvas still fits. THIS IS NOT YET IN
THE CHANGE LOG. Your first commit, before any Phase 7 work: record it as
CL-0066 in docs/04-CHANGELOG.md (area "Verification", as CL-0063 did),
note it in DOC-10 §1 under the Phase 6b paragraph, and push. The working
tree already holds uncommitted docs edits from the planning session
(CL-0065: this prompt archived as DOC-11 Appendix H, DOC-10 "Next action"
repointed) — include them in that same first commit, as CL-0053 was
handled. If an untracked "Claude outputs" folder sits in the repo root,
leave it alone and tell Alek; it is not part of the project.

The app today: Home screen; project document with undo/redo and
auto-save; Assets and Characters tabs; automatic cutouts; the mask editor;
the three-column editor with the PixiJS scene canvas drawn by sceneStage
(the same code export renders through); Layers panel with the keyframe
inspector, motion presets and camera panel; the full-width timeline below
the columns with the transport, ruler, camera and layer rows, and the sound
lanes with Web Audio preview. The document already has scenes[] with
transitionOut and the seven TransitionType values, and edits to add,
remove, rename, set the duration and set the transition of a scene — but
the editor shows scenes[0] only, export renders scenes[0] only, addScene
appends at the end, removeScene will delete the last scene, and nothing
draws a transition anywhere.

We are starting Phase 7: Scenes and transitions (DOC-10 §2 row 7; DOC-01
§5.1 Scenes row):

1. The document (decisions b, f). Scene gains ONE optional field,
   transitionOutSeconds (absent = 0.5 s); older project.json files load
   unchanged (the existing check proves it). types.ts gains a
   TRANSITION_TYPES list like EASING_TYPES; validate.ts refuses an unknown
   transition type and a nonsense length in plain language. Edits through
   the one-undo-step path, rules in the edits themselves (ADR-011):
   insertScene(doc, afterSceneId, scene) (addScene may stay for the
   fixtures), duplicateScene(doc, sceneId, ids) copying the whole scene —
   layers, keyframes, camera, clips, background, transition — with fresh
   ids, reorderScene(doc, sceneId, direction), removeScene REFUSING the
   last scene, setSceneTransition (exists) and setSceneTransitionLength
   clamped to 0.1–3 s and to half of the shorter neighbouring scene. A
   refused or pointless edit returns the SAME document (no empty undo
   step). DOC-03 §3 updated in the same commit.

2. The timing model, pure (decisions e, f, g, i). New
   app/shared/timeline/projectTime.ts: the effective transition length of
   each scene (stored or default, clamped again to half the shorter
   neighbour, 0 for a cut and for the last scene), each scene's global
   start (a scene begins t seconds before the previous one ends), the
   total length (sum of durations minus the transition lengths), global ↔
   (scene, local time) both ways, and for a global time: which scene(s)
   show and the transition's progress 0..1. New
   app/shared/transitions/transition.ts: for (type, progress) the numbers
   the renderer applies to the outgoing and incoming scene — alpha, x/y
   offset in reference pixels, scale about the centre, and the wipe's
   reveal width — exactly per decision g. New projectSchedule(doc,
   fromGlobalTime, soundSeconds) beside previewSchedule: every scene's
   previewSchedule shifted by that scene's global start (each scene's
   clips still cut at their own scene's end; during an overlap both scenes
   sound), the one translation export AND the preview consume (decision
   j: no automatic fades). All arithmetic, all under vitest.

3. Rendering (decision h). New app/renderer/src/scene/projectStage.ts:
   owns one sceneStage per scene it needs, and for a global time poses one
   scene, or two during a transition, applying transition.ts's numbers
   (a mask rectangle for the wipe; the incoming scene drawn at its own
   local time). sceneStage.ts DOES NOT CHANGE and the 14 snapshots stay
   untouched. The canvas draws through projectStage at the global time of
   (current scene, local playhead), so the last half-second before a
   crossfade really shows the next scene fading in, exactly as export will
   (ADR-006); picking, dragging and the camera preview still address only
   the current scene's sprites. The canvas needs textures for the current
   scene and its two neighbours.

4. Export (decision i). exportProject renders EVERY scene: the frame count
   from projectTime's total, each frame drawn by projectStage at its global
   time; audio mixed from projectSchedule through the unchanged mixer.
   frameSource takes projectStage instead of sceneStage. Phase 9's presets
   and export screen are not this phase.

5. The scene strip (decisions a, b, c). Across the full window width
   directly above the timeline's header, inside the dock: one card per
   scene in play order — number, name, duration — a small arrow between
   cards showing the transition type, "+ Scene" at the end, the total
   video length at the right. "+ Scene" inserts an empty scene (no
   background, no layers, a new project's default duration) after the
   selected one and selects it; the selected card has Duplicate, ◀ ▶
   (reorder, one undo step each) and ✕ (refused for the last scene;
   deleting the selected scene selects its neighbour); click the name to
   rename (Enter confirms, Escape cancels). Selection is UI state like
   layer selection — not saved, not an undo step: it switches the canvas,
   the Layers panel, the toolbar's Background/Fit, every "Add to scene" /
   "Add to timeline" target and the timeline to that scene; the playhead
   resets to 0, layer/clip selection clears, camera mode ends. If undo
   removes the selected scene, selection falls back to the first scene.

6. The Transition panel (decision m). Clicking the arrow between two
   cards (or a "Transition" button on the selected card) turns the right
   panel into the Transition panel: Type dropdown (Cut first, then the
   six), Length field (hidden for Cut; 0.1–3 s, clamped as in step 1), a
   one-line hint per type, Done. One undo step per change; Escape steps
   back out, as the Camera and Sound clip panels do.

7. The timeline and play-through (decisions k, l). The timeline still
   shows the current scene only; the ruler tints the transition-out window
   at the scene's end and the transition-in window at its start (the
   readout stays local). Play no longer stops at the scene's end unless it
   is the last scene: at the end of scene A the current scene switches to
   B with B's playhead at the overlap length, the view follows, and play
   stops at the end of the last scene. Sound for the whole run is
   scheduled ONCE from projectSchedule at the global playhead, so nothing
   restarts at the boundary — the scene switch is UI state, not an edit,
   and must not tear the play run down. Scrubbing stays silent and inside
   the current scene.

8. Checks (ADR-015), all part of `npm run check`: projectTime and
   transition.ts as arithmetic (starts, total, both mappings, progress,
   the clamps, every type at 0 / 0.5 / 1); projectSchedule at known
   global times with an overlap; every new edit round-trips save/reopen
   and undo; the last-scene refusal; older files load unchanged; bad
   types and lengths refused by name. The export check's dev content gains
   a SECOND scene — short, with its own beep on its own flash at a known
   local time and a different background brightness — joined by a 0.5 s
   crossfade: the read-back duration and frame count must equal
   10 + scene 2 − 0.5 s to the frame, and scene 2's beep must land at its
   shifted global time within the existing drift limit (decision n). If
   it can be done without disturbing the flash detection, the
   mid-crossfade frame's mean brightness must sit between the two scenes'
   levels; otherwise the snapshots carry the picture proof. "Load test
   content (dev)" gives Alek the same two-scene project. Snapshots
   (decision o): NINE new moments through the real projectStage with a
   two-scene fixture — mid-progress crossfade, slide left/right/up/down,
   zoom in, zoom out, wipe, and the first frame after a cut — 14 → 23,
   first references written for Alek to look at, contact sheet and
   `npm run snapshots:approve` as before. Nothing downloaded. Tell me in
   the plan what `npm run check` will cost afterwards (about 75–90 s now;
   keep it around two minutes).

9. Manual (decision p): M-6.1 adding, duplicating, reordering, renaming,
   deleting and selecting scenes; M-6.2 the seven types with a "when to
   use" hint each and the overlap rule; M-6.3 scene duration, transition
   length, how the total is computed, and what sound does at a boundary —
   in the voice of M-4/M-5.5. M-1.3's tour gains one sentence for the
   strip. DOC-10 §2/§3/§4 rows updated in the same commits.

10. Hand-off from Fable to Opus (decision q). You (Fable) do the
    verification commit and steps 1, 2, 3, 4 and 8, plus M-6.2's rules and
    M-6.3's timing text — the foundations. Steps 5, 6, 7 and the rest of
    9 are contained feature work for Opus. When the foundations are usable
    and green (export of a two-scene dev project proven by the check),
    commit, push, and end the session with a written hand-off in DOC-10 §1
    "Next action" plus a one-line prompt for the Opus session in the
    DOC-11 §4 step 2 form ("Read CLAUDE.md and DOC-10, then continue
    Phase 7: <task>"). Make the boundary clear in the plan; I may move it.
    Build alone, one feature at a time.

Do not write code yet (after the verification commit). First produce a
plan for my approval: the module layout, the exact timing arithmetic with
one worked example (three scenes, two transitions, the total and each
start), how projectStage composes two sceneStages per type and how the
canvas and frameSource both consume it, how the textures for neighbouring
scenes reach the canvas, how the play loop and previewPlayer change for
play-through without restarting sound, how the export check's second
scene and beep are built, the decisions you are making within the ADRs,
what exactly is out of scope, and any questions for me. Decisions a–r
below are already made; do not re-ask them.

Out of scope for Phase 7 (decision r): drag-and-drop reorder of scene
cards; scene thumbnails in the strip; a project-wide timeline; remembered
per-scene playheads; automatic audio fades at transitions; wipe directions
other than left-to-right and any transition easing controls; transitions
within a scene or on layers; copying layers between scenes (Duplicate
scene covers it); text (8); the export screen, presets and stereo (9,
OQ-024). No paid AI calls (DOC-09). No new npm dependencies without a
DOC-08 row first. Every check cleans up tests/output/ on success. Update
docs/04-CHANGELOG.md, docs/10-PROJECT-TRACKER.md, docs/03-ARCHITECTURE.md
(§3 for the new field) and docs/05-MANUAL.md in the same commit as the
code, commit and push after each usable step, live-verify each feature in
the running app as the Phase 5 and 6 sessions did, and end each session
with the report described in CLAUDE.md (what changed, which checks pass,
exactly what I should open and try — for the Opus session: add a second
scene, put something in it, set a crossfade, press play from the end of
scene 1 and watch it flow across, reorder, duplicate, delete, reopen — and
what is next). This kickoff prompt is already archived as
docs/11-WORKFLOW.md Appendix H (CL-0065); do not add it again.
```

### Appendix H addendum — Alek's Phase 7 decisions (given with the kickoff; apply, do not re-ask)

a. Scenes live in a scene strip across the full window width directly
   above the timeline header: one card per scene in play order (number,
   name, duration), a small arrow between cards showing the transition
   type, "+ Scene" at the end, the total video length at the right.
b. "+ Scene" inserts an empty scene after the selected one and selects
   it; Duplicate copies the whole scene with fresh ids; click the name to
   rename; ✕ deletes, refused for the last scene (a project always has
   one), and deleting the selected scene selects its neighbour; ◀ ▶
   reorder, one undo step each. No drag-and-drop reorder.
c. The selected scene is UI state like layer selection (not saved, not an
   undo step). Selecting switches the canvas, the Layers panel, the
   toolbar's Background/Fit, every "Add to scene" / "Add to timeline"
   target and the timeline; the playhead resets to 0, layer/clip
   selection clears, camera mode ends. If undo removes the selected
   scene, selection falls back to the first scene.
d. Duration stays per scene through the timeline's Duration field; the
   strip shows each length and the total. Nothing new in the document.
e. Timing model: overlap. A transition of length t makes the next scene
   start t seconds before this one ends; the total is the sum of scene
   durations minus the transition lengths. During the overlap the outgoing
   scene plays its last t seconds and the incoming scene its first t
   seconds. A cut has no length and no overlap.
f. Scene gains optional transitionOutSeconds (absent = 0.5 s). Older files
   load unchanged. A TRANSITION_TYPES list; validation refuses unknown
   types and nonsense lengths. The length is clamped to 0.1–3 s and to
   half of the shorter neighbouring scene, in the edit and again in
   projectTime. The last scene's transitionOut is kept but ignored; a
   moved scene takes its transition with it. DOC-03 §3 updated.
g. The seven types: cut — hard switch. Crossfade — the incoming scene
   fades in over the outgoing one, linear. Slide left/right/up/down — a
   push: the outgoing scene moves off in that direction while the incoming
   one moves in behind it, ease-in-out. Zoom in — the outgoing scene grows
   to 2.5× about the centre and fades out, revealing the incoming scene
   beneath. Zoom out — the incoming scene arrives at 2.5×, shrinking to 1×
   and fading in over the outgoing one. Wipe — the incoming scene revealed
   left-to-right by a hard vertical edge. All computed as numbers per
   frame by a pure module from type and progress.
h. One new layer above sceneStage: projectTime.ts (pure) and
   projectStage.ts (renderer), which owns one sceneStage per scene and
   composes one or two of them for a global time. sceneStage does not
   change; the 14 snapshots stay untouched. The canvas and export both
   draw through projectStage, so the canvas shows a transition exactly as
   export will (ADR-006/013); picking still addresses the current scene.
i. Export renders every scene through projectStage over projectTime's
   total; audio comes from projectSchedule (every scene's previewSchedule
   shifted by its global start), which feeds the mixer and the preview
   alike. Each scene's clips are still cut at their own scene's end.
j. No automatic audio fade at a transition: both scenes are audible during
   the overlap; the user's own clip fades shape it.
k. Play continues into the next scene through the transition (the current
   scene switches at the boundary, the incoming scene's playhead starting
   at the overlap length) and stops at the end of the last scene. Sound
   for the run is scheduled once from projectSchedule; the scene switch
   must not restart it. Scrubbing stays silent, inside the current scene.
l. The timeline shows the current scene only; its ruler tints the
   transition-out window at the end and the transition-in window at the
   start. The readout stays local. No project-wide timeline.
m. The Transition panel replaces the right panel when the arrow between
   two cards (or the selected card's Transition button) is clicked: Type
   (Cut first), Length (hidden for Cut), a hint per type, Done; one undo
   step per change; Escape steps out.
n. The export check's dev content gains a second scene with its own beep
   on its own flash and a different background brightness, joined by a
   0.5 s crossfade; read-back duration, frame count and the shifted beep
   prove the timing model and audio offset end to end; the mid-crossfade
   brightness check is added only if it does not disturb flash detection.
   Nothing downloaded.
o. Nine new snapshot moments through projectStage: mid-progress
   crossfade, slide ×4, zoom in, zoom out, wipe, and the first frame after
   a cut (14 → 23).
p. M-6.1 scenes; M-6.2 the seven types with "when to use" hints and the
   overlap rule; M-6.3 duration, transition length, the total, sound at a
   boundary. M-1.3 gains one sentence for the strip.
q. Model: Fable for the foundations (steps 1–4 and 8, M-6.2 rules, M-6.3
   timing), Opus for the strip, the Transition panel, switching,
   play-through and M-6.1, at the boundary in step 10; Alek may move it
   or run both halves on Fable as in Phases 5 and 6. No reviewer agent.
r. Out of scope: drag-and-drop reorder; scene thumbnails; a project-wide
   timeline; remembered per-scene playheads; automatic audio fades; wipe
   directions other than left-to-right and transition easing controls;
   transitions within a scene or on layers; copying layers between scenes;
   text (8); the export screen, presets and stereo (9, OQ-024).

## Appendix I — Phase 7b kickoff prompt (paste into Claude Code)

Model: Fable, one session, two commits (the Movie editor, then the Scene editor cleanup and the manual). Phase 7b is a rearrangement of the finished Phase 7 into two screens — Alek's layout feedback, as Phase 6b was — not new mechanics: the document, the edits, the timing model, projectStage and export do not change (one optional poster field aside). Alek approved decisions a–k (addendum below) in the planning session; the prompt hands them over so they are not re-asked. No reviewer agent.

```
You are working in the PAPERCUT repository at:
C:\Users\Alek\Documents\Claude Code Projects\papercut
GitHub remote (origin): https://github.com/aleknowak1/papercut.git

Read CLAUDE.md in the repository root first. Then read, in this order:
docs/10-PROJECT-TRACKER.md (where we are), docs/02-DECISIONS.md (ADR-006,
ADR-013 and ADR-015 in particular), docs/04-CHANGELOG.md CL-0064 to
CL-0078 (Phase 6b's layout change and everything Phase 7 built),
docs/11-WORKFLOW.md (Appendix H and its addendum show how Phase 7 was
run and the decisions it was built to; Appendix I is this prompt and its
addendum holds the Phase 7b decisions), docs/05-MANUAL.md (M-1.3, M-6.1,
M-6.2 and M-6.3 as written — you will retell them), and the code Phase 7b
rearranges: App.tsx (the masthead, the editor layout, the selectedSceneId
state and its reset, the timeline dock and divider), app/renderer/src/
timeline/SceneStrip.tsx and TransitionPanel.tsx (the components that move
to the Movie editor), Timeline.tsx (the play loop with play-through and
the tinted transition windows), previewPlayer.ts (the once-scheduled
project-wide sound), app/renderer/src/scene/SceneCanvas.tsx and
projectStage.ts (the canvas draws the project at global time), sceneStage.ts
(the one-scene renderer — the card pictures come from it),
app/shared/timeline/projectTime.ts, app/shared/document/types.ts, edits.ts
and validate.ts, and styles.css.

Phases 0-6 are Complete; Phase 7 is Usable (CL-0067–CL-0077). Alek looked
at the Phase 7 layout on 2026-09-05 and DID NOT try it: with the scene
strip squeezed into the timeline dock, the Transition panel taking over
the right column and play switching the selected scene under him, he
found the screen too complicated to understand, and asked for two
separate screens instead — one for editing a single scene, one for
stitching scenes into the movie. THIS IS NOT YET IN THE CHANGE LOG. Your
first commit, before any Phase 7b work: record it as CL-0079 in
docs/04-CHANGELOG.md (area "Verification", in the plain style of
CL-0073: what he looked at, that the try-out was declined and why, that
the hands-on verification of Phase 7 folds into the 7b try-out), note it
in DOC-10 §1, replace the Phase 7 try-out row in DOC-10 §5 with a note
that the try-out waits for 7b, and push. The working tree already holds
uncommitted docs edits from the planning session (CL-0078: this prompt
archived as DOC-11 Appendix I, DOC-10 "Next action" repointed) — include
them in that same first commit, as CL-0053 and CL-0065 were handled. If
an untracked "Claude outputs" folder sits in the repo root, leave it
alone and tell Alek; it is not part of the project.

We are doing Phase 7b: the two-screen editor (decisions a–k):

1. Two tabs in the masthead (decision a): Movie and Scene — the Scene tab
   shows the name of the scene it holds ("Scene: Airport"). Opening a
   project lands on Movie with its first card selected and a clear
   "Edit scene" button. Which screen is showing is UI state (not saved,
   not an undo step).

2. The Movie editor (decisions b, e, f). Top: a preview canvas of the
   whole video drawn through projectStage at global time — transitions
   exactly as they export (ADR-006/013). Under it the transport:
   play/pause (Space), a scrub bar for the whole movie with the scene
   boundaries marked, the time readout and the total length (from
   projectTime; no arithmetic in the UI). Below: the row of cards in
   play order — each the scene's picture (step 3), its name and length —
   with the transition drawn as an arrow between cards. Click a card to
   select it; the selected card carries Edit scene, Duplicate, ◀ ▶, ✕
   (greyed for the last scene) and click-to-rename (Enter confirms,
   Escape cancels); "+ Scene" at the end inserts after the selected card
   and selects it. Click an arrow (or the selected card's Transition
   button) and the right side of the screen shows the Transition panel —
   the existing TransitionPanel moved here. Double-click a card, press
   Enter, or press Edit scene to open it in the Scene editor. Playing the
   whole movie lives HERE ONLY: the play-through and once-scheduled sound
   from CL-0076, the card of the scene currently showing highlighted as
   it runs, play starting from the scrub position (or the selected card's
   start after a click on it), stopping at the end of the last scene.
   Keys: Delete removes the selected scene (refused for the last one),
   Ctrl+Z/Y as everywhere, Escape closes the Transition panel. Every
   scene edit goes through the existing edits — one undo step each.

3. Card pictures and the poster moment (decision c). A card shows the
   scene ALONE — rendered through the real sceneStage (never projectStage:
   transitions are never in the picture) at its poster moment, which is
   the first frame unless the scene carries the new OPTIONAL field
   posterSeconds. Pictures are rendered at card size, kept in memory for
   the session and redrawn when the scene changes; nothing is written to
   cache/ (Phase 6 decision k). Older project.json files load unchanged;
   validate.ts refuses a nonsense posterSeconds in plain language; a new
   edit setScenePoster (frame-snapped, clamped inside the scene) through
   the one-undo-step path; DOC-03 §3 updated in the same commit. In the
   Scene editor's toolbar a "Use this frame for the card" button sets it
   from the playhead.

4. The Scene editor (decision d). Today's editor with the strip removed
   from the timeline dock (the dock's heights go back to what CL-0064 set,
   the divider unchanged) and the Transition panel gone from it. Its
   header carries the neighbour hint "← Scene 1 · [Scene 2] · Scene 3 →";
   clicking an arrow jumps to that neighbour with the same reset as
   selecting a card (playhead 0, layer/clip selection cleared, camera mode
   ended). Play stops at the scene's end again — no play-through, no
   scene switching in this screen; previewPlayer schedules this scene
   only, as before Phase 7. The amber transition windows stay on the ruler
   (they say which seconds will be blended). Canvas, panels, timeline,
   Duration, every Add-to-scene / Add-to-timeline target: as they are,
   addressing the scene the editor holds.

5. Export (decision g): unchanged — the dev export button stays where it
   is; the real export screen (Phase 9) will live in the Movie editor.

6. Checks (ADR-015, decision i): posterSeconds validation and the
   setScenePoster edit round-trip save/reopen and undo; older files load
   unchanged; the 23 snapshots stay untouched (sceneStage and projectStage
   do not change); the export check unchanged. Live-verify each screen in
   the running app with scripted assertions and screenshots as the Phase
   7 sessions did: the Movie tab on open with cards, pictures, arrows and
   the total; + Scene / Duplicate / ◀ ▶ / ✕ / rename each one Ctrl+Z; the
   Transition panel from an arrow; play in the Movie editor flowing
   across a boundary with the highlighted card following and the sound
   scheduled once; double-click opening the Scene editor on that scene;
   the neighbour arrows; play stopping at the scene's end there; "Use
   this frame for the card" changing the card; reopen with everything
   kept. Keep `npm run check` inside two minutes and report its time.

7. Manual (decision h): M-1.3's tour rewritten around the two screens
   (Movie first, then Scene); M-6.1–M-6.3 retold for the Movie editor and
   the neighbour arrows; the poster-frame button documented. DOC-10 §1,
   §2 (Phase 7 row: Usable, 7b built, try-out in §5), §3 and §5 updated in
   the same commits.

Two commits after the verification commit: (1) the Movie editor with the
tabs, the cards and pictures, the poster field and edit, play-through
moved there; (2) the Scene editor cleanup, the neighbour hint, the
"Use this frame" button, the manual, and the closing sweep that runs
Alek's exact try-out scripted. Commit and push each with its CL entry and
tracker update in the same commit.

Do not write code yet (after the verification commit). First produce a
short plan for my approval: the exact layout of the Movie editor (what
sits where, sizes), how the two screens share App.tsx state (which scene
each holds, what the tab switch resets), how the card pictures are
rendered and cached in memory and when they are redrawn, how the play
loop and previewPlayer split between "whole movie" (Movie editor) and
"this scene only" (Scene editor) without duplicating either, what moves
out of Timeline.tsx and SceneStrip.tsx, the decisions you are making
within a–k, and any questions for me. Decisions a–k are made; do not
re-ask them.

Out of scope for Phase 7b (decision k): drag-and-drop reorder of cards;
card pictures on disk; a project-wide timeline; the export screen (9);
text (8); anything in the document, the edits, projectTime, projectStage
or export beyond the one poster field. No paid AI calls (DOC-09). No new
npm dependencies without a DOC-08 row first. Every check cleans up
tests/output/ on success. Update docs/04-CHANGELOG.md,
docs/10-PROJECT-TRACKER.md, docs/03-ARCHITECTURE.md (§3 for the poster
field) and docs/05-MANUAL.md in the same commit as the code, and end with
the report described in CLAUDE.md — what changed, which checks pass,
exactly what I should open and try (the Movie tab: add a scene, put a
background in it via Edit scene, come back, set a crossfade between the
cards, press play and watch it flow across; the neighbour arrows in the
Scene editor; reorder, duplicate, delete, rename, reopen), and what is
next. This kickoff prompt is already archived as docs/11-WORKFLOW.md
Appendix I (CL-0078); do not add it again.
```

### Appendix I addendum — Alek's Phase 7b decisions (given with the kickoff; apply, do not re-ask)

a. Two masthead tabs, Movie and Scene (the Scene tab names the scene it
   holds). Opening a project lands on Movie with its first card selected
   and a clear Edit scene button. Which screen shows is UI state.
b. The Movie editor: a preview canvas of the whole video (through
   projectStage) on top; under it play/pause, a whole-movie scrub bar
   with scene boundaries, readout and total; below, the row of cards in
   play order (picture, name, length) with the transition drawn as an
   arrow between cards; click selects, the selected card carries Edit
   scene, Duplicate, ◀ ▶, ✕ (greyed for the last scene) and
   click-to-rename; + Scene at the end; an arrow (or the card's
   Transition button) opens the Transition panel on the right side;
   double-click / Enter / Edit scene opens the scene in the Scene editor.
c. Cards show the scene ALONE at its poster moment — the first frame
   unless the new optional posterSeconds says otherwise — rendered by the
   same sceneStage as the canvas, transitions never in the picture, kept
   in memory for the session, redrawn when the scene changes, nothing on
   disk. "Use this frame for the card" in the Scene editor's toolbar sets
   the poster from the playhead, one undo step. DOC-03 §3 updated.
d. The Scene editor is today's editor without the strip and without the
   Transition panel, with a neighbour hint "← Scene 1 · [Scene 2] ·
   Scene 3 →" whose arrows jump to a neighbour (same reset as selecting a
   card). Play stops at the scene's end; the amber transition windows
   stay on the ruler.
e. Playing the whole movie (play-through, sound scheduled once) lives in
   the Movie editor only; the current scene's card highlights as it runs;
   play starts from the scrub position or the selected card's start.
f. Movie editor keys: Delete removes the selected scene (refused for the
   last), Ctrl+Z/Y, Enter opens the selected scene, Escape closes the
   Transition panel.
g. Export unchanged for now; the Phase 9 export screen will live in the
   Movie editor.
h. Manual: M-1.3 rewritten around the two screens; M-6.1–M-6.3 retold;
   the poster-frame button documented.
i. Checks: poster field validation and edit round-trips; the 23 snapshots
   and the export check untouched; every screen live-verified; the closing
   sweep runs Alek's exact try-out.
j. Model: Fable, one session, two commits (Movie editor; then Scene editor
   cleanup and manual).
k. Out of scope: drag-and-drop reorder; card pictures on disk; a
   project-wide timeline; the export screen (9); text (8); any change to
   the document, edits, projectTime, projectStage or export beyond the
   poster field.
