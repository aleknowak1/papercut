# DOC-10 — Project Tracker

**Status:** Active
**Last updated:** 2026-09-04 (Phase 6 step 7 done, CL-0061: the Web Audio preview on play; next: M-1.3, M-5.5 and the final sweep)
**Purpose:** The one page to read when returning to the project. Where we are, what is done, what is next, and what is waiting on Alek. Updated with every change-log entry (DOC-04).

---

## 1. Where we are right now

**Phase 1 — Scaffold: USABLE.** The app opens to the Home screen on Windows; projects can be created, saved, and reopened; the document format, undo/redo engine, provider fakes, and five automated checks exist and pass. Still open within Phase 1 scope: autosave, and wiring undo/redo into the UI (both arrive naturally with the editor phases). ADR-006 is Accepted; DOC-03 is Active.
**Verified by Alek (CL-0017):** all Phase 1 manual tests passed.
**Phase 2 — Export prototype: COMPLETE (CL-0059).** ADR-013 is proven on real hardware: the ten-second test project exports to a correct .mp4 through Windows' own encoders, 60 s of 1080p30 extrapolates to ≈ 43 s even without a GPU (target: under 3 minutes), audio drift ≤ 9.6 ms. OQ-019 closed, ADR-013 plainly Accepted, mp4-muxer locked (MIT). Full numbers in DOC-12. The last open item closed on 2026-09-04: Alek watched and listened to the (now seven-beep) export-dev.mp4 — each beep on its white flash. Windows 10 remains untested (no machine).
**Phase 3 — Assets and cutouts: IN PROGRESS.** The OQ-020 gate is closed (ADR-017): Smart App Control never objected (onnxruntime-node is Microsoft-signed throughout), and Alek chose fp32-on-CPU with revised targets (< 15 s reference machine, ≤ 45 s minimum-spec, always a background queue). Full evidence trail in DOC-13. Step 2 is built and green (CL-0027): the segmentation worker runs BiRefNet fp32 in an Electron utility process with a one-at-a-time job queue, status updates, cancellation, and the original-pixels+alpha output rule enforced byte-for-byte by a check; memory arena off (measured faster and frees ~everything between jobs); worker process ends when the queue goes idle. Measured on this laptop: lite ≈32–37 s/photo, HD ≈54 s, model load ≈5–8 s.
**Phase 3 — Assets and cutouts: COMPLETE (CL-0033).** Everything in the phase is built, checked, live-verified and in the manual: image import (JPG/PNG/WebP + HEIC via Windows' decoder) with the Assets panel; automatic cutouts in a background queue (one at a time, cancellable, ≈half a minute per photo on this laptop); characters with poses; the mask editor (brush add/erase, feather, zoom/pan, local stroke undo, versioned saves that document-undo repoints between, Reset to automatic, HD cutout); audio import (MP3/WAV/M4A/OGG) with durations and Play. Undo/redo and auto-save are wired through everything. Alek verified the foundations by hand (CL-0030); his remaining spot-checks are in §5.
**Phase 4 — Scene and layers: COMPLETE (CL-0043).** Everything in the phase is built, checked, in the manual (M-3.1–M-3.3), and verified by Alek by hand on 2026-09-03: background cover/stretch, every road into the scene (row buttons and drag-and-drop), moving and resizing with one-undo-step drags and Escape-cancel, order/hide/lock/opacity/flip, save and reopen. The scene canvas and export render through the one shared sceneStage (CL-0038), so what the user sees is what exports — the foundation Phase 5 animates.
**Phase 5 — Animation: COMPLETE (CL-0052; verified by Alek, CL-0048 and CL-0054).** Everything in the phase is built, checked, live-verified in the running app, and in the manual (M-4.1–M-4.6): the animation engine, the time strip and keyframe authoring, motion presets (Bob/Walk/Shake/Pop baked as ordinary keyframes, one undo step), pose swapping, the camera (engine + pan/zoom authoring UI), the on-canvas rotate handle, and the 14-moment render-snapshot check. The DOC-11 §6 reviewer agent audited app/shared/animation and sceneStage against DOC-02/DOC-03: no binding decision broken; its edge findings (easing and keyframe-order validation, the last-keyframe rule living in the edit layer, a duplicated frame conversion, a wheel-zoom Escape gap) are fixed in CL-0052. Built from the kickoff prompt in DOC-11 Appendix F (CL-0042): Fable for the foundations, Opus for the feature work, decisions a–k made; plan approved by Alek with two additions (a 9:16 snapshot moment; the non-frame-aligned older-file test). Step 1 done (CL-0044): the animation engine — app/shared/animation/ (frame-exact time, the four easing curves, eased interpolation, keyframeAtPlayhead, deterministic presets, the clamped camera), applyKeyframes and camera-keyframe edits, 48 new arithmetic tests, everything green. Nothing user-visible yet.
Step 2 done (CL-0045): the camera lives inside sceneStage (export gets it for free), picking/drags/drops map through it, and every editing path writes the keyframe at the playhead. Step 3 done (CL-0046): **animation is usable** — the time strip (play/scrub/step/jump, Duration 1–120 s, keyframe ticks) and the inspector (X/Y/Size/Turn, Easing, Pose, Delete keyframe); keyframes appear automatically at the playhead; live-verified with 26 scripted assertions in the real app; M-4.1–M-4.3 written. Step 4 done (CL-0047): the render-snapshot check — 14 moments (one portrait) through the real sceneStage in the export check's hidden window, first references committed under tests/snapshots/ for Alek to look at, fail-until-approved proven live, `npm run snapshots:approve`. **The Fable foundations are complete.**
**Verified by Alek (CL-0048, on 2026-09-03):** the time strip (scrub, play with Space, frame stepping, Duration), a layer moving between two keyframes, the Easing dropdown, Ctrl+Z back through it all, and the 14 snapshot references in tests/snapshots/. All worked.
**Verified by Alek (CL-0054, on 2026-09-04):** the feature half of Phase 5 — the four motion presets applied and undone (Walk's destination clicked on the canvas), camera mode with wheel zoom and drag pan at two playhead positions gliding between them on play, and the rotate handle with Escape mid-swing writing nothing. All worked. Phase 5 stands verified end to end.
**Phase 6 — Timeline and audio: IN PROGRESS (plan approved by Alek 2026-09-04).** Fable foundations under way. Step 1 done (CL-0055): AudioClip's optional trim fields (older files load unchanged), plain-language validation for them, and the new one-undo-step edits — moveAudioClip, trimAudioClip (clamped inside the sound's real extent), volume and fades (never longer than the clip together), and moveKeyframe/moveCameraKeyframe with the occupied-frame refusal (decision c) living in the edits themselves. 18 new tests. Nothing user-visible yet.
Step 2 done (CL-0056): the pure timeline module, app/shared/timeline/ — time↔pixel mapping with the zoom bounds and follow-the-playhead paging, the snap function that names what it snapped to, deterministic lane packing, and previewSchedule (scene + start time + real sound lengths → each audible clip's delay, source offset, played length and gain envelope), the one translation both the Web Audio preview and the export mixer will consume. 27 new tests. Step 3 done (CL-0057): export decodes every clip through Chromium's decoder at 48 kHz mono (MP3/M4A/OGG and any sample rate now export; parseWav stays for fixtures), the mixer renders previewSchedule's entries sample-for-sample, and the export check proves the whole path end to end with a trimmed WAV clip (a hidden second beep would expose an ignored trim) and a check-time-generated M4A clip — seven beeps on seven flashes. OQ-024 (stereo) opened for Phase 9. **The Phase 6 Fable foundations are complete.**
**Verified by Alek (CL-0058, on 2026-09-04):** the Phase 6 Fable foundations — `npm run check` green on his own run (255 tests, all seven beeps within the drift limit, tests/output/ empty afterwards), the dev export played with seven beeps each landing on its white flash (the two trimmed clips included), and an older project opened unchanged with the time strip playing, scrubbing and stepping as before. All worked. The timeline UI half of Phase 6 begins.
Step 4 done (CL-0059): **the timeline panel replaces the time strip** (app/renderer/src/timeline/Timeline.tsx, React/SVG; TimeStrip.tsx deleted; sceneStage untouched, snapshots unchanged). The strip's whole transport moved into the header (play/Space, frame steps, « », readout, Duration) plus the Snap toggle and zoom slider; ruler with draggable playhead; a Camera row and one row per layer, front-most on top, keyframes as draggable diamonds — click selects and lands the playhead, drag moves the keyframe in time (one undo step, Escape cancels, occupied frames refused, the ghost stopping beside). Zoom Ctrl+wheel/slider from whole-scene to 200 px/s, wheel scroll, the view paging along during play; rows past seven scroll vertically, memoised per layer. Live-verified with 33 scripted assertions in the real app — including scrubbing at 60 fps with 21 keyframed rows on the dev laptop (DOC-03 §5 shown, not assumed).
Steps 5–6 done (CL-0060): **sounds onto the timeline, and clip editing.** One shared road on (addToTimeline.ts, the Phase 4b pattern): "Add to timeline" on every ♪ row lands the clip at the playhead, dragging the row onto the lanes lands it at the drop time. Clips draw with the sound's name and a waveform from session-decoded peaks (decoded once per session, nothing written to disk — decision k); overlaps pack into lanes (decision g); past the scene end the block is hatched. Editing per decision h: body drag moves, edge drags trim (the left edge keeps the sound anchored in time), corner handles set the fades, and the right panel becomes the Sound clip panel (Start/Volume/Fades/Play/Delete) — every gesture and field one undo step, Escape cancels. Live-verified with 25 scripted assertions. 8 new tests (263).
Step 7 done (CL-0061): **the preview has sound.** On play, previewSchedule's entries are scheduled through Web Audio (one source + gain per clip: trim as the source offset, volume and fades as the gain envelope) from the playhead — the same translation of the document the export mixer renders and the same session decode cache the waveforms use, so what plays is what exports by construction. Pause, the scene end, and any edit silence it at once; scrubbing is silent. Live-verified with 5 scripted assertions; the ear test is Alek's.
**Next action (the timeline UI session, under way):** the timeline panel (CL-0059), the audio lanes with clip editing (CL-0060) and the Web Audio preview (CL-0061) are in. Last in this session: M-1.3 (the full interface tour) and M-5.5's clip controls, the tracker rows, and the final live sweep — then Alek's hands-on verification closes the phase.

### 1b. Hand-off notes (now historical — the work below was completed by Fable in CL-0031..33, built to these decisions)

- **Characters with poses (M-2.5):** document operations only (`characters[]`, DOC-03 §3) plus Assets-panel UI — create character, add pose from an existing cutout asset, rename/reorder/delete poses; every operation one undo step through the existing `applyEdit` path in App.tsx; check: add/rename/reorder/delete round-trip save/reopen and undo (extend edits.ts with the missing pose functions).
- **Mask editor (M-2.4/M-2.4b):** draw on a plain **2D canvas** (not PixiJS — per-pixel brush work, trivially checkable; PixiJS stays reserved for the scene renderer). Brush add/erase with size control, edge feather, zoom/pan, keyboard-friendly. **Undo model:** brush strokes undo locally inside the editor (its own small stack); **Save writes a NEW cutout file** (`assets/cutouts/<id>-v2.png`, v3, …) composed as original working-copy pixels + edited alpha (use the main-process PNG writer, `app/main/segmentation/png.ts` — never a canvas PNG export, which premultiplies), plus **one document edit** repointing the asset — so document-level undo/redo just repoints files, which still exist. "Reset to automatic" repoints at the original automatic cutout. "HD cutout" enqueues the existing queue with model `'hd'` (`enqueueCutout(..., 'hd', ...)`) and replaces the automatic mask on completion; keep the plain warning that it can take a while on a small laptop (≈54 s measured here). Old versions are kept — tidying is OQ-021, not this phase. Checks: a known brush stroke and known feather on a known mask give expected pixels; reset restores the automatic mask; the repointing undo works.
- **Audio import (M-2.6):** mirror the image path — MP3/WAV/M4A/OGG by button and drag-and-drop, copied unchanged to `assets/audio/`, asset record via the same undo-able edit, duration read by decoding with Chromium (`decodeAudioData` in the renderer), shown in the Assets panel with a play button (CSP already allows `media-src blob:`). Check fixtures generated in code: WAV (tests/fixtures from Phase 2) and M4A (WebCodecs AAC + mp4-muxer, as in the export pipeline); MP3 and OGG cannot be generated — Alek verifies those with real files; the check still covers refusal paths and duration logic.
- **House rules that keep applying:** every check cleans tests/output on success; time is reported, not judged; no new npm dependencies without a DOC-08 row first; segmentation stays one-job-at-a-time through `segmentationService`; nothing on any canvas/scene yet (Phase 4).
**Start-up reliability (CL-0021/CL-0022):** the blank-window cause is found and fixed (the dev server answered only on IPv6 while the window sometimes asked on IPv4; it now binds one concrete address). The app also waits for its screen server, retries failed loads, shows plain-text errors instead of ever staying blank, and writes every start-up step to logs/startup.log in the user-data folder — if a start ever misbehaves again, send that file.
**Rule of thumb after any code update (CL-0020):** close the running app and start it again with `npm run dev` — an app window left running from before an update cannot load the new code and shows a plain-language message saying so.
**Watch out:** the dev laptop's CPU (Intel Core i3-N305, 8 efficiency cores) is below the "2020-era laptop CPU" reference in DOC-03 §5; performance numbers measured here are pessimistic but real for budget customer machines.

## 2. Build order and phase status

Phases run in this order; a phase does not start until the previous one is usable. Status: `Not started` · `In progress` · `Usable` (works, checks pass) · `Complete` (manual written, DOC-04 entry made).

| # | Phase | What "complete" means | Status | Model |
|---|-------|-----------------------|--------|-------|
| 0 | **Foundation** | Docs 00–10 written; every pre-build decision recorded as an ADR | **Complete** | Fable |
| 1 | **Scaffold** | Empty Electron/TypeScript/React app opens to the Home screen on Windows; project document format defined; undo/redo; check suite running (save/reopen, undo, license, network, AI-spend guard) | **Usable** | Fable |
| 2 | **Export prototype** (OQ-019) | Ten-second test project exports to .mp4 using Windows' built-in encoders with correct duration, resolution, audio sync | **Complete** (CL-0059: Alek watched and listened to the export on 2026-09-04) | Fable |
| 3 | **Assets and cutouts** | Import images/audio; BiRefNet_lite auto-cutout; HD cutout; mask editor; HEIC handling | **Complete** (CL-0033: every feature ☑, all M-2 manual sections written; Alek's spot-checks in §5 — mask editor on a real photo, HEIC, real MP3/OGG) | Fable (Alek's choice, CL-0030) |
| 4 | **Scene and layers** | Background, character/prop layers, ordering, opacity, lock/hide, placing and sizing on canvas | **Complete** (CL-0037–0041; verified by Alek by hand, CL-0043) | Fable |
| 5 | **Animation** | Keyframes (position, scale, rotation, flip, opacity), easing, motion presets, pose swapping, camera pan/zoom, render snapshot checks | **Complete** (CL-0044–0052; reviewer audit run; verified by Alek, CL-0048 and CL-0054) | Fable throughout (Alek's choice, as Phases 3–4) |
| 6 | **Timeline and audio** | Multi-track timeline, scrub/snap/zoom, audio clips (volume, fade, trim), imported sounds | **In progress** (CL-0055–0057: Fable foundations complete — document edits, shared/timeline, decoder + trim-aware mixer, extended export check; timeline UI next, on Opus) | Fable foundations → Opus UI (decision l) |
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
| Undo / redo | 1 | ◐ (engine, checks, UI buttons and Ctrl+Z/Ctrl+Y; M-1.3 tour pending) | M-1.3 |
| Image import (JPG, PNG, WebP; HEIC via Windows) | 3 | ☑ (CL-0028/29; HEIC works-path verified by Alek with a real iPhone photo, §5) | M-2.2, M-9.2 |
| Audio import (MP3, WAV, M4A, OGG) | 3 | ☑ (CL-0033; MP3/OGG spot-checked by Alek with real files, §5) | M-2.6 |
| Automatic cutout (BiRefNet_lite) | 3 | ☑ (CL-0028) | M-2.3 |
| HD cutout (BiRefNet full) | 3 | ☑ (CL-0032) | M-2.4b |
| Mask editor (brush add/erase, feather) | 3 | ☑ (CL-0032) | M-2.4 |
| Characters with multiple poses | 3 | ☑ (CL-0031) | M-2.5 |
| Layers: order, opacity, lock, hide | 4 | ☑ (CL-0039; verified by Alek, CL-0043) | M-3.2 |
| Place and size on canvas | 4 | ☑ (CL-0040; verified by Alek, CL-0043) | M-3.3 |
| Keyframes: position, scale, rotation, flip, opacity | 5 | ☑ (CL-0046; on-canvas rotate handle CL-0051) | M-4.1, M-4.2 |
| Easing presets | 5 | ☑ (CL-0046) | M-4.3 |
| Motion presets: bob, walk, shake, pop | 5 | ☑ (CL-0049; live-verified with 34 scripted assertions) | M-4.4 |
| Pose swapping on timeline | 5 | ☑ (CL-0046 document half + Pose dropdown; M-4.5 written CL-0049) | M-4.5 |
| Camera pan and zoom | 5 | ☑ (CL-0044/45 engine + render; CL-0050 authoring UI, live-verified with 19 scripted assertions) | M-4.6 |
| Multi-track timeline, scrub, snap, zoom | 6 | ◐ (CL-0059: panel, transport, ruler, keyframe rows, snap, zoom; audio lanes next; M-1.3 tour pending) | M-1.3 |
| Audio clips: volume, fade, trim | 6 | ◐ (CL-0055/57 document+export half; CL-0060 lanes, gestures, clip panel; preview + M-5.5 controls pending) | M-5.5 |
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
| Scene and layers (edits round-trip; placement geometry as arithmetic) | ☑ | ✅ |
| Animation engine (easing, eased interpolation, frame-exact time, keyframeAtPlayhead, presets, camera — all as arithmetic; camera edits round-trip) | ☑ | ✅ |
| Timeline foundations (mapping/snap/lanes/previewSchedule as arithmetic; clip trim and keyframe-move edits round-trip; the mixer sample-for-sample) | ☑ | ✅ |
| Render snapshots (14 moments through the real sceneStage vs approved references; `npm run snapshots:approve`) | ☑ | ✅ |
| Export | ☑ | ✅ |
| Segmentation (real worker + model + coverage + pixels-untouched + memory) | ☑ | ✅ |
| Production-build scan (no dev/fixture code ships; worker + models in place) | ☑ | ✅ |
| No unexpected network | ☑ | ✅ |
| License allow-list | ☑ | ✅ |
| AI-spend guard | ☑ | ✅ |

Run everything with one command: `npm run check` (255 tests + licenses + build scan + segmentation + export with the audio fixtures, the two trimmed clips and the 14 render snapshots; measured ≈70–90 seconds — the spread is the segmentation check's one real cutout varying with laptop load; the snapshots add only ~2 s because they ride in the export check's hidden window). When a snapshot fails, open tests/output/snapshots/contact-sheet.png (expected | actual | diff, differences in red); if the new look is right, `npm run snapshots:approve` and commit. `npm run check:segmentation:hd` exercises the HD model on demand. A green run leaves tests/output/ empty (the CL-0024 housekeeping rule, enforced by the tests themselves).

## 5. Waiting on Alek

| Item | Needed by | Ref |
|------|-----------|-----|
| If you have a real iPhone photo (.heic): import it the same way — it should just appear (this laptop has the HEIF extension). That verifies the HEIC works-path; the missing-extension message is covered by checks. | Now (verifies CL-0029) | M-9.2 |
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
