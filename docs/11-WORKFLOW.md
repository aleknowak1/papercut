# DOC-11 — Development Workflow

**Status:** Active
**Last updated:** 2026-09-02 (Appendix D: Phase 3 kickoff prompt; check-output cleanup rule in Appendix A)
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
