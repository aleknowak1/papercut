// The timeline panel (Phase 6, M-1.3): replaces the time strip (decision
// a — one component, not two). A header row carries the strip's transport
// (play/pause, frame steps, keyframe jumps, readout, Duration) plus the
// Snap toggle and the zoom slider; under it a ruler with the draggable
// playhead, then the tracks — one Camera row, then one row per layer in
// Layers-panel order (front-most at the top; the background has no row),
// each showing its keyframes as diamonds (decision n). The audio lanes
// join in the next step.
//
// Drawn with React/SVG (decision b): PixiJS stays reserved for the
// picture; sceneStage does not change. All time↔pixel arithmetic comes
// from app/shared/timeline/mapping.ts and snapping from snap.ts, both
// already tested as arithmetic; this file only draws what they compute.
//
// Play is a PREVIEW only, exactly as the strip's was: a
// requestAnimationFrame loop advances the playhead by the wall clock,
// snapped to whole frames; nothing is written to the document, and it
// stops at the scene end. The playhead is UI state owned by the project
// view — not saved, not undoable, like selection. Any scrub or document
// edit pauses playback. The view pages along with the playhead during
// play (decision e).
//
// Dragging a keyframe diamond moves it in time: live ghost while the
// mouse is down, ONE undo step on release through moveKeyframe /
// moveCameraKeyframe, Escape cancels, and a frame that already holds a
// keyframe refuses the drop — the ghost stops beside it (decision c).

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from 'react';
import { formatTime, frameOf, secondsOf, snapToFrame } from '../../../shared/animation/time';
import {
  moveCameraKeyframe,
  moveKeyframe,
  setSceneDuration
} from '../../../shared/document/edits';
import {
  clampScroll,
  clampZoom,
  fitZoom,
  MAX_ZOOM_PX_PER_SECOND,
  pixelToTime,
  rulerStepSeconds,
  scrollToFollowPlayhead,
  timeToPixel
} from '../../../shared/timeline/mapping';
import { snapDraggedTime, type SnapTarget } from '../../../shared/timeline/snap';
import { effectiveTransitionSeconds } from '../../../shared/timeline/projectTime';
import type { ProjectDocument, Scene } from '../../../shared/document/types';
import { AudioLanes } from './AudioLanes';
import { startAudioPreview } from './previewPlayer';

type ApplyEdit = (edit: (current: ProjectDocument) => ProjectDocument) => void;

export const MIN_SCENE_SECONDS = 1;
export const MAX_SCENE_SECONDS = 120;

/** The fixed height of one track row, label and diamonds alike. */
export const ROW_HEIGHT_PX = 24;
/** The width of the name column to the left of every track. */
export const TRACK_LABEL_PX = 96;
/** How far the mouse must move before a diamond press becomes a drag. */
const DRAG_THRESHOLD_PX = 3;

export interface TimelineProps {
  readonly projectDir: string;
  readonly document: ProjectDocument;
  readonly scene: Scene;
  readonly selectedLayerId?: string;
  /** Camera mode: «» jumps follow the camera; the camera row reads selected. */
  readonly cameraMode: boolean;
  /** The playhead in seconds, frame-snapped; the timeline only emits snapped values. */
  readonly playhead: number;
  readonly onPlayhead: (seconds: number) => void;
  readonly applyEdit: ApplyEdit;
  /** Clicking a layer's diamond selects that layer (and leaves camera mode). */
  readonly onSelectLayer: (layerId: string) => void;
  /** Clicking a camera diamond enters camera mode (and deselects the layer). */
  readonly onEnterCameraMode: () => void;
  /** The selected sound clip (UI state owned by the project view). */
  readonly selectedClipId?: string;
  readonly onSelectClip: (clipId: string | undefined) => void;
}

