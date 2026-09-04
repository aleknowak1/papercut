// The motion-preset panel (M-4.4): Bob, Walk, Shake or Pop for the
// selected layer, from the playhead. Two or three plain fields, Walk's
// destination clicked on the canvas, and Apply — which bakes ORDINARY
// keyframes through buildPresetKeyframes + applyKeyframes in ONE undo
// step. Afterwards they are just keyframes: editable one by one, and
// removable with a single Ctrl+Z right after applying.

import { useState, type JSX } from 'react';
import {
  buildPresetKeyframes,
  PRESET_DEFAULTS,
  type PresetName
} from '../../../shared/animation/presets';
import { formatTime, snapToFrame } from '../../../shared/animation/time';
import { applyKeyframes } from '../../../shared/document/edits';
import type { Layer, ProjectDocument, Scene } from '../../../shared/document/types';
import type { Point } from '../../../shared/scene/geometry';

type ApplyEdit = (edit: (current: ProjectDocument) => ProjectDocument) => void;

export interface MotionPresetsProps {
  readonly document: ProjectDocument;
  readonly scene: Scene;
  readonly layer: Layer;
  /** The playhead in seconds, frame-snapped; presets start here. */
  readonly playhead: number;
  readonly applyEdit: ApplyEdit;
  /** Arms "the next canvas click lands here" — for Walk's destination. */
  readonly requestCanvasPick: (onPick: (point: Point) => void) => void;
  /** True while a canvas pick is armed (ours or not). */
  readonly canvasPicking: boolean;
}

const PRESET_LABELS: Record<PresetName, string> = {
  bob: 'Bob',
  walk: 'Walk',
  shake: 'Shake',
  pop: 'Pop'
};

const PRESET_HINTS: Record<PresetName, string> = {
  bob: 'Floats gently up and down, riding on any motion the layer already has.',
  walk: 'Travels to the destination with a little hop each step, facing the way it walks.',
  shake: 'Rapid side-to-side jitter — good for laughter, cold, or panic.',
  pop: 'Appears from nothing with a small overshoot — good for entrances.'
};

/** A number shown the way a person would type it (no trailing zeros). */
function plain(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function MotionPresets(props: MotionPresetsProps): JSX.Element {
  const { document: doc, scene, layer, playhead, applyEdit, requestCanvasPick, canvasPicking } =
    props;
  const fps = doc.fps;
  const [preset, setPreset] = useState<PresetName>('bob');
  // undefined means "the default for this preset, live" — typing overrides.
  const [durationText, setDurationText] = useState<string | undefined>(undefined);
  const [amountText, setAmountText] = useState<string | undefined>(undefined);
  const [destination, setDestination] = useState<Point | undefined>(undefined);
  const [applied, setApplied] = useState<string | undefined>(undefined);

  const defaultDuration =
    preset === 'pop'
      ? PRESET_DEFAULTS.popDurationSeconds
      : Math.max(0, snapToFrame(scene.durationSeconds, fps) - snapToFrame(playhead, fps));
  const defaultAmount =
    preset === 'bob'
      ? PRESET_DEFAULTS.bobAmount
      : preset === 'walk'
        ? PRESET_DEFAULTS.walkBobAmount
        : PRESET_DEFAULTS.shakeAmount;

  const duration = Number(durationText ?? plain(defaultDuration));
  const amount = Number(amountText ?? String(defaultAmount));

  const request = {
    preset,
    startTime: snapToFrame(playhead, fps),
    durationSeconds: Number.isFinite(duration) ? duration : 0,
    amount: preset === 'pop' ? 0 : amount,
    ...(destination !== undefined ? { destination } : {}),
    fps
  } as const;
  // The exact keyframes Apply would bake — empty means "nothing sensible
  // to do", which keeps the button honest.
  const preview = buildPresetKeyframes(layer, request);

  const choosePreset = (next: PresetName): void => {
    setPreset(next);
    setDurationText(undefined);
    setAmountText(undefined);
    setApplied(undefined);
  };

  const pickDestination = (): void => {
    setApplied(undefined);
    requestCanvasPick((point) =>
      setDestination({ x: Math.round(point.x), y: Math.round(point.y) })
    );
  };

  const apply = (): void => {
    if (preview.length === 0) return;
    // Rebuild from the document inside the edit so the one undo step bakes
    // exactly what the current document says (same inputs, same result).
    applyEdit((current) => {
      const currentScene = current.scenes.find((s) => s.id === scene.id);
      const currentLayer = currentScene?.layers.find((l) => l.id === layer.id);
      if (currentScene === undefined || currentLayer === undefined) return current;
      return applyKeyframes(
        current,
        currentScene.id,
        currentLayer.id,
        buildPresetKeyframes(currentLayer, request)
      );
    });
    const last = preview[preview.length - 1];
    setApplied(
      `${PRESET_LABELS[preset]} baked in: ${preview.length} keyframes, ` +
        `${formatTime(request.startTime)} to ${formatTime(last?.time ?? request.startTime)}. ` +
        'One Ctrl+Z removes it.'
    );
  };

  return (
    <div className="motion-presets">
      <h2>Motion</h2>
      <div className="pose-add-row">
        <select
          className="pose-select"
          aria-label="Motion preset"
          value={preset}
          onChange={(event) => choosePreset(event.target.value as PresetName)}
        >
          {(Object.keys(PRESET_LABELS) as PresetName[]).map((name) => (
            <option key={name} value={name}>
              {PRESET_LABELS[name]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn"
          disabled={preview.length === 0}
          title={
            preview.length === 0
              ? preset === 'walk' && destination === undefined
                ? 'Pick a destination on the canvas first'
                : 'Give the preset a length longer than zero'
              : 'Bake this motion into ordinary keyframes (one undo step)'
          }
          onClick={apply}
        >
          Apply
        </button>
      </div>
      <p className="assets-hint">{PRESET_HINTS[preset]}</p>
      <div className="inspector-grid">
        <label className="mask-tool inspector-field">
          Length
          <input
            type="text"
            inputMode="decimal"
            aria-label="Preset length in seconds"
            title={
              preset === 'pop'
                ? 'How long the pop takes'
                : 'How long the motion runs from the playhead (defaults to the scene end)'
            }
            value={durationText ?? plain(defaultDuration)}
            onChange={(event) => {
              setDurationText(event.target.value);
              setApplied(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setDurationText(undefined);
            }}
          />
          s
        </label>
        {preset !== 'pop' && (
          <label className="mask-tool inspector-field">
            Amount
            <input
              type="text"
              inputMode="decimal"
              aria-label="Preset amount in scene pixels"
              title={
                preset === 'walk'
                  ? 'How high each step hops, in scene pixels'
                  : 'How far the layer moves off its path, in scene pixels'
              }
              value={amountText ?? String(defaultAmount)}
              onChange={(event) => {
                setAmountText(event.target.value);
                setApplied(undefined);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setAmountText(undefined);
              }}
            />
            px
          </label>
        )}
      </div>
      {preset === 'walk' && (
        <div className="pose-add-row motion-destination">
          <span className="layer-readout">
            {destination === undefined
              ? 'Destination: not set'
              : `Destination: ${destination.x}, ${destination.y}`}
          </span>
          <button
            type="button"
            className="btn"
            aria-pressed={canvasPicking}
            title="Then click the spot on the canvas the layer should walk to (Escape cancels)"
            onClick={pickDestination}
          >
            {canvasPicking ? 'Click the canvas…' : destination === undefined ? 'Pick on canvas' : 'Change'}
          </button>
        </div>
      )}
      {applied !== undefined && <p className="assets-hint">{applied}</p>}
    </div>
  );
}
