# DOC-13 — Segmentation Gate Report (OQ-020)

**Status:** Active (gate evidence final; the path forward is Alek's decision)
**Measured:** 2026-09-02, on Alek's development laptop (Windows 11 Home, Smart App Control ON, unchanged)
**Related:** ADR-009, OQ-020, DOC-03 §5, DOC-08 A7/A8, CL-0025

---

## 1. The question and the answer in one paragraph

Phase 3 rests on onnxruntime-node, a native Node module, and OQ-020 asked
whether Windows Smart App Control on this laptop would block it the way it
blocked an unsigned helper during Phase 1. **It does not.** The module and
every DLL it ships are validly signed by Microsoft; it installed, loaded and
ran real BiRefNet inference in plain Node and inside an Electron 44 utility
process, with zero Smart App Control or code-integrity events. The security
gate passes. **The gate still ends in a STOP**, because the measured speed is
catastrophically off target: **27.7 minutes per photo** against a target of
under 3 seconds. The cause is a model-format problem (an fp16 model on a
CPU), not a Windows problem. Candidate paths are listed in §6; per the plan,
no path has been chosen — that decision is Alek's.

## 2. What the install actually did (gate step 1a)

- `npm install --save-exact onnxruntime-node@1.29.0` added 8 packages.
- It ran one postinstall script (`node ./script/install`). On Windows x64
  the script's download list is **empty** — it downloaded nothing; it only
  downloads extra CUDA support on Linux. All Windows binaries ship inside
  the npm package itself.
- Binaries installed under `bin/napi-v6/win32/x64/`, signatures checked with
  Windows' own `Get-AuthenticodeSignature`:

| File | Size | Signature |
|------|------|-----------|
| onnxruntime_binding.node (the native module itself) | 0.3 MB | **Valid — Microsoft Corporation** |
| onnxruntime.dll | 26.7 MB | Valid — Microsoft Corporation |
| DirectML.dll | 17.7 MB | Valid — Microsoft Windows Publisher |
| dxcompiler.dll | 17.2 MB | Valid — Microsoft Corporation |
| dxil.dll | 1.4 MB | Valid — Microsoft Corporation |

This is why Smart App Control has no objection: ONNX Runtime is a Microsoft
project and Microsoft signs the published binaries. The Phase 1 block hit an
*unsigned* community-built helper; this is a different situation.

## 3. Load proof (gate steps 1b, 1f)

Probe code: `scripts/oq020/` (committed; reusable on any future machine).

| Where | Result |
|-------|--------|
| Plain Node v24.16 | Loads in 33 ms; builds a session over the real 115 MB model in 5.9 s |
| Electron 44.1.1, **utility process** (the process type the real worker will use — a fully separate OS process, so a native crash could never take down the app window) | Loads in 82 ms; builds the same session in 6.4 s |

**Windows event log** (checked the way CL-0022 did, CodeIntegrity +
AppLocker channels): zero events during the install, both load probes and
the full inference run. The only Smart App Control blocks logged today were
at 06:58–07:00, before this session — the *known* Phase 1 issue
(`@electron-internal/extract-zip/index.win32-x64-msvc.node`, Electron's
unsigned unzip helper, blocked during a fresh `npm install`). Nothing
onnxruntime-related was ever blocked.

## 4. Inference results (gate steps 1d, 1e)

Test input: a figure-like silhouette on a busy random-checkerboard
background, generated in code at 3000×4000 (typical phone-photo size),
nothing downloaded, nothing shipped. Full per-photo pipeline measured:
resize down to the model's fixed 1024×1024 input → normalise → inference →
resize the mask back up to 3000×4000.

**The model segments the test image nearly perfectly.** Mean mask value
0.998 inside the true figure, 0.0005 in the background; output dimensions
correct. Quality is not the problem.

**Speed and memory are the problem** (CPU only, as required — no GPU used):

| Measure | Result | Target (DOC-03 §5) |
|---------|--------|--------------------|
| Time per photo | **1 661.7 s ≈ 27.7 minutes** | **< 3 s** |
| Peak memory of the worker process | 3.9–4.7 GB | (8 GB minimum-spec machines, DOC-01) |
| Threads used | up to 19 (ONNX Runtime saturated all 8 cores) | — |
| Model load (one-off) | 6–7.5 s | — |

An earlier run of the same probe with four inferences did not finish in
57 minutes and was stopped; the single-run number above is the clean
measurement. The numbers are roughly **550× off target**. This is a STOP
under plan step 1g.

## 5. Why it is this slow (and why this was not predictable from the plan)

Two causes stack:

1. **fp16 models run badly on CPUs, by design of ONNX Runtime.** ADR-009
   chose the fp16 files for their size (115 MB vs 224 MB). But ONNX
   Runtime's CPU engine has no native fp16 arithmetic for most operations:
   it inserts conversion steps around nearly every operation and falls back
   to slow implementations. Microsoft's own documentation and issue tracker
   say fp16 is for GPUs and **recommend fp32 models on CPU**. The fp16
   choice costs a large multiple, not a few percent.
2. **This laptop's CPU is small.** It is an Intel Core i3-N305: 8
   low-power efficiency cores, a budget chip. The DOC-03 target speaks of a
   "2020-era laptop CPU", and this machine is likely below that reference
   point in raw compute. Even a well-behaved fp32 model may need several
   seconds here — that number is unknown until measured (§6, path 1).

Fixed model geometry, for the record: the ONNX file's input is locked to
1×3×1024×1024 float32 (confirmed from the session metadata), so "run the
same file at a smaller size" is not an available speed knob.

## 6. Candidate paths (listed, not chosen — the decision is Alek's)

| # | Path | What it is | Plain-language trade-offs |
|---|------|-----------|---------------------------|
| 1 | **fp32 model on CPU** | The same repository offers the same weights in full precision: BiRefNet_lite 224 MB (and full 973 MB). Microsoft's recommended format for CPU. | The likeliest quick fix and the natural next measurement. Costs a 224 MB download to test (needs approval) and, if adopted, roughly doubles the bundled-model disk size (ADR-009 assumed ~600 MB for both models; fp32 would be ~1.2 GB). Speed on this laptop unknown until measured — plausibly seconds, not minutes, but no promise it beats 3 s on this class of CPU. |
| 2 | **int8 quantised model** | A compressed 8-bit version we would have to produce ourselves (no prebuilt one exists in these repositories). Typically 2–4× faster than fp32 on CPU and ~4× smaller than fp32. | Best CPU speed and smallest files, but the conversion tooling is Python-based — a one-time offline step on the dev machine, which brushes against the "No Python" rule (it would never ship or run in the product, like the model download itself). Slight quality loss, usually invisible for masks. Most moving parts. |
| 3 | **DirectML (GPU) with CPU fallback** | ONNX Runtime's DirectML engine ships in the package we already installed, is Microsoft-signed, and runs on any DirectX 12 graphics adapter — including the basic Intel graphics built into this laptop and into effectively every Windows 10/11 machine. Integrated GPUs typically run models like this in seconds. | Likely the biggest speed win on weak machines, using DLLs we already have. But DOC-03 §5 says CPU is the baseline and "do not depend on a GPU" — adopting this as the primary path would amend that target to "GPU when present, CPU as fallback", and the CPU fallback still needs paths 1 or 2 to be usable. Needs its own measurement. |
| 4 | **ONNX Runtime WASM (in-browser build)** | Runs the model inside Chromium with no native module at all — OQ-020 would become moot. | Solves a security problem we turned out not to have, and does not solve the speed problem: it is also CPU-bound and generally slower than the native CPU engine. Only interesting if a future machine *does* block the native module. |
| 5 | **A lighter model** | Drop to a smaller permissively-licensed segmentation model (e.g. the ISNet class that ADR-009 explicitly rejected). | Faster, but ADR-009 chose BiRefNet for cutout quality — the product's core promise. Changing the model is a new ADR and a quality decision, not an engineering detail. |

Paths can combine (e.g. 1 now to get unblocked, 3 as a later speed upgrade).
For customers: Smart App Control on fresh Windows 11 machines is **not** an
obstacle for onnxruntime-node itself (Microsoft-signed); whatever path is
chosen, that finding stands.

## 7. Limits of this measurement

- One laptop, one day; Windows 10 untested (no machine).
- fp32 and DirectML numbers do not exist yet — measuring them is the obvious
  next step if Alek approves the download.
- The synthetic test image proves "runs and separates figure from
  background", not photo quality (per the gate rule); real-photo quality is
  judged by Alek once cutouts are usable.

## 8. Verdict

**OQ-020's security question: answered, no block, evidence above (the
question stays open only until the performance path is decided). The gate
overall: STOPPED on performance, per plan step 1g.** No cutout feature is
built until Alek chooses a path from §6.

