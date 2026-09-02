# PAPERCUT — standing orders for Claude Code

You are building PAPERCUT, a paid Windows desktop app that turns a user's own
photos into cut-out-animated comedy videos. Alek, the owner, is not a programmer.
Everything you do must be explainable to him in plain language.

## Repository
- Local folder: C:\Users\Alek\Documents\Claude Code Projects\papercut
- GitHub remote (origin): https://github.com/aleknowak1/papercut.git
- Alek's laptop is already authenticated with GitHub; git push works without prompts.

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
