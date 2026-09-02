# DOC-05 — User Manual

**Status:** In progress (sections are filled in as each feature ships; a section is not written until its feature exists)
**Last updated:** 2026-09-02 (M-1.2, M-9.3 written)

Sections are numbered M-N.N and referenced from DOC-01 and DOC-04. Every feature listed in DOC-01 §5.1 must have a section here before v1.0 ships.

---

## M-1 Getting started
- M-1.1 Installing (Windows, macOS)
- M-1.1b Creating your account and subscribing

### M-1.2 The home screen: format, save location, naming your project

The home screen is the first thing you see. It does two jobs: start a new
project, or open one you already have.

**Starting a new project (left panel):**

1. **Name** — type a name for your video. This becomes the project folder's
   name (characters Windows does not allow in folder names are dropped).
2. **Format** — pick the shape of your video:
   - **9:16 vertical** for TikTok, Reels, and Shorts
   - **16:9 widescreen** for YouTube
   - **1:1 square** for feed posts
   The format is fixed when the project is created.
3. **Save location** — press **Choose…** and pick the folder where the
   project should live (for example, Documents).
4. Press **Create project**. The button stays grey until a name is typed and
   a location chosen.

**Opening an existing project (right panel):** press **Open a project
folder…** and pick the folder whose name ends in `.papercut`, or click any
project under **Recent** — the last ten you worked on are listed, newest
first. Projects that were deleted or moved disappear from the list on their
own.

The app's version number is shown in the bottom-right corner.

- M-1.3 A tour of the interface
- M-1.4 Your first 10-second video (walkthrough)

## M-2 Bringing in your material
- M-2.1 What makes a good photo (lighting, angle, background contrast)
- M-2.2 Importing backgrounds
- M-2.3 Importing characters and props; automatic cut-out
- M-2.4 Fixing a cut-out by hand (mask editor)
- M-2.4b The HD cutout option
- M-2.5 Characters with several poses
- M-2.6 Importing sounds and music

## M-3 Building a scene
- M-3.1 Backgrounds and the scene canvas
- M-3.2 Adding, ordering, locking, hiding layers
- M-3.3 Placing and sizing things

## M-4 Making things move
- M-4.1 Keyframes explained in one page
- M-4.2 Move, scale, rotate, flip, fade
- M-4.3 Easing (how motion speeds up and slows down)
- M-4.4 Motion presets: bob, walk, shake, pop
- M-4.5 Swapping poses on the timeline
- M-4.6 Camera pan and zoom

## M-5 Voices and sound
- M-5.1 Giving a character a voice
- M-5.2 Writing dialogue and generating speech
- M-5.2b Delivery notes: telling a voice how to act
- M-5.3 The talking indicator
- M-5.4 The sound library: browsing, searching, categories
- M-5.5 Placing, trimming, fading, and mixing audio

## M-6 Scenes and transitions
- M-6.1 Adding and reordering scenes
- M-6.2 Transition types and when to use them
- M-6.3 Scene duration and timing

## M-7 Text and captions
- M-7.1 Titles and captions
- M-7.2 Caption animation

## M-7b Directing with the AI agent
- M-7b.1 What the agent can and cannot do
- M-7b.2 Writing a good instruction
- M-7b.3 Reviewing, adjusting, and accepting a proposal
- M-7b.4 Your monthly usage and what counts against it

## M-8 Exporting
- M-8.1 Platform presets (TikTok, YouTube, Instagram, Facebook)
- M-8.2 Resolution and frame rate
- M-8.3 Where your video goes

## M-9 Reference
- M-9.1 Keyboard shortcuts
- M-9.2 Supported file types

### M-9.3 Project folder contents

Each project is one ordinary folder whose name ends in `.papercut`. Inside:

| Item | What it is |
|------|------------|
| `project.json` | The whole project: scenes, layers, timing, dialogue. |
| `assets/images/` | Your photos, exactly as imported. |
| `assets/cutouts/` | Cut-out versions with transparent backgrounds. |
| `assets/audio/` | Imported sounds and generated voice lines. |
| `cache/` | Thumbnails and similar. Safe to delete; rebuilt as needed. |

To back a project up or move it to another computer, copy the whole folder.
Nothing outside the folder is needed. Saving is done atomically (written to
a temporary file first, then swapped in), so a crash mid-save cannot damage
the project.
- M-9.4 Troubleshooting
- M-9.5 Licenses and credits (bundled models, FFmpeg source, fonts, sound library sources)
- M-9.6 AI-generated voices: what you need to know (disclosure, likeness, platform labels)
