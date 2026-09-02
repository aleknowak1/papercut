# DOC-01 — Product Specification

**Status:** Active
**Last updated:** 2026-09-02
**Related:** DOC-02 (decisions), DOC-03 (architecture), DOC-07 (open questions)

---

## 1. One-sentence description

PAPERCUT is a paid Windows desktop application (macOS later) that lets anyone turn their own photographs into short, photorealistic, cut-out-animated comedy videos with voices and sound, ready to post on TikTok, YouTube, Instagram, and Facebook.

## 2. Who it is for

People who want to make funny short-form videos for social media and who are not animators or video editors. They have photos (of themselves, friends, places, objects) and jokes. They do not have After Effects skills, a GPU, or patience for a complex tool.

## 3. What makes it different

| Principle | Meaning in practice |
|-----------|---------------------|
| **Photorealistic material** | Every visual element is a real photograph the user supplies. A real person walks through a real airport and picks up a real suitcase. Nothing is drawn, cartoonish, or simplified. |
| **Cut-out motion** | Photos are cut out from their backgrounds and animated as layers: moved, scaled, rotated, flipped, bobbed, and swapped between poses. This is deliberate style, not a limitation. |
| **User brings everything** | No bundled templates, stock photos, or sample projects. The app is empty until the user adds their own material. |
| **Works fully manually, fully with AI, or any mix** | The AI agent is a convenience layer. Every single thing it can do, the user can do by hand, and vice versa. Removing the AI must leave a complete, usable product. |
| **No keys, no setup** | The user signs in and subscribes; that's it. Cloud AI (voices, the agent) runs through a server the company controls. Users never see or supply API keys. Background removal runs locally on the user's machine. |
| **Simple, slightly retro UI** | Dense, functional, keyboard-friendly panels in the spirit of early-2000s PC game tools and mod editors. Clarity over polish. |
| **Documented as it is built** | Manual and change log grow in step with the software. See DOC-00. |

## 4. Core workflow (target experience)

1. **Home** — choose output format (9:16 vertical, 16:9 horizontal, 1:1 square), choose project save location, name the project.
2. **Assets** — import photos: backgrounds (scenes), characters, props. Background removal runs automatically on characters and props; the user can refine the cutout by hand. Import sound files. Record or type dialogue.
3. **Scene building** — place a background, add character and prop layers, position them.
4. **Animation** — move things over time using keyframes; swap poses; add camera pan/zoom.
5. **Audio** — assign dialogue lines to characters (text-to-speech generates the voice), drop in sound effects and music from the library or imports, align to the timeline.
6. **Scenes and transitions** — build several scenes; choose a transition between each.
7. **Refinement** — edit anything by hand, or describe changes to the AI agent ("make him walk in from the left and look shocked at the suitcase"). The agent proposes ordinary edits; the user accepts, adjusts, or discards them.
8. **Export** — render to .mp4 with platform-appropriate resolution, frame rate, and encoding.

## 5. Version scope

### 5.1 Version 1.0 — "The complete product"

A person can install the app, sign in, subscribe, bring their own photos, make a multi-scene funny video with cut-out characters, AI voices, and sounds, direct it by hand or by talking to the agent, and export it. Decided in ADR-008.

**In scope:**

| Area | Features |
|------|----------|
| Account | Sign up / sign in; subscription through a merchant of record; acceptable-use agreement at sign-up (no imitating real people without consent); license check on launch; per-user usage caps on voice and agent calls |
| Project | Create/open/save projects; choose format (9:16, 16:9, 1:1); choose save location; autosave; project is a self-contained folder |
| Asset import | Drag-and-drop images (JPG, PNG, WebP; HEIC if Windows can decode it, otherwise a clear "export as JPG" message), audio (MP3, WAV, M4A, OGG) |
| Background removal | Automatic on import for characters/props using bundled BiRefNet_lite, running locally on CPU; "HD cutout" option using bundled BiRefNet full; manual mask editor (brush add/erase, edge feather) — required, not optional |
| Layers | Background, character, prop layers; ordering; opacity; lock/hide |
| Animation | Keyframes for position, scale, rotation, flip, opacity; easing presets; motion presets (bob, walk, shake, pop); pose swapping (one character, multiple cutouts) |
| Camera | Scene-level pan and zoom keyframes |
| Voices (TTS) | Cloud TTS (OpenAI gpt-4o-mini-tts) via the company server; clear in-app disclosure that voices are AI-generated; per-character voice assignment; a plain-English delivery instruction per line ("deadpan", "panicked whisper"); generated audio placed on timeline and editable like any clip; results cached locally so re-renders cost nothing |
| Speech visual | Simple "talking" indicator: a pose swap or subtle bob while a character's line plays (no lip sync) |
| Sound | Bundled starter sound library (curated, licensed, categorized, searchable); user imports; volume, fade, trim |
| Timeline | Multi-track timeline; scrub, snap, zoom; per-scene duration |
| Scenes | Multiple scenes; reorder; transitions: cut, crossfade, slide (4 directions), zoom-in/out, wipe |
| Text overlays | Basic captions/titles with a few font choices and simple animation (fade, pop) |
| AI agent | Natural-language scene direction and edits, via the company server on a lightweight OpenAI model. Output is always ordinary project edits (layers, keyframes, clips, TTS lines) shown as a reviewable proposal. Works on new scenes and existing ones. |
| Export | H.264 .mp4 at 1080p (and 720p option), 30 fps (60 optional), AAC audio, using Windows' built-in encoders; presets named for each platform; optional "AI-generated" label (small corner mark or end card) with a reminder to enable the platform's own AI-content setting; export works without internet |
| Manual | DOC-05 complete for every feature above; in-app link to it |

**Explicitly out of scope for 1.0:** macOS, photo generation, sound generation, premium/cloned voices, AI-generated motion, lip sync, collaboration, mobile, offline voice/agent use.

**Build order (fixed):** editor → server (accounts, subscription, proxy) → voices → agent → sound library curation → manual completion → release. The editor is fully usable before any server work starts; this is how progress is checked.

### 5.2 Version 1.x — Refinements from real users

Bug fixes, more motion presets, more transitions, sound library growth, usage and pricing adjustments.

### 5.3 Version 2.0 — "Generation and premium voices"

- Photo generation from text (scenes, props, characters) through the company server.
- Custom sound generation from text.
- Premium voice tier (e.g. ElevenLabs), possibly with voice cloning behind a consent policy.
- Optional AI motion effects for individual shots.

## 6. Non-goals (permanent)

- Never cartoon, vector, or "animated-style" rendering.
- Never ship templates, stock photos, or example projects.
- Never require an API key from the user.
- Never let the user's original photo be regenerated or "reinterpreted" by an AI during cutout; only the mask changes, never the pixels.
- Never make the AI agent required for any task.

## 7. Success criteria for 1.0

- A first-time user with ten photos and a script can produce a 30-second exported video in under one hour, using only the in-app manual.
- Background removal is acceptable without touch-up on at least 8 of 10 typical phone photos of people.
- Export of a 60-second 1080p project completes in under 3 minutes on a mid-range Windows laptop with no dedicated GPU.
- Editing, cutouts, and export work with the internet disconnected; only voices and the agent require a connection.
- A typical 60-second video costs the company under $0.05 in cloud AI usage.
