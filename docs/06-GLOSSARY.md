# DOC-06 — Glossary

**Status:** Active
**Last updated:** 2026-09-02

| Term | Definition |
|------|------------|
| **Asset** | Any file the user imports or the app generates: an image, a cutout, an audio clip. |
| **Background / Scene image** | A photo used as the full-frame backdrop of a scene. Not cut out. |
| **Cutout** | A photo with its background removed, saved as a PNG with transparency. Characters and props are cutouts. |
| **Character** | A named person or creature made of one or more cutouts (poses) plus an assigned voice. |
| **Pose** | One cutout belonging to a character (e.g. "standing", "walking", "shocked"). Swapped on the timeline. |
| **Prop** | A cutout object that is not a character (suitcase, coffee cup). |
| **Layer** | One visual element placed in a scene: a character pose, a prop, or text. Layers stack in order. |
| **Keyframe** | A recorded value (position, scale, rotation, etc.) at a specific time. The app fills in the motion between keyframes. |
| **Easing** | The speed curve between two keyframes: linear, ease-in, ease-out, bounce, etc. |
| **Motion preset** | A ready-made keyframe pattern applied with one click: bob, walk, shake, pop. |
| **Camera** | Scene-level pan and zoom applied to everything at once. |
| **Scene** | A self-contained segment with one background, its layers, its audio, and a duration. A project is a sequence of scenes. |
| **Transition** | The visual effect between the end of one scene and the start of the next. |
| **Timeline** | The horizontal, time-based view of all layers and audio in a scene. |
| **Track** | One row of the timeline holding one layer or one audio stream. |
| **Clip** | One audio item on the timeline with a start, length, volume, and fades. |
| **TTS (text-to-speech)** | Generating a spoken voice from typed text. Runs in the cloud through the company server (ADR-010). |
| **Delivery note** | The plain-English instruction attached to a dialogue line that tells the voice how to perform it ("deadpan", "panicked whisper"). |
| **Proposal** | The set of edits the agent suggests in response to an instruction, shown for review before anything changes in the project. |
| **Usage cap** | The monthly limit on voice and agent calls per subscriber, enforced by the company server. |
| **HD cutout** | Re-running background removal on one image with the larger, slower BiRefNet model for difficult edges. |
| **Talking indicator** | The automatic visual cue (pose swap or bob) while a character's dialogue plays. Not lip sync. |
| **Background removal / Segmentation** | Automatically separating the subject of a photo from its background to make a cutout. |
| **Mask** | The shape that defines which pixels of a cutout are visible. Editable by hand. |
| **Sound library** | The bundled, categorized collection of licensed sound effects. |
| **Export / Render** | Producing the final .mp4 file from the project. |
| **Preset (export)** | A saved set of export settings named for a platform (e.g. "TikTok 1080×1920 30fps"). |
| **Project Document** | The single `project.json` file describing everything in a project. See DOC-03 §3. |
| **Provider** | A swappable implementation of one AI capability (e.g. local TTS vs. cloud TTS). See DOC-03 §7. |
| **Agent** | The AI assistant that turns natural-language instructions into ordinary keyframes, clips, and edits, always as a reviewable proposal. |
| **Company server** | The server owned by the business that holds API keys, accounts, subscription, and usage caps. See ADR-005, ADR-008. |
| **Fake provider** | A stand-in for a paid AI service that returns recorded or canned results, used by all checks and by default during development so nothing is spent. See DOC-09. |
| **Fixture** | A recorded response (audio clip, agent proposal) saved once and reused by checks instead of calling a paid service. |
| **Check** | One automated test that must pass before a code change is accepted. See ADR-015. |
| **Render snapshot** | An approved reference image of a rendered frame; checks compare new renders to it pixel for pixel. |
| **ADR** | Architecture Decision Record. One numbered entry in DOC-02. |
| **OQ** | Open Question. One numbered entry in DOC-07. |
