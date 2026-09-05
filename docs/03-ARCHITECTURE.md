# DOC-03 — Architecture

**Status:** Active (ADR-006 accepted 2026-09-02)
**Revised:** 2026-09-02 for ADR-008 to ADR-011 (company server, cloud TTS, agent in v1)
**Last updated:** 2026-09-02
**Related:** ADR-001, ADR-002, ADR-005, ADR-006, ADR-008 to ADR-014

---

## 1. Overview in plain English

PAPERCUT is a desktop app with four parts, plus a small company server on the internet:

1. **The Editor (UI)** — everything the user sees and clicks: panels, timeline, preview window.
2. **The Project Document** — one big structured record of everything in the project: assets, scenes, layers, keyframes, audio clips. The UI reads it and writes to it. Undo/redo is just stepping back and forth through its history.
3. **The Renderer** — takes the Project Document and a point in time, and draws the frame. Used live for the preview and again, frame by frame, for export.
4. **The Workers** — background helpers for slow jobs: background removal (local) and video export (local, using Windows' built-in encoders). They run separately so the UI never freezes.
5. **The Company Server** — a small service the app talks to over the internet for sign-in, subscription checks, voices (TTS), and the agent. It holds the OpenAI key; the app never does. Everything else in the app works without it.

```
┌───────────────────────────────────────────────┐
│                   EDITOR (UI)                 │
│  Home · Assets · Scene canvas · Timeline ·    │
│  Inspector · Sound library · Export           │
└──────────────┬───────────────────┬────────────┘
               │ reads/edits      │ asks for frames
               ▼                  ▼
     ┌──────────────────┐  ┌──────────────────┐
     │ PROJECT DOCUMENT │─▶│     RENDERER     │
     │ (single source   │  │ (PixiJS, WYSIWYG)│
     │  of truth, undo) │  └────────┬─────────┘
     └────────┬─────────┘           │ frames
              │ jobs                ▼
     ┌────────▼──────────────────────────────┐
     │               WORKERS (local)         │
     │ Background removal (BiRefNet) · Export│
     │ (separate processes, never block UI)  │
     └───────────────────────────────────────┘
              │ https (signed-in user only)
              ▼
     ┌───────────────────────────────────────┐
     │           COMPANY SERVER              │
     │ Auth · Subscription · Usage caps      │
     │ /tts  → OpenAI gpt-4o-mini-tts        │
     │ /agent → OpenAI GPT-4o-mini class     │
     │ Holds the API key. App never does.    │
     └───────────────────────────────────────┘
```

Local-only work (editing, cutouts, export) never touches the server. Voices and the agent require a signed-in, subscribed user and an internet connection.

## 2. Project folder layout

```
MyVideo.papercut/
  project.json          ← the Project Document
  assets/
    images/             ← originals as imported
    cutouts/            ← PNGs with transparency after background removal
    audio/              ← imported sounds and generated TTS (cached; regenerated only if the line or delivery changes)
  cache/                ← thumbnails, waveform data; safe to delete
```

A project is portable: copy the folder, and it opens anywhere.

## 3. The Project Document (project.json), simplified

```
project
  format: "9:16" | "16:9" | "1:1"
  fps: 30
  assets[]           → id, type (image | cutout | audio), file, metadata
  characters[]       → id, name, poses[] (each pose = a cutout asset), voice
  scenes[]           → id, name, duration, background asset, background fit
                        (cover, the default, or stretch), camera keyframes,
                        layers[], audioClips[], transitionOut (into the next
                        scene; absent = cut) + its length in seconds (absent
                        = 0.5; on use clamped to 0.1–3 s and half the shorter
                        of the two scenes it joins, then down to a whole
                        frame — scenes OVERLAP by that length, so the video's
                        total is the durations minus the transitions)
    layers[]         → id, source (character+pose | prop | text), keyframes[],
                        hidden (not drawn anywhere, export included),
                        locked (still renders; refuses selection/dragging)
    keyframes[]      → time, x, y, scale, rotation, flipX, opacity, easing, pose
    audioClips[]     → asset or ttsLine, start, volume, fades, attachedTo (layer),
                        trim (optional: how far into the sound the clip begins +
                        how much of it plays; absent = the whole sound)
    ttsLine          → character, text, delivery instruction, voice, cached audio asset
```

Everything the AI agent will one day produce is expressed in exactly these terms, so agent output and manual editing are interchangeable (DOC-01 §3).

## 4. Key flows

### 4.1 Import a character photo
Drop image → copy to `assets/images/` → background-removal worker produces `assets/cutouts/<id>.png` → asset appears in the Assets panel with a thumbnail → user can open the mask editor to touch up.

### 4.2 Add dialogue
User selects a character, types a line and an optional delivery note ("deadpan"), sets the time → app sends text + delivery + voice to the company server → server checks subscription and usage cap, calls OpenAI TTS, returns audio → saved to `assets/audio/<id>.wav` and cached by a hash of (text, delivery, voice) → an audio clip appears on the timeline attached to that character → the "talking" indicator fires automatically while the clip plays.

### 4.2b Direct a scene with the agent
User types "make Dave walk in from the left, look shocked at the suitcase, and say 'that's not mine'" → app sends the instruction plus a compact summary of the current scene (characters, poses, props, layers, timing) to the company server → server calls the model with a strict output schema → returns a list of ordinary edits (add layer, add keyframes, set pose, add ttsLine) → app shows them as a proposal with a preview → user accepts (edits are applied through the same undo-able path as manual edits), tweaks, or discards.

### 4.3 Export
User picks a platform preset (and optionally the "AI-generated" label) → renderer draws every frame off-screen at the target resolution → each frame goes to the WebCodecs video encoder (Windows Media Foundation H.264, hardware when available) and the mixed audio to the WebCodecs audio encoder (AAC) → mp4-muxer writes the `.mp4` to the chosen location → progress bar, then "Reveal in folder". No external programs are launched. (ADR-013)

## 5. Performance targets (from DOC-01 §7)
- Preview scrubbing stays responsive with 20 layers on screen.
- Background removal (revised by ADR-017 on the DOC-13 measurements): under 15 s per photo on a 2020-era laptop CPU; up to 45 s acceptable on minimum-spec machines (8 GB, no GPU) — always a background queue with visible status and cancellation, never blocking the app.
- TTS generation faster than real time.
- 60 s of 1080p30 exports in < 3 minutes without a GPU.

## 6. Security and privacy
- The app makes network requests only to the company server, only when signed in, and only for TTS and the agent. Verified by a test that fails on any other outbound request.
- Photos never leave the user's machine. Only dialogue text, delivery notes, and a text summary of scene structure are sent for TTS and the agent.
- The OpenAI key exists only on the company server. Per-user usage caps are enforced server-side.
- All user material stays inside the project folder. Models are bundled read-only inside the app package.

## 6b. Company server (minimum viable)
| Endpoint | Does |
|----------|------|
| `POST /auth/*` | Sign up, sign in, refresh session |
| `GET /me` | Subscription status, remaining usage for the period |
| `POST /tts` | Validates user and cap → OpenAI TTS → returns audio |
| `POST /agent` | Validates user and cap → OpenAI chat with schema → returns edit list |
| Merchant-of-record webhooks | Keep subscription status current (ADR-014) |

Stack per ADR-006: Node/TypeScript, Postgres, merchant of record for payments. Hosting choice is OQ-011.

## 7. Future hooks (do not build yet, do not block)
- A `providers/` layer with one interface per AI capability (segmentation, tts, agent, imageGen, soundGen). v1: local BiRefNet for segmentation; server-backed OpenAI for tts and agent. Later versions add imageGen, soundGen, and a premium tts provider behind the same interfaces.
