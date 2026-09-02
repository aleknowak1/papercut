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

### M-2.1 What makes a good photo

The automatic cut-out works best when the camera can tell your subject from
what is behind it. You do not need studio photos — ordinary phone photos
are fine — but these things help:

- **Contrast with the background.** A person in a dark coat against a light
  wall cuts out better than the same coat in a dim hallway.
- **The whole subject in frame.** Cut-off elbows and feet stay cut off.
- **Even light.** Strong shadows across a face or body can end up looking
  like part of the background.
- **A little distance.** If the subject leans on or overlaps other objects,
  the cut-out may take those along.
- **Sharpness.** Motion blur smears the edge the cut-out has to find.

Tricky edges — flyaway hair, fur, thin straps, glasses — often still work,
and when they do not, the HD cutout option and the hand mask editor
(M-2.4) are there to fix them.

### M-2.2 Importing backgrounds

Backgrounds are the photos your scenes take place in. In an open project:

1. Press **+ Background…** in the Assets panel and pick one or more photos
   (JPG, PNG or WebP — see M-9.2), or simply drag the files onto the panel
   and answer **Backgrounds** when asked what they are.
2. Each photo appears in the assets list with a small preview. The file is
   copied into the project folder untouched, so your original stays where
   it was and the project stays self-contained.

Backgrounds get no cut-out — they are used whole. A photo you already
imported is refused with a message saying so (the app compares the actual
file contents, not the name). A file that cannot be read as an image is
refused with a plain explanation and nothing is added.

Importing is one undo step: **Ctrl+Z** removes the newest import from the
project's asset list (the Undo button does the same).

### M-2.3 Importing characters and props; automatic cut-out

Characters and props are the photos that get cut out and animated:

1. Press **+ Character / prop…** (or drop files and answer
   **Characters / props**).
2. The photo is imported exactly like a background, and then the automatic
   cut-out starts in the background. The status column shows it moving:
   *cutout queued* → *loading the cutout model* → *cutting out* → *cutout
   ready*. You can keep working — importing more photos, undoing, anything —
   while it runs; cut-outs are done one at a time, each typically well
   under a minute.
3. When it finishes, a new *cutout* row appears: your photo with the
   background made transparent. The original photo is never altered — the
   cut-out is a separate file made of the original pixels plus
   transparency.

Press **Cancel** on a row to stop a cut-out you did not want; it can be
re-made later from the mask editor. If a cut-out fails, the row says why in
plain language and the photo itself is unaffected.

### M-2.4 Fixing a cut-out by hand (mask editor)
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

### M-9.2 Supported file types

**Images** (backgrounds, characters, props): **JPG**, **PNG**, **WebP**.
iPhone photos (**HEIC**) are converted on import using Windows' own
decoder when Microsoft's free HEIF Image Extension is installed; without
it, the app shows instructions for exporting the photo as JPG instead.
Anything else is refused with a plain message.

**Audio**: MP3, WAV, M4A, OGG (arrives with M-2.6).

**Video export**: .mp4 (H.264 video, AAC audio), made with the encoders
built into Windows.

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
