// The camera inspector (M-4.6), shown in place of the Layers panel while
// camera mode is on: X/Y/Zoom fields, a zoom slider with live preview,
// the easing of the motion leaving the camera keyframe, and Delete. Every
// edit writes the camera keyframe AT the playhead — the layer rule
// (decision a) applied to the camera via cameraKeyframeAtPlayhead — and
// every value passes through the checked clamp, so a camera move can
// never show black edges (decision g).

import { useState, type JSX } from 'react';
import {
  cameraKeyframeAtPlayhead,
  clampCamera,
  sampleCamera,
  type CameraSample
} from '../../../shared/animation/camera';
import { formatTime } from '../../../shared/animation/time';
import { removeCameraKeyframe, setCameraKeyframe } from '../../../shared/document/edits';
import type { EasingType, ProjectDocument, Scene } from '../../../shared/document/types';
import { referenceSize } from '../../../shared/scene/geometry';
import { NumberField } from './NumberField';

type ApplyEdit = (edit: (current: ProjectDocument) => ProjectDocument) => void;

/** The zoom slider's reach; the document itself only insists on zoom ≥ 1. */
export const MAX_UI_ZOOM = 10;

export interface CameraPanelProps {
  readonly document: ProjectDocument;
  readonly scene: Scene;
  /** The playhead in seconds, frame-snapped; camera edits land here. */
  readonly playhead: number;
  readonly applyEdit: ApplyEdit;
  /** Live camera preview while the zoom slider moves (cleared on commit). */
  readonly onCameraPreview: (sample: CameraSample | undefined) => void;
  readonly onClose: () => void;
}

export function CameraPanel(props: CameraPanelProps): JSX.Element {
  const { document: doc, scene, playhead, applyEdit, onCameraPreview, onClose } = props;
  const frame = referenceSize(doc.format);
  const now = sampleCamera(scene, playhead, frame);
  const hasKeyframeHere = scene.cameraKeyframes.some((k) => k.time === playhead);
  const easingHere = cameraKeyframeAtPlayhead(scene, playhead, frame).easing;
  // The slider's live value while it is being dragged.
  const [slidingZoom, setSlidingZoom] = useState<number | undefined>(undefined);

  /**
   * One camera edit: the keyframe at the playhead with these changes —
   * rewritten in place when one sits exactly here, seeded from the camera
   * at this instant when not. Values are clamped first. One undo step.
   */
  const commitCamera = (changes: Partial<CameraSample> & { easing?: EasingType }): void => {
    applyEdit((current) => {
      const currentScene = current.scenes.find((s) => s.id === scene.id);
      if (currentScene === undefined) return current;
      const seed = cameraKeyframeAtPlayhead(currentScene, playhead, frame);
      const clamped = clampCamera(
        {
          x: changes.x ?? seed.x,
          y: changes.y ?? seed.y,
          zoom: Math.min(MAX_UI_ZOOM, changes.zoom ?? seed.zoom)
        },
        frame
      );
      return setCameraKeyframe(current, currentScene.id, {
        ...seed,
        ...clamped,
        easing: changes.easing ?? seed.easing
      });
    });
  };

  const commitZoom = (zoom: number): void => {
    commitCamera({ zoom });
    setSlidingZoom(undefined);
    onCameraPreview(undefined);
  };

  return (
    <section className="panel layers-panel" aria-label="Camera">
      <h2>Camera</h2>
      <p className="assets-hint">
        Drag the canvas to pan, roll the wheel to zoom. Every change writes the camera keyframe at
        the playhead — move the playhead, change the camera, press ▶.
      </p>
      <p className="layer-readout">
        {hasKeyframeHere
          ? `Camera keyframe at ${formatTime(playhead)} · ${scene.cameraKeyframes.length} in this scene`
          : scene.cameraKeyframes.length === 0
            ? 'No camera keyframes — the whole frame shows. Editing makes one at the playhead.'
            : `No camera keyframe at ${formatTime(playhead)} — editing makes one here`}
      </p>
      <div className="inspector-grid">
        <NumberField
          label="X"
          title="Where the camera looks, in scene pixels"
          value={Math.round(now.x * 10) / 10}
          onCommit={(x) => commitCamera({ x })}
        />
        <NumberField
          label="Y"
          title="Where the camera looks, in scene pixels"
          value={Math.round(now.y * 10) / 10}
          onCommit={(y) => commitCamera({ y })}
        />
        <NumberField
          label="Zoom"
          suffix="×"
          title="1 shows the whole frame; larger is closer (up to 10)"
          value={Math.round(now.zoom * 100) / 100}
          onCommit={(zoom) => commitCamera({ zoom: Math.max(1, zoom) })}
        />
      </div>
      <label className="mask-tool layer-opacity">
        Zoom
        <input
          type="range"
          aria-label="Camera zoom slider"
          min={100}
          max={MAX_UI_ZOOM * 100}
          value={Math.round((slidingZoom ?? now.zoom) * 100)}
          onChange={(event) => {
            const zoom = Number(event.target.value) / 100;
            setSlidingZoom(zoom);
            onCameraPreview({ x: now.x, y: now.y, zoom });
          }}
          onPointerUp={() => {
            if (slidingZoom !== undefined) commitZoom(slidingZoom);
          }}
          onKeyUp={() => {
            if (slidingZoom !== undefined) commitZoom(slidingZoom);
          }}
          onBlur={() => {
            if (slidingZoom !== undefined) commitZoom(slidingZoom);
          }}
        />
        <span className="layer-readout">{(slidingZoom ?? now.zoom).toFixed(2)}×</span>
      </label>
      <label className="mask-tool inspector-field">
        Easing
        <select
          aria-label="Easing of the camera motion leaving this keyframe"
          title="How the camera move leaving this keyframe speeds up and slows down"
          value={easingHere}
          onChange={(event) => commitCamera({ easing: event.target.value as EasingType })}
        >
          <option value="linear">Linear</option>
          <option value="ease-in">Ease in</option>
          <option value="ease-out">Ease out</option>
          <option value="ease-in-out">Ease in & out</option>
        </select>
      </label>
      <div className="layer-detail-row">
        <button
          type="button"
          className="btn"
          disabled={!hasKeyframeHere}
          title="Delete the camera keyframe at the playhead (the camera motion closes over the gap; deleting the last one shows the whole frame again)"
          onClick={() =>
            applyEdit((current) => removeCameraKeyframe(current, scene.id, playhead))
          }
        >
          Delete camera keyframe
        </button>
        <button type="button" className="btn" title="Back to the Layers panel (Escape)" onClick={onClose}>
          Done
        </button>
      </div>
    </section>
  );
}
