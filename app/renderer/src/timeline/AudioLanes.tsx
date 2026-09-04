// The timeline's audio lanes (Phase 6 decisions g, h, k): every audio
// clip is a block with the sound's name and a waveform drawn from the
// session's decoded peaks; overlapping clips pack into separate lanes
// through the shared packLanes so nothing hides behind anything. A clip
// running past the scene end is drawn hatched from that point — export
// simply cuts it there.
//
// Editing (decision h): drag the body to move, drag either edge to trim,
// drag the small fade handles at the top corners to set the fades. Every
// gesture previews live and commits ONCE on release (one undo step,
// composed through the ready-made edits), Escape cancels. Dropping a ♪
// row from the Assets tab lands a new clip at the drop time through the
// same shared addSoundToTimeline the row's button uses.

import {
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type JSX,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { secondsOf } from '../../../shared/animation/time';
import {
  moveAudioClip,
  setAudioClipFadeIn,
  setAudioClipFadeOut,
  trimAudioClip
} from '../../../shared/document/edits';
import { addSoundToTimeline } from '../../../shared/timeline/addToTimeline';
import { packLanes, type LaneClip } from '../../../shared/timeline/lanes';
import { pixelToTime, timeToPixel } from '../../../shared/timeline/mapping';
import { snapDraggedTime, type SnapTarget } from '../../../shared/timeline/snap';
import type { AudioClip, ProjectDocument, Scene } from '../../../shared/document/types';
import { getDecodedSound, PEAKS_PER_SECOND, type CachedSound } from './audioCache';
import { readAudioDragAssetId, AUDIO_DRAG_TYPE } from './audioDrag';
import { TRACK_LABEL_PX } from './Timeline';

type ApplyEdit = (edit: (current: ProjectDocument) => ProjectDocument) => void;

/** Audio lanes are a little taller than keyframe rows: room for a waveform. */
export const AUDIO_ROW_HEIGHT_PX = 34;
/** How wide (in pixels) each clip edge's invisible trim grip is. */
const EDGE_GRIP_PX = 6;
const DRAG_THRESHOLD_PX = 3;

/** A clip as the lanes draw it: its resolved sound length and span. */
interface DrawnClip {
  readonly clip: AudioClip;
  readonly assetId: string;
  readonly name: string;
  /** The sound's full length (import measured it; decode confirms it). */
  readonly sourceSeconds: number;
  readonly trimStart: number;
  /** How long the clip plays (its visible width in seconds). */
  readonly playSeconds: number;
}

interface ClipDrag {
  readonly clipId: string;
  readonly mode: 'move' | 'trim-left' | 'trim-right' | 'fade-in' | 'fade-out';
  readonly startClientX: number;
  readonly moved: boolean;
  readonly snappedTo?: SnapTarget;
  /** The clip's committed values when the gesture began. */
  readonly orig: { start: number; trim: number; play: number; fadeIn: number; fadeOut: number };
  /** The live preview the gesture shows and will commit on release. */
  readonly preview: { start: number; trim: number; play: number; fadeIn: number; fadeOut: number };
}

export interface AudioLanesProps {
  readonly projectDir: string;
  readonly document: ProjectDocument;
  readonly scene: Scene;
  readonly zoom: number;
  readonly scrollSec: number;
  readonly trackWidthPx: number;
  readonly snapOn: boolean;
  readonly playhead: number;
  readonly selectedClipId?: string;
  readonly onSelectClip: (clipId: string | undefined) => void;
  readonly applyEdit: ApplyEdit;
  /** Pauses the preview when a gesture takes the lanes. */
  readonly onPause: () => void;
  /** Names what a live drag snapped to, shown in the timeline header. */
  readonly onSnapNote: (target: SnapTarget | undefined) => void;
}

export function AudioLanes(props: AudioLanesProps): JSX.Element {
  const {
    projectDir,
    document: doc,
    scene,
    zoom,
    scrollSec,
    trackWidthPx,
    snapOn,
    playhead,
    selectedClipId,
    onSelectClip,
    applyEdit,
    onPause,
    onSnapNote
  } = props;
  const fps = doc.fps;
  const duration = scene.durationSeconds;
  const minPlay = secondsOf(1, fps);

  const [drag, setDrag] = useState<ClipDrag | undefined>(undefined);
  // Decoded sounds arrive as they are ready; the waveforms fill in then.
  const [sounds, setSounds] = useState<ReadonlyMap<string, CachedSound>>(new Map());

  // The clips the lanes can draw: direct sound clips whose length is
  // known. TTS lines (Phase 11) have no sound yet and stay off the lanes.
  const drawn: DrawnClip[] = [];
  for (const clip of scene.audioClips) {
    const source = clip.source;
    if (source.kind !== 'asset') continue;
    const asset = doc.assets.find((a) => a.id === source.assetId && a.type === 'audio');
    if (asset === undefined) continue;
    const sourceSeconds =
      asset.metadata.durationSeconds ?? sounds.get(asset.id)?.durationSeconds;
    if (sourceSeconds === undefined || !(sourceSeconds > 0)) continue;
    const trimStart = Math.min(Math.max(clip.trimStartSeconds ?? 0, 0), sourceSeconds);
    const playSeconds = Math.min(
      clip.durationSeconds ?? sourceSeconds - trimStart,
      sourceSeconds - trimStart
    );
    if (!(playSeconds > 0)) continue;
    drawn.push({
      clip,
      assetId: asset.id,
      name: asset.metadata.originalFileName ?? asset.file.split('/').pop() ?? 'sound',
      sourceSeconds,
      trimStart,
      playSeconds
    });
  }

  // Decode (once per session) every sound the lanes show.
  useEffect(() => {
    for (const entry of drawn) {
      if (sounds.has(entry.assetId)) continue;
      const asset = doc.assets.find((a) => a.id === entry.assetId);
      if (asset === undefined) continue;
      void getDecodedSound(projectDir, asset).then((sound) => {
        setSounds((current) => {
          if (current.has(asset.id)) return current;
          const next = new Map(current);
          next.set(asset.id, sound);
          return next;
        });
      });
    }
    // drawn is derived from doc + sounds; doc covers the clip list.
  }, [doc, projectDir, sounds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lane packing from the COMMITTED document (a live move keeps its lane
  // until release; the commit repacks).
  const packing = packLanes(
    drawn.map(
      (d): LaneClip => ({
        id: d.clip.id,
        startSeconds: d.clip.startSeconds,
        endSeconds: d.clip.startSeconds + d.playSeconds
      })
    )
  );

  // ---- Gestures ----

  const withPreview = (d: DrawnClip): DrawnClip => {
    if (drag === undefined || !drag.moved || drag.clipId !== d.clip.id) return d;
    return {
      ...d,
      trimStart: drag.preview.trim,
      playSeconds: drag.preview.play,
      clip: {
        ...d.clip,
        startSeconds: drag.preview.start,
        fadeInSeconds: drag.preview.fadeIn,
        fadeOutSeconds: drag.preview.fadeOut
      }
    };
  };

  const beginDrag = (
    d: DrawnClip,
    mode: ClipDrag['mode'],
    event: ReactPointerEvent
  ): void => {
    event.stopPropagation();
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    onPause();
    setDrag({
      clipId: d.clip.id,
      mode,
      startClientX: event.clientX,
      moved: false,
      orig: {
        start: d.clip.startSeconds,
        trim: d.trimStart,
        play: d.playSeconds,
        fadeIn: d.clip.fadeInSeconds,
        fadeOut: d.clip.fadeOutSeconds
      },
      preview: {
        start: d.clip.startSeconds,
        trim: d.trimStart,
        play: d.playSeconds,
        fadeIn: d.clip.fadeInSeconds,
        fadeOut: d.clip.fadeOutSeconds
      }
    });
  };

  const onLanePointerMove = (event: ReactPointerEvent): void => {
    if (drag === undefined) return;
    const moved = drag.moved || Math.abs(event.clientX - drag.startClientX) >= DRAG_THRESHOLD_PX;
    if (!moved) return;
    const entry = drawn.find((d) => d.clip.id === drag.clipId);
    if (entry === undefined) return;
    const deltaSec = (event.clientX - drag.startClientX) / zoom;
    const { orig } = drag;
    // Magnets (decision d): the playhead, OTHER clips' edges, whole
    // seconds — whole frames always.
    const otherEdges: number[] = [duration];
    for (const other of drawn) {
      if (other.clip.id === drag.clipId) continue;
      otherEdges.push(other.clip.startSeconds, other.clip.startSeconds + other.playSeconds);
    }
    const snapAt = (raw: number): { time: number; target: SnapTarget } => {
      const result = snapDraggedTime(raw, fps, zoom, snapOn, {
        playhead,
        clipEdges: otherEdges
      });
      return { time: result.time, target: result.snappedTo };
    };

    let preview = drag.preview;
    let snappedTo: SnapTarget | undefined = drag.snappedTo;
    if (drag.mode === 'move') {
      const snapped = snapAt(Math.max(0, orig.start + deltaSec));
      preview = { ...preview, start: Math.max(0, snapped.time) };
      snappedTo = snapped.target;
    } else if (drag.mode === 'trim-left') {
      // The left edge moves; the sound stays anchored in time, so trim
      // grows exactly as much as the start does.
      const snapped = snapAt(orig.start + deltaSec);
      let delta = snapped.time - orig.start;
      delta = Math.max(delta, -orig.trim, -orig.start); // never before the sound or 0
      delta = Math.min(delta, orig.play - minPlay); // always a sliver left
      preview = {
        ...preview,
        start: orig.start + delta,
        trim: orig.trim + delta,
        play: orig.play - delta
      };
      snappedTo = snapped.target;
    } else if (drag.mode === 'trim-right') {
      const snapped = snapAt(orig.start + orig.play + deltaSec);
      let play = snapped.time - orig.start;
      play = Math.min(Math.max(play, minPlay), entry.sourceSeconds - orig.trim);
      preview = { ...preview, play };
      snappedTo = snapped.target;
    } else if (drag.mode === 'fade-in') {
      const fadeIn = Math.min(Math.max(orig.fadeIn + deltaSec, 0), orig.play - orig.fadeOut);
      preview = { ...preview, fadeIn };
      snappedTo = undefined;
    } else {
      const fadeOut = Math.min(Math.max(orig.fadeOut - deltaSec, 0), orig.play - orig.fadeIn);
      preview = { ...preview, fadeOut };
      snappedTo = undefined;
    }
    setDrag({ ...drag, moved: true, preview, snappedTo });
    onSnapNote(snappedTo === undefined || snappedTo === 'frame' ? undefined : snappedTo);
  };

  const onLanePointerUp = (): void => {
    if (drag === undefined) return;
    const finished = drag;
    setDrag(undefined);
    onSnapNote(undefined);
    if (!finished.moved) {
      onSelectClip(finished.clipId); // a plain click selects the clip
      return;
    }
    const entry = drawn.find((d) => d.clip.id === finished.clipId);
    if (entry === undefined) return;
    const { orig, preview } = finished;
    const sceneId = scene.id;
    const clipId = finished.clipId;
    // ONE undo step per gesture: the whole change is one composed edit.
    if (finished.mode === 'move' && preview.start !== orig.start) {
      applyEdit((current) => moveAudioClip(current, sceneId, clipId, preview.start));
    } else if (
      (finished.mode === 'trim-left' || finished.mode === 'trim-right') &&
      (preview.start !== orig.start || preview.trim !== orig.trim || preview.play !== orig.play)
    ) {
      applyEdit((current) =>
        trimAudioClip(
          moveAudioClip(current, sceneId, clipId, preview.start),
          sceneId,
          clipId,
          preview.trim,
          preview.play,
          entry.sourceSeconds
        )
      );
    } else if (finished.mode === 'fade-in' && preview.fadeIn !== orig.fadeIn) {
      applyEdit((current) =>
        setAudioClipFadeIn(current, sceneId, clipId, preview.fadeIn, entry.playSeconds)
      );
    } else if (finished.mode === 'fade-out' && preview.fadeOut !== orig.fadeOut) {
      applyEdit((current) =>
        setAudioClipFadeOut(current, sceneId, clipId, preview.fadeOut, entry.playSeconds)
      );
    }
  };

  // Escape cancels a live gesture before App's own Escape handling runs
  // (capture phase, the CL-0032 pattern): the preview vanishes, no edit.
  useEffect(() => {
    if (drag === undefined) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setDrag(undefined);
      onSnapNote(undefined);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [drag, onSnapNote]);

  // ---- Dropping a ♪ row onto the lanes (decision h) ----

  const onDragOver = (event: ReactDragEvent<HTMLDivElement>): void => {
    if (event.dataTransfer.types.includes(AUDIO_DRAG_TYPE)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  };
  const onDrop = (event: ReactDragEvent<HTMLDivElement>): void => {
    const assetId = readAudioDragAssetId(event.dataTransfer);
    if (assetId === undefined) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const at = pixelToTime(event.clientX - rect.left - TRACK_LABEL_PX, zoom, scrollSec);
    let clipId: string | undefined;
    applyEdit((current) => {
      const added = addSoundToTimeline(current, scene.id, assetId, at);
      clipId = added?.clipId;
      return added?.doc ?? current;
    });
    if (clipId !== undefined) onSelectClip(clipId);
  };

  // ---- Drawing ----

  const laneCount = drawn.length > 0 ? packing.laneCount : 0;
  const mid = AUDIO_ROW_HEIGHT_PX / 2;

  const clipBlock = (d0: DrawnClip): JSX.Element => {
    const d = withPreview(d0);
    const clip = d.clip;
    const x0 = timeToPixel(clip.startSeconds, zoom, scrollSec);
    const x1 = timeToPixel(clip.startSeconds + d.playSeconds, zoom, scrollSec);
    const width = Math.max(2, x1 - x0);
    const selected = clip.id === selectedClipId;
    const sound = sounds.get(d.assetId);

    // The waveform: one vertical stroke every 2 px from the session peaks.
    let wavePath = '';
    if (sound !== undefined) {
      const maxHalf = mid - 5;
      for (let px = 1; px < width - 1; px += 2) {
        const sourceAt = d.trimStart + px / zoom;
        const peak = sound.peaks[Math.floor(sourceAt * PEAKS_PER_SECOND)] ?? 0;
        const half = Math.max(0.5, peak * maxHalf);
        wavePath += `M${(x0 + px).toFixed(1)} ${(mid - half).toFixed(1)}V${(mid + half).toFixed(1)}`;
      }
    }

    // Hatch the part past the scene end (export cuts it there).
    const endPx = timeToPixel(duration, zoom, scrollSec);
    const overhang = x1 > endPx ? Math.min(width, x1 - Math.max(x0, endPx)) : 0;

    const fadeInPx = clip.fadeInSeconds * zoom;
    const fadeOutPx = clip.fadeOutSeconds * zoom;
    const clipPathId = `tlclip-${clip.id}`;

    return (
      <g key={clip.id} className={selected ? 'tl-clip tl-clip-selected' : 'tl-clip'}>
        <clipPath id={clipPathId}>
          <rect x={x0} y={2} width={width} height={AUDIO_ROW_HEIGHT_PX - 4} rx={3} />
        </clipPath>
        <rect
          className="tl-clip-body"
          x={x0}
          y={2}
          width={width}
          height={AUDIO_ROW_HEIGHT_PX - 4}
          rx={3}
          onPointerDown={(event) => beginDrag(d0, 'move', event)}
        >
          <title>{`${d.name} — drag to move, drag an edge to trim, corners to fade`}</title>
        </rect>
        <g clipPath={`url(#${clipPathId})`} className="tl-clip-inner">
          {wavePath !== '' && <path className="tl-clip-wave" d={wavePath} />}
          {overhang > 0 && (
            <rect
              className="tl-clip-overhang"
              x={Math.max(x0, endPx)}
              y={2}
              width={overhang}
              height={AUDIO_ROW_HEIGHT_PX - 4}
              fill="url(#tl-hatch)"
            />
          )}
          {fadeInPx > 0 && (
            <path
              className="tl-clip-fade"
              d={`M${x0} ${AUDIO_ROW_HEIGHT_PX - 2}L${x0 + fadeInPx} 2`}
            />
          )}
          {fadeOutPx > 0 && (
            <path
              className="tl-clip-fade"
              d={`M${x1} ${AUDIO_ROW_HEIGHT_PX - 2}L${x1 - fadeOutPx} 2`}
            />
          )}
          <text className="tl-clip-name" x={x0 + fadeInPx + 5} y={mid + 3.5}>
            {d.name}
          </text>
        </g>
        {/* The grips: edges trim, the top corners set the fades. */}
        <rect
          className="tl-clip-grip"
          x={x0 - 1}
          y={2}
          width={EDGE_GRIP_PX}
          height={AUDIO_ROW_HEIGHT_PX - 4}
          onPointerDown={(event) => beginDrag(d0, 'trim-left', event)}
        >
          <title>Trim the start</title>
        </rect>
        <rect
          className="tl-clip-grip"
          x={x1 - EDGE_GRIP_PX + 1}
          y={2}
          width={EDGE_GRIP_PX}
          height={AUDIO_ROW_HEIGHT_PX - 4}
          onPointerDown={(event) => beginDrag(d0, 'trim-right', event)}
        >
          <title>Trim the end</title>
        </rect>
        <circle
          className="tl-clip-fade-handle"
          cx={x0 + fadeInPx}
          cy={5}
          r={4}
          onPointerDown={(event) => beginDrag(d0, 'fade-in', event)}
        >
          <title>Fade in — drag sideways</title>
        </circle>
        <circle
          className="tl-clip-fade-handle"
          cx={x1 - fadeOutPx}
          cy={5}
          r={4}
          onPointerDown={(event) => beginDrag(d0, 'fade-out', event)}
        >
          <title>Fade out — drag sideways</title>
        </circle>
      </g>
    );
  };

  return (
    <div
      className="tl-lanes"
      onDragOver={onDragOver}
      onDrop={onDrop}
      onPointerMove={onLanePointerMove}
      onPointerUp={onLanePointerUp}
      onPointerCancel={() => {
        setDrag(undefined);
        onSnapNote(undefined);
      }}
    >
      {/* The hatch pattern, defined once for every lane to reference. */}
      <svg width={0} height={0} aria-hidden="true" style={{ position: 'absolute' }}>
        <defs>
          <pattern id="tl-hatch" width={6} height={6} patternUnits="userSpaceOnUse">
            <path d="M0 6L6 0" className="tl-hatch-line" />
          </pattern>
        </defs>
      </svg>
      {Array.from({ length: laneCount }, (_, lane) => (
        <div className="tl-row tl-lane" key={lane}>
          <span className="tl-row-label">{lane === 0 ? 'Sound' : ''}</span>
          <svg
            className="tl-row-track"
            width={trackWidthPx}
            height={AUDIO_ROW_HEIGHT_PX}
            role="presentation"
            onPointerDown={() => onSelectClip(undefined)}
          >
            {drawn
              .filter((d) => packing.laneOf.get(d.clip.id) === lane)
              .map((d) => clipBlock(d))}
          </svg>
        </div>
      ))}
      <div className="tl-row tl-lane tl-lane-hint">
        <span className="tl-row-label">{laneCount === 0 ? 'Sound' : ''}</span>
        <span className="tl-lane-hint-text">
          {laneCount === 0
            ? 'Drop a sound here, or press “Add to timeline” on a ♪ row in the Assets tab.'
            : ''}
        </span>
      </div>
    </div>
  );
}
