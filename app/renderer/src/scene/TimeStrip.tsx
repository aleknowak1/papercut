// The time strip (M-4.1): one thin row under the canvas — play/pause
// (Space), a frame-snapped scrubber with tick marks at the selected
// layer's keyframes, a time/frame readout, frame stepping (, and .),
// previous/next-keyframe jumps, and the scene Duration field (decision k).
//
// Play is a PREVIEW only: a requestAnimationFrame loop advances the
// playhead by the wall clock, snapped to whole frames; nothing is written
// to the document, and it stops at the scene end. The playhead itself is
// UI state owned by the project view — not saved, not undoable, like
// selection. Any scrub or document edit pauses playback.

import { useEffect, useRef, useState, type JSX } from 'react';
import { nextKeyframeTime, prevKeyframeTime } from '../../../shared/animation/keyframes';
import { formatTime, frameOf, secondsOf, snapToFrame } from '../../../shared/animation/time';
import { setSceneDuration } from '../../../shared/document/edits';
import type { Layer, ProjectDocument, Scene } from '../../../shared/document/types';

type ApplyEdit = (edit: (current: ProjectDocument) => ProjectDocument) => void;

export const MIN_SCENE_SECONDS = 1;
export const MAX_SCENE_SECONDS = 120;

export interface TimeStripProps {
  readonly document: ProjectDocument;
  readonly scene: Scene;
  readonly selectedLayer?: Layer;
  /** The playhead in seconds, frame-snapped; the strip only emits snapped values. */
  readonly playhead: number;
  readonly onPlayhead: (seconds: number) => void;
  readonly applyEdit: ApplyEdit;
}

export function TimeStrip(props: TimeStripProps): JSX.Element {
  const { document: doc, scene, selectedLayer, playhead, onPlayhead, applyEdit } = props;
  const fps = doc.fps;
  const duration = scene.durationSeconds;
  const frame = frameOf(playhead, fps);
  const lastFrame = frameOf(duration, fps);
  const [playing, setPlaying] = useState(false);
  // What the Duration field shows while it is being typed in.
  const [durationText, setDurationText] = useState<string | undefined>(undefined);

  // Fresh values for the play loop without restarting it every frame.
  const liveRef = useRef({ playhead, duration, fps, onPlayhead });
  liveRef.current = { playhead, duration, fps, onPlayhead };

  // The preview loop: wall clock in, frame-snapped playhead out.
  useEffect(() => {
    if (!playing) return;
    const live = liveRef.current;
    // Play at the end starts over from the beginning.
    const from = live.playhead >= live.duration ? 0 : live.playhead;
    const startWall = performance.now();
    let raf = 0;
    const tick = (now: number): void => {
      const t = from + (now - startWall) / 1000;
      const { duration: end, fps: rate, onPlayhead: emit } = liveRef.current;
      if (t >= end) {
        emit(secondsOf(frameOf(end, rate), rate));
        setPlaying(false);
        return;
      }
      emit(snapToFrame(t, rate));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // Any document edit (including undo/redo) pauses the preview.
  useEffect(() => {
    setPlaying(false);
  }, [doc]);

  const pauseAndGo = (seconds: number): void => {
    setPlaying(false);
    onPlayhead(snapToFrame(Math.min(Math.max(seconds, 0), duration), fps));
  };

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

  const prevTime = selectedLayer !== undefined ? prevKeyframeTime(selectedLayer, playhead) : undefined;
  const nextTime = selectedLayer !== undefined ? nextKeyframeTime(selectedLayer, playhead) : undefined;

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

  // Tick marks where the selected layer's keyframes sit (within the scene).
  const ticks =
    selectedLayer?.keyframes
      .filter((k) => k.time >= 0 && k.time <= duration)
      .map((k) => ({ time: k.time, left: duration > 0 ? (k.time / duration) * 100 : 0 })) ?? [];

  return (
    <div className="time-strip">
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
      <div className="strip-track">
        <input
          type="range"
          className="strip-scrubber"
          aria-label="Playhead"
          min={0}
          max={lastFrame}
          step={1}
          value={frame}
          onChange={(event) => {
            setPlaying(false);
            onPlayhead(secondsOf(Number(event.target.value), fps));
          }}
        />
        <div className="strip-ticks" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick.time} className="strip-tick" style={{ left: `${tick.left}%` }} />
          ))}
        </div>
      </div>
      <span className="layer-readout strip-readout">
        {formatTime(playhead)} · frame {frame} / {lastFrame}
      </span>
      <button
        type="button"
        className="btn"
        disabled={prevTime === undefined}
        title="Jump to the selected layer's previous keyframe"
        onClick={() => prevTime !== undefined && pauseAndGo(prevTime)}
      >
        «
      </button>
      <button
        type="button"
        className="btn"
        disabled={nextTime === undefined}
        title="Jump to the selected layer's next keyframe"
        onClick={() => nextTime !== undefined && pauseAndGo(nextTime)}
      >
        »
      </button>
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
  );
}
