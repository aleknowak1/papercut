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
