# PAPERCUT

*Working codename. Real product name to be chosen (see docs/07-OPEN-QUESTIONS.md, OQ-005).*

A paid Windows desktop app that turns your own photographs into short, photorealistic, cut-out-animated comedy videos with AI voices and sound, ready to post on TikTok, YouTube, Instagram, and Facebook.

Every visual element is a real photo the user supplies: a real person walks through a real airport and picks up a real suitcase. Nothing is drawn, cartoonish, or templated. Characters and props are cut out automatically, animated as layers on a keyframe timeline, voiced by text-to-speech with plain-English delivery notes ("deadpan", "panicked whisper"), and exported as an .mp4. An AI agent can direct scenes from a sentence, but everything it does is an ordinary, editable proposal; the app works fully by hand, fully by agent, or any mix.

## Repository

https://github.com/aleknowak1/papercut.git

## Status

Phase 0 (foundation) complete. Phase 1 (scaffold) starting. See `docs/10-PROJECT-TRACKER.md`.

## Stack

Electron · TypeScript · React · PixiJS · ONNX Runtime (BiRefNet for local background removal) · WebCodecs + mp4-muxer for export (no FFmpeg) · Node/Postgres company server · OpenAI for voices and the agent, through the server only.

## Documentation

All decisions, specs, and the manual live in `docs/`. Start with `docs/00-INDEX.md`. `CLAUDE.md` holds the standing orders for AI-assisted development.

## License

Proprietary. All rights reserved. Third-party components and their licenses are listed in `docs/08-LICENSING.md`.