---

## 9. Second measurement round (Alek's decision request, same day)

Alek directed: confirm the probe's input size, then measure path 1 (fp32 on
CPU) and path 3 (DirectML with CPU fallback) before choosing. Paths 4
(WASM) and 5 (lighter model) are off the table by his decision.

### 9.1 Input-size check (asked first, answered plainly)

The probe always ran the model at its native 1024×1024. The ONNX file's
input is physically fixed at 1×3×1024×1024 — it cannot accept anything
else. The probe shrinks the 3000×4000 photo to 1024×1024, runs the model,
and scales the mask back up. The 27.7-minute fp16 figure was therefore a
fair baseline, not an 11×-too-big workload. The per-stage timings below
prove where the time goes: the two resizes cost well under a second
combined; the model is everything else.

### 9.2 Results (same fixture, same probe, same laptop; model input 1024×1024)

| Configuration | Time per photo | Of which: shrink / model / mask upscale | Peak worker memory | Threads | Mask quality (figure / background mean) |
|---|---|---|---|---|---|
| fp16, CPU, plain Node (round 1) | 1 661.7 s ≈ 27.7 min | — / ~1 661 s / — | 3.9–4.7 GB | 19 | 0.9977 / 0.0005 |
| **fp32, CPU, plain Node** | **38.1 s** | 0.1 s / 37.8 s / 0.3 s | 3.8 GB | 19 | **0.9977 / 0.0005 — identical to four decimals** |
| **fp32, CPU, Electron utility process** (the real home) | runs 30.7 / 33.2 / 43.7 s, **median 33.2 s** | 0.5 s / 43.0 s / 0.2 s (last run) | 4.8 GB | 31 | identical |
| fp16, DirectML (GPU) | **fails** | graph compile 45.9 s first time (5.3 s cached), then out-of-memory during execution | — | — | — |
| fp32, DirectML (GPU) | **fails** | same out-of-memory | — | — | — |

