# DOC-10 — Project Tracker

**Status:** Active
**Last updated:** 2026-09-02 (Phase 1 usable)
**Purpose:** The one page to read when returning to the project. Where we are, what is done, what is next, and what is waiting on Alek. Updated with every change-log entry (DOC-04).

---

## 1. Where we are right now

**Phase 1 — Scaffold: USABLE.** The app opens to the Home screen on Windows; projects can be created, saved, and reopened; the document format, undo/redo engine, provider fakes, and five automated checks exist and pass. Still open within Phase 1 scope: autosave, and wiring undo/redo into the UI (both arrive naturally with the editor phases). ADR-006 is Accepted; DOC-03 is Active.
**Verified by Alek (CL-0017):** all Phase 1 manual tests passed.
**Phase 2 — Export prototype: built, check green (CL-0018).** The ten-second test project exports to a correct .mp4 through Windows' own encoders (hardware H.264 answered on the dev laptop); the Export check runs in npm run check. Measurement report and the OQ-019 decision are the remaining Phase 2 steps.
**Next action:** finish Phase 2: run the measurement session, write docs/12, decide OQ-019.
**Watch out:** OQ-020 — Windows Smart App Control blocks unsigned native Node modules on the dev laptop; check onnxruntime-node before Phase 3 work begins.

## 2. Build order and phase status

Phases run in this order; a phase does not start until the previous one is usable. Status: `Not started` · `In progress` · `Usable` (works, checks pass) · `Complete` (manual written, DOC-04 entry made).

| # | Phase | What "complete" means | Status | Model |
|---|-------|-----------------------|--------|-------|
| 0 | **Foundation** | Docs 00–10 written; every pre-build decision recorded as an ADR | **Complete** | Fable |
| 1 | **Scaffold** | Empty Electron/TypeScript/React app opens to the Home screen on Windows; project document format defined; undo/redo; check suite running (save/reopen, undo, license, network, AI-spend guard) | **Usable** | Fable |
| 2 | **Export prototype** (OQ-019) | Ten-second test project exports to .mp4 using Windows' built-in encoders with correct duration, resolution, audio sync | In progress (export + check done; measurement and decision pending) | Fable |
| 3 | **Assets and cutouts** | Import images/audio; BiRefNet_lite auto-cutout; HD cutout; mask editor; HEIC handling | Not started | Fable → Opus |
| 4 | **Scene and layers** | Background, character/prop layers, ordering, opacity, lock/hide, placing and sizing on canvas | Not started | Opus |
| 5 | **Animation** | Keyframes (position, scale, rotation, flip, opacity), easing, motion presets, pose swapping, camera pan/zoom, render snapshot checks | Not started | Fable for keyframe engine → Opus |
| 6 | **Timeline and audio** | Multi-track timeline, scrub/snap/zoom, audio clips (volume, fade, trim), imported sounds | Not started | Opus |
| 7 | **Scenes and transitions** | Multiple scenes, reorder, seven transition types | Not started | Opus |
| 8 | **Text and captions** | Titles/captions, OFL fonts, fade/pop animation | Not started | Opus |
| 9 | **Real export** | Platform presets, 720p/1080p, 30/60 fps, optional "AI-generated" label, progress and reveal-in-folder | Not started | Opus |
| 10 | **Company server** | Accounts, subscription via merchant of record, usage caps, `/tts` and `/agent` proxies, hosting chosen (OQ-011, OQ-018) | Not started | Fable |
| 11 | **Voices** | OpenAI TTS through server, voice picker with AI disclosure, delivery notes, caching, talking indicator (OQ-009) | Not started | Opus |
| 12 | **Agent** | Output schema (OQ-012), scene summary (OQ-013), proposal review UI, caching | Not started | Fable |
| 13 | **Sound library** | Curated CC0 starter set, categories, search, `SOURCES.csv` (OQ-004) | Not started | Opus / Alek curates |
| 14 | **Manual and polish** | DOC-05 fully written, About → Licenses screen, keyboard shortcuts, troubleshooting | Not started | Opus |
| 15 | **Legal and launch** | ToS, privacy policy, acceptable-use text (OQ-014); product name (OQ-005); pricing and caps (OQ-008); installer signed; v1.0 released | Not started | Fable drafts, Alek approves |

## 3. Feature checklist (from DOC-01 §5.1)

Every v1.0 feature, its phase, and its state. `☐` not built · `◐` built, checks pass · `☑` complete with manual section.

