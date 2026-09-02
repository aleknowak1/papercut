# DOC-11 — Development Workflow

**Status:** Active
**Last updated:** 2026-09-02 (Appendix C: Phase 2 kickoff prompt)
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