The upscaled 3000×4000 mask was saved as a PNG and inspected: a clean,
sharp silhouette, no bleed from the busy background. The cutout PNG was
decoded byte-by-byte to confirm the output rule: background alpha 0, figure
alpha 255, and the RGB values everywhere are the original pixels untouched.

### 9.3 Why DirectML failed here, and what that means

DirectML compiled the model but died executing it with Windows error
8007000E, "not enough memory resources", twice in a row (and identically
with fp32). This laptop has 8 GB of RAM total; its integrated Intel UHD
graphics has no memory of its own — it borrows system RAM (up to ~3.9 GB),
and BiRefNet at 1024×1024 wants more than was available. **8 GB is exactly
our minimum spec (OQ-007), so DirectML cannot be the only path**: on
customer machines like this one it will hit the same wall. On machines with
16 GB or a real graphics card it would very likely run and be fast — it
remains a candidate *accelerator*, never the baseline.

### 9.4 Honest reading against the 3-second target

Per Alek's instruction, 3 s (DOC-03 §5) is treated as the
*reference-machine* target ("2020-era laptop CPU"); this i3-N305 is below
that reference. fp32 CPU here: ~33–38 s per photo. A typical 2020 mid-range
laptop CPU is perhaps 1.5–3× faster: roughly **12–25 s per photo** —
better, but nowhere near 3 s. Path 2 (int8 quantisation, typically another
2–4× over fp32 on CPU) would land maybe **10–20 s here, 4–10 s on the
reference machine**. In plain words: **no CPU path measured or estimated
reaches 3 s for this model at 1024×1024.** The realistic shape of the
feature on CPU is a background queue with a progress bar and tens of
seconds per photo — or DirectML acceleration where the hardware allows it.
What number is acceptable on minimum-spec machines is Alek's call, to be
recorded in DOC-07.

### 9.5 Two pipeline rules, recorded (Alek's decision, binding for Phase 3)

1. **The model always works at its native 1024×1024.** The photo is shrunk
   to that for inference and the mask is scaled back up to the photo's
   size. Not optional, never shown to the user.
2. **Originals stay untouched in assets/images/ exactly as imported.** The
   cutout and the mask editor's working copy are made from a version capped
   at **4096 pixels on the long edge** (smaller photos are used as they
   are).

### 9.6 What the 4096 cap buys, and whether it is the right number

On a 48-megapixel phone photo (8000×6000):

| | Uncapped (8000×6000) | Capped (4096×3072) |
|---|---|---|
| Pixels | 48 MP | 12.6 MP (¼ of the work) |
| One RGBA copy in memory | 192 MB | 50 MB |
| Mask as floats in memory | 192 MB | 50 MB |
| Every per-pixel step (resize, composite, PNG encode/decode, editor brush) | 4× slower | baseline |

The model step is unchanged (it sees 1024×1024 either way), so the cap
costs **zero mask quality**; it only bounds the cutout's pixel resolution
and keeps a 48 MP import from ballooning worker and editor memory by
~150 MB per copy in flight.

**Is 4096 enough for a 2× camera zoom at 1080p?** Yes, with margin. A
cutout filling the full 1920×1080 frame at 2× zoom needs ≥3840×2160 source
pixels; the cap leaves 4096×3072 — enough on both axes (and ~2.8× zoom
head-room for a figure filling the frame *height*). **2048 would fail**
(only ~1.07× zoom for a frame-filling element) and **3072 would also fall
short of 2×** (3072 < 3840), so 4096 is the right cap — the smallest
power-of-two-ish step that satisfies the stated requirement. If a 4K export
ever arrives (not in v1), 2× zoom there would want ~7680 px; because the
untouched original is still in assets/images/, cutouts could be re-made
under a bigger cap without re-importing anything.

### 9.7 Status after round 2

Measured, recorded, **no ADR changed, nothing built past the gate.** The
remaining choice for Alek: adopt fp32-on-CPU (simplest; ~33 s here,
~12–25 s reference, model files 224 MB lite + 973 MB full), pursue int8
(fastest CPU option, adds an offline Python conversion step), and/or layer
DirectML on top for capable machines — plus the acceptable per-photo time
for minimum-spec machines, to record in DOC-07.