| Feature | Phase | State | Manual |
|---------|-------|-------|--------|
| Sign up / sign in / subscription / acceptable-use agreement | 10 | ☐ | M-1.1b |
| Create/open/save project, autosave, project folder | 1 | ◐ (autosave pending) | M-1.2, M-9.3 |
| Format choice (9:16, 16:9, 1:1) and save location | 1 | ☑ | M-1.2 |
| Undo / redo | 1 | ◐ (engine + checks; UI wiring comes with the editor) | M-1.3 |
| Image import (JPG, PNG, WebP; HEIC via Windows) | 3 | ☐ | M-2.2, M-9.2 |
| Audio import (MP3, WAV, M4A, OGG) | 3 | ☐ | M-2.6 |
| Automatic cutout (BiRefNet_lite) | 3 | ☐ | M-2.3 |
| HD cutout (BiRefNet full) | 3 | ☐ | M-2.4b |
| Mask editor (brush add/erase, feather) | 3 | ☐ | M-2.4 |
| Characters with multiple poses | 3 | ☐ | M-2.5 |
| Layers: order, opacity, lock, hide | 4 | ☐ | M-3.2 |
| Place and size on canvas | 4 | ☐ | M-3.3 |
| Keyframes: position, scale, rotation, flip, opacity | 5 | ☐ | M-4.1, M-4.2 |
| Easing presets | 5 | ☐ | M-4.3 |
| Motion presets: bob, walk, shake, pop | 5 | ☐ | M-4.4 |
| Pose swapping on timeline | 5 | ☐ | M-4.5 |
| Camera pan and zoom | 5 | ☐ | M-4.6 |
| Multi-track timeline, scrub, snap, zoom | 6 | ☐ | M-1.3 |
| Audio clips: volume, fade, trim | 6 | ☐ | M-5.5 |
| Multiple scenes, reorder, duration | 7 | ☐ | M-6.1, M-6.3 |
| Transitions: cut, crossfade, slide ×4, zoom in/out, wipe | 7 | ☐ | M-6.2 |
| Titles and captions with animation | 8 | ☐ | M-7.1, M-7.2 |
| Export presets, resolution, frame rate | 9 | ☐ | M-8.1, M-8.2 |
| Optional "AI-generated" label | 9 | ☐ | M-8.1, M-9.6 |
| Voices: picker with AI disclosure, per-character voice | 11 | ☐ | M-5.1 |
| Dialogue lines and delivery notes | 11 | ☐ | M-5.2, M-5.2b |
| Talking indicator | 11 | ☐ | M-5.3 |
| Usage meter | 11 | ☐ | M-7b.4 |
| Agent: instruction → proposal → accept/adjust/discard | 12 | ☐ | M-7b.1–M-7b.3 |
| Sound library: browse, search, categories | 13 | ☐ | M-5.4 |
| About → Licenses screen | 14 | ☐ | M-9.5 |
| Keyboard shortcuts, troubleshooting | 14 | ☐ | M-9.1, M-9.4 |

## 4. Check suite status (ADR-015)

| Check | Exists | Passing |
|-------|--------|---------|
| Save / reopen | ☑ | ✅ |
| Undo | ☑ | ✅ |
| Render snapshots | ☐ (Phase 2+) | — |
| Export | ☑ | ✅ |
| No unexpected network | ☑ | ✅ |
| License allow-list | ☑ | ✅ |
| AI-spend guard | ☑ | ✅ |

Run everything with one command: `npm run check` (49 tests + licenses + the export check; about 25 seconds in total).

## 5. Waiting on Alek

| Item | Needed by | Ref |
|------|-----------|-----|
| Open the app (`npm run dev`) and try creating/reopening a project | Now | DOC-05 M-1.2 |
| Create an OpenAI account, generate a key, set a small monthly hard cap, keep the key private | Phase 11 (not before) | DOC-09 §5 |
| Choose merchant of record after Claude's comparison | Phase 10 | OQ-018 |
| Choose server host after Claude's proposal | Phase 10 | OQ-011 |
| Decide price, trial, and monthly caps | Phase 10 | OQ-008 |
| Pick the talking indicator style from a visual test | Phase 11 | OQ-009 |
| Curate / approve the sound library | Phase 13 | OQ-004 |
| Choose a product name and check it is not already taken | Phase 15 | OQ-005 |
| Approve ToS, privacy policy, acceptable-use text | Phase 15 | OQ-014 |

## 6. Decisions log at a glance

ADR-001 cut-out motion · ADR-002 desktop, web tech · ADR-005 company server holds keys · ADR-006 stack · ADR-007 docs structure · ADR-008 connected v1 with server, accounts, TTS, agent · ADR-009 BiRefNet two sizes · ADR-010 OpenAI TTS · ADR-011 OpenAI agent model · ADR-012 Windows only · ADR-013 OS encoders, no FFmpeg · ADR-014 merchant of record · ADR-015 check suite · ADR-016 AI spend discipline. (ADR-003 and ADR-004 superseded.) Full text in DOC-02.

## 7. How to read progress

- **§1** tells you where we are in one line.
- **§2** shows the phase we are in and what "done" means for it.
- **§3** is the full feature list; a feature is not done until it shows ☑.
- **§5** is your to-do list. If it is empty, nothing is waiting on you.
- If anything here disagrees with DOC-04 (the change log), DOC-04 is right and this page needs updating.
