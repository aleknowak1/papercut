# DOC-12 — Export Prototype Measurement Report (OQ-019)

**Status:** Active (measurements final; kept as the record of the ADR-013 decision)
**Measured:** 2026-09-02, on Alek's development laptop (Windows 11 Home, no export settings changed)
**Related:** ADR-013, ADR-015, OQ-019, DOC-01 §7, DOC-03 §4.3, CL-0018/CL-0019

---

## 1. What was measured

The ten-second test project (tests/fixtures: plain background, moving orange
square, burned-in frame counter and timecode, beeps at 0 / 2.5 / 5 / 7.5 /
9.5 seconds with a matching 3-frame white flash) was exported three ways
through the ADR-013 pipeline — PixiJS off-screen frames → Windows' own
H.264 and AAC encoders via WebCodecs → mp4-muxer — and each .mp4 was read
back and measured by the same code the Export check uses.

## 2. Results

| Run | Export time (10 s video) | Extrapolated to 60 s | DOC-01 §7 target | File size | Encoder used |
|-----|--------------------------|----------------------|------------------|-----------|--------------|
| 1080p30, hardware allowed | 7.9 s | ≈ 47 s | — | 0.9 MB | Hardware (Media Foundation) |
| 1080p30, software forced (the no-GPU case) | 7.2 s | ≈ 43 s | **under 180 s** ✓ | 0.8 MB | Software (Microsoft's encoder) |
| 720p30, hardware allowed | 3.4 s | ≈ 20 s | — | 0.5 MB | Hardware (Media Foundation) |

The 60-second figures are straight-line extrapolations (6 × the measured
time); real projects will be somewhat slower per frame (photo layers instead
of solid colours), but the margin is roughly four times the target.
Interesting detail: the software encoder was no slower than hardware here —
at this speed the cost is drawing and handing over frames, not encoding.

**Audio/video alignment**, measured as the distance between each beep's
onset in the decoded audio and its white flash in the decoded picture
(identical in all three runs):

| Beep at | Sound vs picture |
|---------|------------------|
| 0.0 s | 9.6 ms |
| 2.5 s | 0.3 ms |
| 5.0 s | 0.3 ms |
| 7.5 s | 0.3 ms |
| 9.5 s | 0.3 ms |

0.3 ms is far below anything a person can perceive (film sync tolerance is
about ±22 ms). The 9.6 ms at the very first instant is the AAC encoder
"warming up" at the start of the stream, affects only a sound placed at
exactly 0.000 s, and is still well inside the check's 50 ms limit.

**Every export also passed the correctness checks:** exactly 10.000 s,
exact requested resolution, 30.00 fps, exactly 300 frames.

## 3. Visual quality (plain language)

Watched at full size: the picture is clean. The frame counter's small text
is sharp and readable, the square's edges are crisp, the flat background
shows no banding or blockiness, and motion is smooth with no stutter. For
this test content the encoder used well under its allowed bitrate, so file
sizes are small; real photo content will use more and has room to. Judged
by Claude from the exported file; Alek should watch and listen once as the
human check (see DOC-10 §5).

## 4. Limits of this measurement

- **Windows 10 is untested.** We have no Windows 10 machine. The pipeline
  uses only what Windows 10+ ships (ADR-012/013), but this report proves
  Windows 11 only. If a Windows 10 machine ever becomes available, run
  `npm run measure:export` on it and append the numbers here.
- One laptop, one day. The Export check re-proves correctness (not speed)
  on every `npm run check`.
- The test scene is simple by design. Speed with many photo layers is
  re-measured when the real renderer exists (Phase 5+/9).

## 5. Decision (OQ-019)

**The targets are met with large margins. ADR-013 stands: Windows' own
encoders through WebCodecs, mp4-muxer for the container, no FFmpeg.**
OQ-019 is closed; ADR-013's status is now plain "Accepted"; DOC-08 row A11
records mp4-muxer 5.2.2 (MIT) as locked.

One watch item, recorded in DOC-08 A11: npm marks mp4-muxer as deprecated
in favour of its successor "Mediabunny", whose MPL-2.0 license is not on
our allow-list. mp4-muxer 5.2.2 is MIT, complete, and does everything we
need; we stay on it. If it ever gains a blocking defect, the choice between
adding an MPL exception or another muxer is a new ADR for Alek.