/** What a drag in progress looks like, for the ghost and the snap note. */
interface DiamondDrag {
  readonly kind: 'camera' | 'layer';
  readonly layerId?: string;
  readonly fromTime: number;
  /** Where the ghost sits right now (last position not refused). */
  readonly previewTime: number;
  readonly snappedTo: SnapTarget;
  /** Becomes true once the pointer has moved past the click threshold. */
  readonly moved: boolean;
  readonly startClientX: number;
}

const SNAP_TARGET_NAMES: Record<SnapTarget, string> = {
  frame: 'a frame',
  playhead: 'the playhead',
  keyframe: 'a keyframe',
  'clip-edge': 'a clip edge',
  second: 'a whole second'
};

/** A short ruler label: 2.5s under a minute, m:ss from there. */
function rulerLabel(seconds: number): string {
  if (seconds < 60) {
    const text = Number(seconds.toFixed(2));
    return `${text}s`;
  }
  const mins = Math.floor(seconds / 60);
  const rest = Math.round(seconds - mins * 60);
  return `${mins}:${String(rest).padStart(2, '0')}`;
}

/** One track row's diamonds; memoised so scrubbing never redraws rows. */
const TrackRow = memo(function TrackRow({
  label,
  kind,
  layerId,
  keyframes,
  selected,
  zoom,
  scrollSec,
  trackWidthPx,
  drag,
  onDiamondDown
}: {
  readonly label: string;
  readonly kind: 'camera' | 'layer';
  readonly layerId?: string;
  /** The layer's (or camera's) own keyframe list, passed by reference so
   *  an untouched row never re-renders (structural sharing keeps it stable). */
  readonly keyframes: ReadonlyArray<{ readonly time: number }>;
  readonly selected: boolean;
  readonly zoom: number;
  readonly scrollSec: number;
  readonly trackWidthPx: number;
  /** Only set on the row whose diamond is being dragged. */
  readonly drag?: DiamondDrag;
  readonly onDiamondDown: (
    kind: 'camera' | 'layer',
    layerId: string | undefined,
    time: number,
    event: ReactPointerEvent
  ) => void;
}): JSX.Element {
  const mid = ROW_HEIGHT_PX / 2;
  const half = 5; // the diamond's half-width in pixels
  const visibleFrom = scrollSec - half / zoom;
  const visibleTo = scrollSec + (trackWidthPx + half) / zoom;
  const diamond = (t: number): string => {
    const x = timeToPixel(t, zoom, scrollSec);
    return `${x},${mid - half} ${x + half},${mid} ${x},${mid + half} ${x - half},${mid}`;
  };
  const dragging = drag !== undefined && drag.moved;
  return (
    <div className={`tl-row${selected ? ' tl-row-selected' : ''}`} data-track={layerId ?? 'camera'}>
      <span className={`tl-row-label${kind === 'camera' ? ' tl-row-label-camera' : ''}`}>
        {label}
      </span>
      <svg
        className="tl-row-track"
        width={trackWidthPx}
        height={ROW_HEIGHT_PX}
        role="presentation"
      >
        {keyframes
          .map((k) => k.time)
          .filter((t) => t >= visibleFrom && t <= visibleTo)
          .map((t) => {
            const isDragged = dragging && t === drag.fromTime;
            return (
              <polygon
                key={t}
                className={`tl-diamond${isDragged ? ' tl-diamond-lifted' : ''}`}
                points={diamond(t)}
                onPointerDown={(event) => onDiamondDown(kind, layerId, t, event)}
              >
                <title>{`Keyframe at ${formatTime(t)} — click to edit, drag to move in time`}</title>
              </polygon>
            );
          })}
        {dragging && (
          <polygon className="tl-diamond tl-diamond-ghost" points={diamond(drag.previewTime)} />
        )}
      </svg>
    </div>
  );
});

