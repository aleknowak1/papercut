// The Web Audio preview (Phase 6 decision i; Phase 7 decision k): on
// play, the WHOLE RUN's sound is scheduled ONCE — projectSchedule's
// entries (every scene's previewSchedule shifted by its global start)
// through one AudioBufferSourceNode + GainNode per clip: trim as the
// source offset and played length, volume and fades as the gain
// envelope. The scene switch at a transition is UI state and never comes
// back here, so nothing restarts at a boundary. Pause, the end of the
// last scene, or any edit stops sound at once; scrubbing never comes
// here at all.
//
// projectSchedule is the SAME translation of the document the export
// mixer renders sample-for-sample (CL-0068/0070), and the sounds come
// from the SAME once-per-session decode cache the waveforms use — so
// what plays is what exports, by construction.

import { projectSchedule } from '../../../shared/timeline/projectSchedule';
import type { ProjectDocument } from '../../../shared/document/types';
import { getDecodedSound, type CachedSound } from './audioCache';

export interface PreviewPlayer {
  /** Silences and forgets everything this play scheduled. */
  readonly stop: () => void;
}

// One AudioContext for the whole session (contexts are a limited
// resource); it keeps running between plays, which costs nothing.
let sharedContext: AudioContext | undefined;
function audioContext(): AudioContext {
  sharedContext ??= new AudioContext();
  return sharedContext;
}

// Each decoded sound becomes an AudioBuffer once; replays reuse it.
const bufferCache = new Map<string, AudioBuffer>();
function bufferFor(context: AudioContext, assetKey: string, sound: CachedSound): AudioBuffer {
  let buffer = bufferCache.get(assetKey);
  if (buffer === undefined) {
    buffer = context.createBuffer(1, sound.samples.length, sound.sampleRate);
    buffer.copyToChannel(new Float32Array(sound.samples), 0);
    bufferCache.set(assetKey, buffer);
  }
  return buffer;
}

/** The audio assets ANY scene's clips point at, each at most once. */
function projectAudioAssets(doc: ProjectDocument): Map<string, string> {
  const files = new Map<string, string>(); // asset id → file
  for (const scene of doc.scenes) {
    for (const clip of scene.audioClips) {
      const source = clip.source;
      if (source.kind !== 'asset') continue;
      const asset = doc.assets.find((a) => a.id === source.assetId && a.type === 'audio');
      if (asset !== undefined) files.set(asset.id, asset.file);
    }
  }
  return files;
}

/**
 * Starts the audio for a preview playing from the GLOBAL time
 * `fromGlobalTime` — every scene still to come, in one schedule. Returns
 * at once; the sound joins as soon as every needed clip is decoded
 * (already instant when the lanes have drawn their waveforms — the cache
 * is shared). Call stop() when the preview pauses or ends.
 */
export function startAudioPreview(
  projectDir: string,
  doc: ProjectDocument,
  fromGlobalTime: number
): PreviewPlayer {
  const context = audioContext();
  let stopped = false;
  const started: AudioBufferSourceNode[] = [];
  const startedAt = context.currentTime;
  if (context.state === 'suspended') void context.resume();

  const assets = projectAudioAssets(doc);
  const decodes = [...assets.keys()].map(async (assetId) => {
    const asset = doc.assets.find((a) => a.id === assetId);
    if (asset === undefined) return undefined;
    // A sound that cannot be decoded simply stays silent in the preview
    // (import already refused unreadable files; this guards damage since).
    const sound = await getDecodedSound(projectDir, asset).catch(() => undefined);
    return sound === undefined ? undefined : ([assetId, sound] as const);
  });

  void Promise.all(decodes).then((entries) => {
    if (stopped) return;
    const durations = new Map<string, number>();
    const sounds = new Map<string, CachedSound>();
    for (const entry of entries) {
      if (entry === undefined) continue;
      durations.set(entry[0], entry[1].durationSeconds);
      sounds.set(entry[0], entry[1]);
    }
    // Time kept by the audio clock: however long the decodes took, the
    // schedule starts from where the (already running) playhead now is.
    const elapsed = context.currentTime - startedAt;
    const schedule = projectSchedule(doc, fromGlobalTime + elapsed, durations);
    const base = context.currentTime;
    for (const entry of schedule) {
      const sound = sounds.get(entry.assetId);
      const file = assets.get(entry.assetId);
      if (sound === undefined || file === undefined) continue;
      const source = context.createBufferSource();
      source.buffer = bufferFor(context, `${entry.assetId}:${file}`, sound);
      const gain = context.createGain();
      const at = base + entry.delaySeconds;
      const first = entry.gainPoints[0];
      gain.gain.setValueAtTime(first?.gain ?? 1, at);
      for (const point of entry.gainPoints.slice(1)) {
        gain.gain.linearRampToValueAtTime(point.gain, at + point.atSeconds);
      }
      source.connect(gain).connect(context.destination);
      source.start(at, entry.sourceOffsetSeconds, entry.playSeconds);
      started.push(source);
    }
    if (import.meta.env.DEV) {
      // Dev-only breadcrumb so the scripted live checks can see what the
      // preview scheduled; never read by the app itself.
      (window as { __papercutPreview?: unknown }).__papercutPreview = {
        scheduled: schedule.length,
        contextState: context.state,
        fromGlobalTime: fromGlobalTime + elapsed
      };
    }
  });

  return {
    stop: (): void => {
      stopped = true;
      for (const source of started) {
        try {
          source.stop();
          source.disconnect();
        } catch {
          // Already ended; silence is silence.
        }
      }
      started.length = 0;
      if (import.meta.env.DEV) {
        (window as { __papercutPreview?: { stopped?: boolean } }).__papercutPreview = {
          ...(window as { __papercutPreview?: object }).__papercutPreview,
          stopped: true
        };
      }
    }
  };
}
