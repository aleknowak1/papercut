# DOC-10 — Project Tracker

**Status:** Active
**Last updated:** 2026-09-02 (Gate round 2 measured — CL-0026; fp32 CPU ≈33 s/photo, DirectML out-of-memory on 8 GB; final path choice with Alek)
**Purpose:** The one page to read when returning to the project. Where we are, what is done, what is next, and what is waiting on Alek. Updated with every change-log entry (DOC-04).

---

## 1. Where we are right now

**Phase 1 — Scaffold: USABLE.** The app opens to the Home screen on Windows; projects can be created, saved, and reopened; the document format, undo/redo engine, provider fakes, and five automated checks exist and pass. Still open within Phase 1 scope: autosave, and wiring undo/redo into the UI (both arrive naturally with the editor phases). ADR-006 is Accepted; DOC-03 is Active.
**Verified by Alek (CL-0017):** all Phase 1 manual tests passed.
**Phase 2 — Export prototype: USABLE, decision made (CL-0018/CL-0019).** ADR-013 is proven on real hardware: the ten-second test project exports to a correct .mp4 through Windows' own encoders, 60 s of 1080p30 extrapolates to ≈ 43 s even without a GPU (target: under 3 minutes), audio drift ≤ 9.6 ms. OQ-019 closed, ADR-013 now plainly Accepted, mp4-muxer locked (MIT). Full numbers in DOC-12. Windows 10 remains untested (no machine).
**Phase 3 — Assets and cutouts: IN PROGRESS, gate STOPPED (CL-0025).** The OQ-020 gate ran per the approved plan. Good news: Smart App Control does **not** block onnxruntime-node — everything it ships is Microsoft-signed; it loads and runs in plain Node and in an Electron utility process with a clean event log. Bad news: the fp16 model runs at ≈27.7 minutes per photo on CPU (target: under 3 seconds) because ONNX Runtime's CPU engine has no native fp16 support. Per the plan, work STOPPED before any cutout feature was built.
**Gate round 2 (CL-0026):** measured at Alek's direction. fp32 on CPU works — 33–38 s per photo, mask quality identical to fp16 — but no CPU path reaches the 3 s reference target (reference-machine estimate ≈12–25 s). DirectML compiles but runs out of memory on this 8 GB machine (our minimum spec): accelerator at best, never the baseline. Two binding pipeline rules recorded in DOC-13 §9.5 (native-1024 inference; 4096-long-edge working-copy cap, originals untouched). Paths 4 (WASM) and 5 (lighter model) ruled out by Alek.
**Next action:** Alek reads DOC-13 §9 and decides: which model format ships (fp32 simplest at ≈33 s here; int8 faster but adds an offline Python conversion step; DirectML as an optional accelerator on capable machines), and what per-photo time is acceptable on minimum-spec machines (recorded in DOC-07). Then Phase 3 resumes at plan step 2.
**Start-up reliability (CL-0021/CL-0022):** the blank-window cause is found and fixed (the dev server answered only on IPv6 while the window sometimes asked on IPv4; it now binds one concrete address). The app also waits for its screen server, retries failed loads, shows plain-text errors instead of ever staying blank, and writes every start-up step to logs/startup.log in the user-data folder — if a start ever misbehaves again, send that file.
**Rule of thumb after any code update (CL-0020):** close the running app and start it again with `npm run dev` — an app window left running from before an update cannot load the new code and shows a plain-language message saying so.
**Watch out:** the dev laptop's CPU (Intel Core i3-N305, 8 efficiency cores) is below the "2020-era laptop CPU" reference in DOC-03 §5; performance numbers measured here are pessimistic but real for budget customer machines.

## 2. Build order and phase status

Phases run in this order; a phase does not start until the previous one is usable. Status: `Not started` · `In progress` · `Usable` (works, checks pass) · `Complete` (manual written, DOC-04 entry made).

| # | Phase | What "complete" means | Status | Model |
|---|-------|-----------------------|--------|-------|
| 0 | **Foundation** | Docs 00–10 written; every pre-build decision recorded as an ADR | **Complete** | Fable |
| 1 | **Scaffold** | Empty Electron/TypeScript/React app opens to the Home screen on Windows; project document format defined; undo/redo; check suite running (save/reopen, undo, license, network, AI-spend guard) | **Usable** | Fable |
| 2 | **Export prototype** (OQ-019) | Ten-second test project exports to .mp4 using Windows' built-in encoders with correct duration, resolution, audio sync | **Usable** (checks green, DOC-12 written, OQ-019 closed; Complete once Alek has watched the export) | Fable |
| 3 | **Assets and cutouts** | Import images/audio; BiRefNet_lite auto-cutout; HD cutout; mask editor; HEIC handling | **In progress** (OQ-020 gate: security passed, STOPPED on performance — DOC-13; path decision with Alek) | Fable → Opus |
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
| Read DOC-13 §9 (round-2 numbers) and decide: model format for cutouts (fp32 / int8 / + DirectML acceleration) and the acceptable per-photo time on minimum-spec machines. This unblocks Phase 3 step 2. | Now (unblocks Phase 3) | OQ-020, DOC-13 §9 |
| Watch and listen to the exported test video: open the app (`npm run dev`), open or create a project, click "Load test content (dev)" then "Export prototype (dev)", and play export-dev.mp4 from the project folder. The square should move smoothly, the counter should tick, and each beep should land exactly on its white flash. | Now (closes Phase 2) | DOC-12 §3 |
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