export function Timeline(props: TimelineProps): JSX.Element {
  const {
    projectDir,
    document: doc,
    scene,
    selectedLayerId,
    cameraMode,
    playhead,
    onPlayhead,
    applyEdit,
    onSelectLayer,
    onEnterCameraMode,
    selectedClipId,
    onSelectClip
  } = props;
  const fps = doc.fps;
  const duration = scene.durationSeconds;
  const frame = frameOf(playhead, fps);
  const lastFrame = frameOf(duration, fps);

  const [playing, setPlaying] = useState(false);
  const [durationText, setDurationText] = useState<string | undefined>(undefined);
  // The Snap toggle (decision d): frames always; extras on by default.
  const [snapOn, setSnapOn] = useState(true);
  // undefined = "whole scene fits" until the user zooms (decision e).
  const [zoomRaw, setZoomRaw] = useState<number | undefined>(undefined);
  const [scrollRaw, setScrollRaw] = useState(0);
  const [drag, setDrag] = useState<DiamondDrag | undefined>(undefined);
  // What a live CLIP drag snapped to, reported by the audio lanes.
  const [laneSnapTarget, setLaneSnapTarget] = useState<SnapTarget | undefined>(undefined);
  // The width of the track area, measured whenever the panel resizes.
  const [trackWidthPx, setTrackWidthPx] = useState(0);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const body = bodyRef.current;
    if (body === null) return;
    const measure = (): void =>
      setTrackWidthPx(Math.max(0, body.clientWidth - TRACK_LABEL_PX));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, []);

  // The effective zoom and scroll, always kept inside their bounds.
  const zoom =
    trackWidthPx > 0
      ? clampZoom(zoomRaw ?? fitZoom(trackWidthPx, duration), trackWidthPx, duration)
      : 1;
  const scrollSec = trackWidthPx > 0 ? clampScroll(scrollRaw, zoom, trackWidthPx, duration) : 0;

  // Fresh values for the play loop without restarting it every frame.
  const liveRef = useRef({ playhead, duration, fps, onPlayhead, zoom, trackWidthPx });
  liveRef.current = { playhead, duration, fps, onPlayhead, zoom, trackWidthPx };

  // The preview loop: wall clock in, frame-snapped playhead out; the view
  // pages along so the playhead stays visible (decision e). The sound
  // rides along through Web Audio (decision i) and stops the instant the
  // preview does — pause, the scene end, or any document edit.
  useEffect(() => {
    if (!playing) return;
    const live = liveRef.current;
    // Play at the end starts over from the beginning.
    const from = live.playhead >= live.duration ? 0 : live.playhead;
    const audio = startAudioPreview(projectDir, doc, scene, from);
    const startWall = performance.now();
    let raf = 0;
    const tick = (now: number): void => {
      const t = from + (now - startWall) / 1000;
      const { duration: end, fps: rate, onPlayhead: emit, zoom: z, trackWidthPx: w } =
        liveRef.current;
      const follow = (at: number): void => {
        if (w > 0) setScrollRaw((s) => scrollToFollowPlayhead(s, at, z, w, end));
      };
      if (t >= end) {
        const final = secondsOf(frameOf(end, rate), rate);
        emit(final);
        follow(final);
        setPlaying(false);
        return;
      }
      const snapped = snapToFrame(t, rate);
      emit(snapped);
      follow(snapped);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      audio.stop();
    };
    // doc and scene are read once per play; any edit pauses (the effect
    // below), so a stale closure can never play stale sound.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Any document edit (including undo/redo) pauses the preview.
  useEffect(() => {
    setPlaying(false);
  }, [doc]);

  const pauseOnly = useCallback((): void => setPlaying(false), []);

  const pauseAndGo = useCallback(
    (seconds: number): void => {
      setPlaying(false);
      onPlayhead(snapToFrame(Math.min(Math.max(seconds, 0), duration), fps));
    },
    [onPlayhead, duration, fps]
  );

  const stepFrames = (by: number): void => {
    setPlaying(false);
    const next = Math.min(Math.max(frame + by, 0), lastFrame);
    onPlayhead(secondsOf(next, fps));
  };

  // Space plays/pauses; , and . step one frame — unless typing in a field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.key === ' ') {
        event.preventDefault();
        setPlaying((was) => !was);
      } else if (event.key === ',') {
        event.preventDefault();
        stepFrames(-1);
      } else if (event.key === '.') {
        event.preventDefault();
        stepFrames(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Whose keyframes the «» jumps follow: the camera in camera mode, the
  // selected layer otherwise. Both lists are kept sorted by the edits.
  const selectedLayer =
    selectedLayerId !== undefined
      ? scene.layers.find((l) => l.id === selectedLayerId)
      : undefined;
  const jumpTimes = cameraMode
    ? scene.cameraKeyframes.map((k) => k.time)
    : (selectedLayer?.keyframes.map((k) => k.time) ?? []);
  let prevTime: number | undefined;
  for (const t of jumpTimes) if (t < playhead) prevTime = t;
  const nextTime = jumpTimes.find((t) => t > playhead);

  const commitDuration = (): void => {
    if (durationText === undefined) return;
    setDurationText(undefined);
    const parsed = Number(durationText);
    if (!Number.isFinite(parsed)) return; // not a number: the field snaps back
    const next = snapToFrame(
      Math.min(Math.max(parsed, MIN_SCENE_SECONDS), MAX_SCENE_SECONDS),
      fps
    );
    if (next === duration) return;
    applyEdit((current) => setSceneDuration(current, scene.id, next));
  };

  // ---- Scrubbing on the ruler (frame-snapped, silent) ----

  const scrubTo = useCallback(
    (clientX: number, ruler: Element): void => {
      const left = ruler.getBoundingClientRect().left;
      pauseAndGo(pixelToTime(clientX - left, zoom, scrollSec));
    },
    [pauseAndGo, zoom, scrollSec]
  );

  const onRulerPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    scrubTo(event.clientX, event.currentTarget);
  };
  const onRulerPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      scrubTo(event.clientX, event.currentTarget);
    }
  };

  // ---- Zoom (Ctrl+wheel and the slider) and horizontal scroll ----

  const setZoomKeepingTime = (nextZoom: number, atSeconds: number, atPixel: number): void => {
    const clamped = clampZoom(nextZoom, trackWidthPx, duration);
    setZoomRaw(clamped);
    setScrollRaw(clampScroll(atSeconds - atPixel / clamped, clamped, trackWidthPx, duration));
  };

  const onBodyWheel = (event: ReactWheelEvent<HTMLDivElement>): void => {
    if (trackWidthPx <= 0) return;
    if (event.ctrlKey) {
      // Zoom centred on the cursor: the time under it stays put.
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const x = Math.max(0, event.clientX - rect.left - TRACK_LABEL_PX);
      const at = pixelToTime(x, zoom, scrollSec);
      setZoomKeepingTime(zoom * (event.deltaY < 0 ? 1.2 : 1 / 1.2), at, x);
      return;
    }
    // Shift+wheel (or a sideways wheel) scrolls horizontally; a plain
    // wheel does too unless the rows themselves have room to scroll
    // vertically — then the browser's own vertical scroll runs.
    const rows = event.currentTarget.querySelector('.tl-rows');
    const rowsCanScroll = rows !== null && rows.scrollHeight > rows.clientHeight;
    const delta = event.deltaX !== 0 ? event.deltaX : event.deltaY;
    if (event.shiftKey || event.deltaX !== 0 || !rowsCanScroll) {
      event.preventDefault();
      setScrollRaw((s) => clampScroll(s + delta / zoom, zoom, trackWidthPx, duration));
    }
  };

  // The zoom slider runs on a log scale so both ends feel usable.
  const minZoom = trackWidthPx > 0 ? Math.min(fitZoom(trackWidthPx, duration), MAX_ZOOM_PX_PER_SECOND) : 1;
  const zoomSpan = MAX_ZOOM_PX_PER_SECOND / minZoom;
  const zoomSliderValue =
    zoomSpan > 1 ? Math.round((Math.log(zoom / minZoom) / Math.log(zoomSpan)) * 100) : 100;
  const onZoomSlider = (value: number): void => {
    if (trackWidthPx <= 0) return;
    const nextZoom = minZoom * Math.pow(zoomSpan, value / 100);
    // Keep the playhead put when visible, else the view's left edge.
    const playheadPx = timeToPixel(playhead, zoom, scrollSec);
    if (playheadPx >= 0 && playheadPx <= trackWidthPx) {
      setZoomKeepingTime(nextZoom, playhead, playheadPx);
    } else {
      setZoomKeepingTime(nextZoom, scrollSec, 0);
    }
  };

  // ---- Dragging a keyframe diamond (decision c) ----

  const onDiamondDown = useCallback(
    (
      kind: 'camera' | 'layer',
      layerId: string | undefined,
      time: number,
      event: ReactPointerEvent
    ): void => {
      event.stopPropagation();
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
      setPlaying(false);
      setDrag({
        kind,
        layerId,
        fromTime: time,
        previewTime: time,
        snappedTo: 'frame',
        moved: false,
        startClientX: event.clientX
      });
    },
    []
  );

  const onDiamondMove = (event: ReactPointerEvent): void => {
    if (drag === undefined) return;
    const moved =
      drag.moved || Math.abs(event.clientX - drag.startClientX) >= DRAG_THRESHOLD_PX;
    if (!moved) return;
    // Where the pointer is, as a time: the diamond rides the cursor.
    const rawDelta = (event.clientX - drag.startClientX) / zoom;
    const raw = Math.min(Math.max(drag.fromTime + rawDelta, 0), duration);
    // Other keyframes of the SAME track are magnets (decision d) — and a
    // frame that already holds one refuses the drop (decision c), so a
    // snap onto one simply holds the ghost where it last stood.
    const trackTimes = (
      drag.kind === 'camera'
        ? scene.cameraKeyframes.map((k) => k.time)
        : (scene.layers.find((l) => l.id === drag.layerId)?.keyframes.map((k) => k.time) ?? [])
    ).filter((t) => t !== drag.fromTime);
    const snapped = snapDraggedTime(raw, fps, zoom, snapOn, {
      playhead,
      keyframeTimes: trackTimes,
      clipEdges: clipEdgeTimes
    });
    const occupied = trackTimes.some((t) => t === snapToFrame(snapped.time, fps));
    setDrag({
      ...drag,
      moved: true,
      previewTime: occupied ? drag.previewTime : snapped.time,
      snappedTo: occupied ? drag.snappedTo : snapped.snappedTo
    });
  };

  const onDiamondUp = (): void => {
    if (drag === undefined) return;
    const finished = drag;
    setDrag(undefined);
    if (!finished.moved) {
      // A plain click: select the track and put the playhead on the keyframe.
      if (finished.kind === 'camera') onEnterCameraMode();
      else if (finished.layerId !== undefined) onSelectLayer(finished.layerId);
      pauseAndGo(finished.fromTime);
      return;
    }
    if (finished.previewTime === finished.fromTime) return; // went nowhere
    // ONE undo step; the edit snaps and refuses occupied frames itself.
    applyEdit((current) =>
      finished.kind === 'camera'
        ? moveCameraKeyframe(current, scene.id, finished.fromTime, finished.previewTime)
        : finished.layerId !== undefined
          ? moveKeyframe(current, scene.id, finished.layerId, finished.fromTime, finished.previewTime)
          : current
    );
  };

  // Escape cancels a live drag before App's own Escape handling runs
  // (capture phase, the CL-0032 pattern): the ghost vanishes, no edit.
  useEffect(() => {
    if (drag === undefined) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setDrag(undefined);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [drag]);

  // ---- The ruler's labels and the playhead line ----

  const rulerMarks: number[] = [];
  if (trackWidthPx > 0) {
    const step = rulerStepSeconds(zoom, 60);
    for (
      let t = Math.ceil(scrollSec / step) * step;
      t <= Math.min(scrollSec + trackWidthPx / zoom, duration) + 1e-9;
      t += step
    ) {
      rulerMarks.push(Number(t.toFixed(6)));
    }
  }
  const playheadPx = timeToPixel(playhead, zoom, scrollSec);
  const playheadVisible = playheadPx >= 0 && playheadPx <= trackWidthPx;

  // The transition windows (Phase 7 decision l): the ruler tints the
  // transition-IN window at the scene's start (shared with the previous
  // scene) and the transition-OUT window at its end (shared with the
  // next). Lengths come from the one tested function; the readout and
  // everything else stay local to this scene.
  const sceneIndex = doc.scenes.findIndex((s) => s.id === scene.id);
  const transitionInSeconds = effectiveTransitionSeconds(doc, sceneIndex - 1);
  const transitionOutSeconds = effectiveTransitionSeconds(doc, sceneIndex);
  const tints: { key: string; fromSec: number; toSec: number; title: string }[] = [];
  if (transitionInSeconds > 0) {
    tints.push({
      key: 'in',
      fromSec: 0,
      toSec: transitionInSeconds,
      title: 'Transition in: the previous scene is still finishing over these frames'
    });
  }
  if (transitionOutSeconds > 0) {
    tints.push({
      key: 'out',
      fromSec: duration - transitionOutSeconds,
      toSec: duration,
      title: 'Transition out: the next scene is already starting under these frames'
    });
  }

  // Front-most layer at the top, as the Layers panel lists them
  // (the document's layers[0] is at the back); the camera row above all.
  const layerRows = [...scene.layers].reverse();

  // Sound-clip edges are magnets for every drag (decision d): each clip's
  // start and end (its played slice) plus the scene's own end.
  const clipEdgeTimes: number[] = [duration];
  for (const clip of scene.audioClips) {
    const source = clip.source;
    if (source.kind !== 'asset') continue;
    const sourceSeconds = doc.assets.find((a) => a.id === source.assetId)?.metadata
      .durationSeconds;
    if (sourceSeconds === undefined || !(sourceSeconds > 0)) continue;
    const trim = Math.min(Math.max(clip.trimStartSeconds ?? 0, 0), sourceSeconds);
    const play = Math.min(clip.durationSeconds ?? sourceSeconds - trim, sourceSeconds - trim);
    if (play > 0) clipEdgeTimes.push(clip.startSeconds, clip.startSeconds + play);
  }

  const snapTarget =
    drag !== undefined && drag.moved && drag.snappedTo !== 'frame'
      ? drag.snappedTo
      : laneSnapTarget;
  const snapNote =
    snapTarget !== undefined && snapTarget !== 'frame'
      ? `snapped to ${SNAP_TARGET_NAMES[snapTarget]}`
      : undefined;

  return (
    <div className="timeline" aria-label="Timeline">
      <div className="tl-header">
        <button
          type="button"
          className="btn strip-play"
          aria-pressed={playing}
          title={playing ? 'Pause the preview (Space)' : 'Play the scene from the playhead (Space)'}
          onClick={() => setPlaying((was) => !was)}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <button
          type="button"
          className="btn"
          disabled={frame <= 0}
          title="One frame back (,)"
          onClick={() => stepFrames(-1)}
        >
          ‹
        </button>
        <button
          type="button"
          className="btn"
          disabled={frame >= lastFrame}
          title="One frame forward (.)"
          onClick={() => stepFrames(1)}
        >
          ›
        </button>
        <button
          type="button"
          className="btn"
          disabled={prevTime === undefined}
          title={
            cameraMode
              ? 'Jump to the previous camera keyframe'
              : "Jump to the selected layer's previous keyframe"
          }
          onClick={() => prevTime !== undefined && pauseAndGo(prevTime)}
        >
          «
        </button>
        <button
          type="button"
          className="btn"
          disabled={nextTime === undefined}
          title={
            cameraMode
              ? 'Jump to the next camera keyframe'
              : "Jump to the selected layer's next keyframe"
          }
          onClick={() => nextTime !== undefined && pauseAndGo(nextTime)}
        >
          »
        </button>
        <span className="layer-readout strip-readout">
          {formatTime(playhead)} · frame {frame} / {lastFrame}
        </span>
        {snapNote !== undefined && <span className="tl-snap-note">{snapNote}</span>}
        <span className="tl-header-spacer" />
        <button
          type="button"
          className="btn"
          aria-pressed={snapOn}
          title="Snap: whole frames always; the playhead, other keyframes, clip edges and whole seconds when on"
          onClick={() => setSnapOn((was) => !was)}
        >
          Snap
        </button>
        <label className="tl-zoom" title="Zoom, from the whole scene to 200 pixels per second (Ctrl+wheel on the tracks too)">
          🔍
          <input
            type="range"
            aria-label="Timeline zoom"
            min={0}
            max={100}
            step={1}
            value={zoomSliderValue}
            disabled={zoomSpan <= 1}
            onChange={(event) => onZoomSlider(Number(event.target.value))}
          />
        </label>
        <label className="mask-tool strip-duration">
          Duration
          <input
            type="text"
            inputMode="decimal"
            aria-label="Scene duration in seconds (1 to 120)"
            value={durationText ?? String(duration)}
            onChange={(event) => setDurationText(event.target.value)}
            onBlur={commitDuration}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitDuration();
              if (event.key === 'Escape') setDurationText(undefined);
            }}
          />
          s
        </label>
      </div>
      <div className="tl-body" ref={bodyRef} onWheel={onBodyWheel}>
        <div
          className="tl-ruler"
          style={{ marginLeft: TRACK_LABEL_PX }}
          onPointerDown={onRulerPointerDown}
          onPointerMove={onRulerPointerMove}
        >
          {tints.map((tint) => (
            <div
              key={tint.key}
              className="tl-ruler-tint"
              title={tint.title}
              style={{
                left: timeToPixel(tint.fromSec, zoom, scrollSec),
                width: Math.max(0, (tint.toSec - tint.fromSec) * zoom)
              }}
            />
          ))}
          {rulerMarks.map((t) => (
            <span
              key={t}
              className="tl-ruler-mark"
              style={{ left: timeToPixel(t, zoom, scrollSec) }}
            >
              {rulerLabel(t)}
            </span>
          ))}
        </div>
        <div
          className="tl-rows"
          onPointerMove={onDiamondMove}
          onPointerUp={onDiamondUp}
          onPointerCancel={() => setDrag(undefined)}
        >
          <TrackRow
            label="Camera"
            kind="camera"
            keyframes={scene.cameraKeyframes}
            selected={cameraMode}
            zoom={zoom}
            scrollSec={scrollSec}
            trackWidthPx={trackWidthPx}
            drag={drag?.kind === 'camera' ? drag : undefined}
            onDiamondDown={onDiamondDown}
          />
          {layerRows.map((layer) => (
            <TrackRow
              key={layer.id}
              label={layer.name}
              kind="layer"
              layerId={layer.id}
              keyframes={layer.keyframes}
              selected={!cameraMode && layer.id === selectedLayerId}
              zoom={zoom}
              scrollSec={scrollSec}
              trackWidthPx={trackWidthPx}
              drag={drag?.kind === 'layer' && drag.layerId === layer.id ? drag : undefined}
              onDiamondDown={onDiamondDown}
            />
          ))}
        </div>
        <AudioLanes
          projectDir={projectDir}
          document={doc}
          scene={scene}
          zoom={zoom}
          scrollSec={scrollSec}
          trackWidthPx={trackWidthPx}
          snapOn={snapOn}
          playhead={playhead}
          selectedClipId={selectedClipId}
          onSelectClip={onSelectClip}
          applyEdit={applyEdit}
          onPause={pauseOnly}
          onSnapNote={setLaneSnapTarget}
        />
        {playheadVisible && (
          <div
            className="tl-playhead"
            style={{ left: TRACK_LABEL_PX + playheadPx }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
