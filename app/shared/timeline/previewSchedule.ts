// previewSchedule (Phase 6, the heart of "what you hear is what exports"):
// given a scene, a start time, and the real length of every sound, it
// says which clips are audible from that moment — each with the offset
// into its source, how long it plays, and its gain envelope after trim,
// volume and fades. The Web Audio preview and the export mixer BOTH
// consume exactly these entries, so play and export cannot disagree.
//
// Pure arithmetic: no browser APIs, everything tested under plain Node.

import type { AudioClip, Scene } from '../document/types';

/** One point of a piecewise-linear gain envelope. */
export interface GainPoint {
  /** Seconds from this entry's own start (0 .. playSeconds). */
  readonly atSeconds: number;
  /** The gain right at that moment (volume with any fade applied). */
  readonly gain: number;
}

/** One clip as it should sound from the schedule's start time. */
export interface ScheduledClip {
  readonly clipId: string;
  readonly assetId: string;
  /** Seconds after the schedule's start before this clip begins (0 = already sounding). */
  readonly delaySeconds: number;
  /** How far into the decoded sound playback begins (trim + any part already elapsed). */
  readonly sourceOffsetSeconds: number;
  /** How long it plays from there (cut at the scene end). */
  readonly playSeconds: number;
  /**
   * The gain over the entry, as points to ramp linearly between; the gain
   * before the first and after the last point holds that point's value.
   */
  readonly gainPoints: readonly GainPoint[];
}

/** The clip's audio asset: direct, or a TTS line's cached render (Phase 11). */
function clipAssetId(clip: AudioClip): string | undefined {
  return clip.source.kind === 'asset' ? clip.source.assetId : clip.source.ttsLine.cachedAssetId;
}

/**
 * The gain at a moment of the clip (local seconds from the clip's own
 * start), from volume and the two fades over the clip's played length.
 * The fades are held inside the clip even if a hand-edited file claims
 * longer ones (the edits already enforce this; the clamp here keeps the
 * envelope honest for any document).
 */
function gainAt(
  local: number,
  playLength: number,
  volume: number,
  fadeIn: number,
  fadeOut: number
): number {
  let gain = volume;
  if (fadeIn > 0 && local < fadeIn) gain *= local / fadeIn;
  if (fadeOut > 0 && local > playLength - fadeOut) {
    gain *= Math.max(0, playLength - local) / fadeOut;
  }
  return gain;
}

/**
 * Which clips sound from `fromTime`, and exactly how. Clips whose sound
 * is unknown (a TTS line not yet generated, an asset with no measured
 * length) are skipped, not faked. Entries are ordered as the scene lists
 * them, so consumers are deterministic.
 */
export function previewSchedule(
  scene: Scene,
  fromTime: number,
  assetDurations: ReadonlyMap<string, number>
): ScheduledClip[] {
  const out: ScheduledClip[] = [];
  for (const clip of scene.audioClips) {
    const assetId = clipAssetId(clip);
    const sourceSeconds = assetId !== undefined ? assetDurations.get(assetId) : undefined;
    if (assetId === undefined || sourceSeconds === undefined || !(sourceSeconds > 0)) continue;

    // The clip's slice of its sound, clamped inside the sound's real extent.
    const trimStart = Math.min(Math.max(clip.trimStartSeconds ?? 0, 0), sourceSeconds);
    const playLength = Math.min(
      clip.durationSeconds ?? sourceSeconds - trimStart,
      sourceSeconds - trimStart
    );
    if (!(playLength > 0)) continue;

    // The audible window: from fromTime at the earliest, cut at the scene end.
    const clipStart = clip.startSeconds;
    const audibleStart = Math.max(clipStart, fromTime);
    const audibleEnd = Math.min(clipStart + playLength, scene.durationSeconds);
    if (!(audibleEnd > audibleStart)) continue;

    // Fades kept inside the played length even for hand-edited documents.
    const fadeIn = Math.min(Math.max(clip.fadeInSeconds, 0), playLength);
    const fadeOut = Math.min(Math.max(clip.fadeOutSeconds, 0), playLength - fadeIn);

    const elapsed = audibleStart - clipStart; // clip time already gone by fromTime
    const playSeconds = audibleEnd - audibleStart;

    // Envelope points at the entry's start and end, plus the fade corners
    // that fall strictly inside it, in clip-local time mapped to entry time.
    const locals = [elapsed, elapsed + playSeconds];
    for (const corner of [fadeIn, playLength - fadeOut]) {
      if (corner > elapsed && corner < elapsed + playSeconds) locals.push(corner);
    }
    locals.sort((a, b) => a - b);
    const gainPoints = locals.map((local) => ({
      atSeconds: local - elapsed,
      gain: gainAt(local, playLength, clip.volume, fadeIn, fadeOut)
    }));

    out.push({
      clipId: clip.id,
      assetId,
      delaySeconds: audibleStart - fromTime,
      sourceOffsetSeconds: trimStart + elapsed,
      playSeconds,
      gainPoints
    });
  }
  return out;
}
