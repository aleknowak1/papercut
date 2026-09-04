// The Layers panel (M-3.2): every layer of the current scene, front-most
// at the top (the document's layers[0] is at the back). Add character and
// prop layers, reorder, hide, lock, delete; the selected layer's opacity
// and Flip live here too. Every change is one document edit through the
// undo path; selection is UI state only — never saved, never undoable.

import { useState, type JSX } from 'react';
import {
  removeKeyframe,
  removeLayer,
  reorderLayer,
  setKeyframe,
  setLayerHidden,
  setLayerLocked
} from '../../../shared/document/edits';
import type { EasingType, Keyframe, ProjectDocument, Scene } from '../../../shared/document/types';
import { addCharacterToScene, addPropToScene, cutoutLabel } from '../../../shared/scene/addToScene';
import { keyframeAtPlayhead } from '../../../shared/animation/keyframes';
import { formatTime } from '../../../shared/animation/time';
import type { Point } from '../../../shared/scene/geometry';
import { MotionPresets } from './MotionPresets';

type ApplyEdit = (edit: (current: ProjectDocument) => ProjectDocument) => void;

export interface LayersPanelProps {
  readonly document: ProjectDocument;
  readonly scene: Scene;
  readonly applyEdit: ApplyEdit;
  readonly selectedLayerId?: string;
  /** The playhead in seconds, frame-snapped; inspector edits land here. */
  readonly playhead: number;
  readonly onSelect: (layerId: string | undefined) => void;
  /** Live opacity slider preview (0..1), cleared when it commits. */
  readonly onOpacityPreview: (opacity: number | undefined) => void;
  /** Arms "the next canvas click lands here" (Walk's destination). */
  readonly requestCanvasPick: (onPick: (point: Point) => void) => void;
  /** True while a canvas pick is armed. */
  readonly canvasPicking: boolean;
}

/**
 * A small number field that commits once on Enter or blur (one undo step),
 * and snaps back on Escape or nonsense input.
 */
function NumberField({
  label,
  value,
  suffix,
  onCommit
}: {
  readonly label: string;
  /** The document's value, already rounded for display. */
  readonly value: number;
  readonly suffix?: string;
  readonly onCommit: (value: number) => void;
}): JSX.Element {
  const [text, setText] = useState<string | undefined>(undefined);
  const commit = (): void => {
    if (text === undefined) return;
    setText(undefined);
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed === value) return;
    onCommit(parsed);
  };
  return (
    <label className="mask-tool inspector-field">
      {label}
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={text ?? String(value)}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') setText(undefined);
        }}
      />
      {suffix}
    </label>
  );
}

export function LayersPanel(props: LayersPanelProps): JSX.Element {
  const {
    document: doc,
    scene,
    applyEdit,
    selectedLayerId,
    playhead,
    onSelect,
    onOpacityPreview,
    requestCanvasPick,
    canvasPicking
  } = props;
  const characters = doc.characters.filter((c) => c.poses.length > 0);
  const cutouts = doc.assets.filter((a) => a.type === 'cutout');
  const [chosenCharacter, setChosenCharacter] = useState('');
  const [chosenCutout, setChosenCutout] = useState('');
  // The slider's live value while it is being dragged (0..1).
  const [slidingOpacity, setSlidingOpacity] = useState<number | undefined>(undefined);

  const selected = scene.layers.find((l) => l.id === selectedLayerId);
  const selectedZero = selected !== undefined ? keyframeAtPlayhead(selected, playhead) : undefined;

  const addCharacterLayer = (): void => {
    const character = characters.find((c) => c.id === chosenCharacter) ?? characters[0];
    if (character === undefined) return;
    // The panel button and the per-row/canvas-drop paths share this code,
    // so every road into the scene produces the same document.
    let layerId: string | undefined;
    applyEdit((current) => {
      const added = addCharacterToScene(current, scene.id, character.id);
      layerId = added?.layerId;
      return added?.doc ?? current;
    });
    if (layerId !== undefined) onSelect(layerId);
  };

  const addPropLayer = (): void => {
    const cutout = cutouts.find((c) => c.id === chosenCutout) ?? cutouts[0];
    if (cutout === undefined) return;
    let layerId: string | undefined;
    applyEdit((current) => {
      const added = addPropToScene(current, scene.id, cutout.id);
      layerId = added?.layerId;
      return added?.doc ?? current;
    });
    if (layerId !== undefined) onSelect(layerId);
  };

  /**
   * One inspector edit: the keyframe at the playhead with these changes —
   * rewritten in place when one sits exactly here, created (seeded from
   * the layer's motion) when not. One undo step either way.
   */
  const commitKeyframe = (changes: Partial<Keyframe>): void => {
    if (selected === undefined || selectedZero === undefined) return;
    applyEdit((current) =>
      setKeyframe(current, scene.id, selected.id, { ...selectedZero, ...changes })
    );
  };

  const commitOpacity = (opacity: number): void => {
    commitKeyframe({ opacity });
    setSlidingOpacity(undefined);
    onOpacityPreview(undefined);
  };

  const toggleFlip = (): void => {
    if (selectedZero !== undefined) commitKeyframe({ flipX: !selectedZero.flipX });
  };

  // Front-most first in the list: walk the document's layers backwards.
  const rows = [...scene.layers].reverse();

  return (
    <section className="panel layers-panel" aria-label="Layers">
      <h2>Layers</h2>

      {characters.length > 0 && (
        <div className="pose-add-row">
          <select
            className="pose-select"
            aria-label="Character to add as a layer"
            value={chosenCharacter === '' ? (characters[0]?.id ?? '') : chosenCharacter}
            onChange={(event) => setChosenCharacter(event.target.value)}
          >
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            title="Add this character to the scene (showing its first pose)"
            onClick={addCharacterLayer}
          >
            + Character
          </button>
        </div>
      )}
      {cutouts.length > 0 && (
        <div className="pose-add-row">
          <select
            className="pose-select"
            aria-label="Cutout to add as a prop layer"
            value={chosenCutout === '' ? (cutouts[0]?.id ?? '') : chosenCutout}
            onChange={(event) => setChosenCutout(event.target.value)}
          >
            {cutouts.map((cutout) => (
              <option key={cutout.id} value={cutout.id}>
                {cutoutLabel(cutout, doc)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            title="Add this cutout to the scene as a prop"
            onClick={addPropLayer}
          >
            + Prop
          </button>
        </div>
      )}
      {cutouts.length === 0 && (
        <p className="assets-hint">
          Layers come from cutouts — import a character or prop photo in the Assets tab, and its
          cutout appears here when ready.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="assets-hint">No layers yet. The front-most layer will sit at the top.</p>
      ) : (
        <ul className="layer-list">
          {rows.map((layer, rowIndex) => {
            const index = scene.layers.length - 1 - rowIndex; // document index
            const hidden = layer.hidden === true;
            const locked = layer.locked === true;
            return (
              <li key={layer.id} className={`layer-row${layer.id === selectedLayerId ? ' layer-row-selected' : ''}`}>
                <button
                  type="button"
                  className="layer-name"
                  aria-pressed={layer.id === selectedLayerId}
                  title={
                    locked
                      ? 'This layer is locked — unlock it to move it'
                      : 'Select this layer'
                  }
                  onClick={() => {
                    if (locked) return;
                    onSelect(layer.id === selectedLayerId ? undefined : layer.id);
                  }}
                >
                  <span className="layer-kind">{layer.source.kind === 'character' ? 'CH' : 'PR'}</span>
                  {layer.name}
                </button>
                <button
                  type="button"
                  className="btn asset-cancel"
                  aria-pressed={hidden}
                  title={hidden ? 'Show this layer' : 'Hide this layer (hidden layers do not export either)'}
                  onClick={() => {
                    if (!hidden && layer.id === selectedLayerId) onSelect(undefined);
                    applyEdit((current) => setLayerHidden(current, scene.id, layer.id, !hidden));
                  }}
                >
                  {hidden ? '○' : '◉'}
                </button>
                <button
                  type="button"
                  className="btn asset-cancel"
                  aria-pressed={locked}
                  title={locked ? 'Unlock this layer' : 'Lock this layer (it still shows; it just cannot be selected or moved)'}
                  onClick={() => {
                    if (!locked && layer.id === selectedLayerId) onSelect(undefined);
                    applyEdit((current) => setLayerLocked(current, scene.id, layer.id, !locked));
                  }}
                >
                  {locked ? '▣' : '▢'}
                </button>
                <button
                  type="button"
                  className="btn asset-cancel"
                  disabled={index >= scene.layers.length - 1}
                  title="Bring this layer forward"
                  onClick={() => applyEdit((current) => reorderLayer(current, scene.id, layer.id, index + 1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn asset-cancel"
                  disabled={index <= 0}
                  title="Send this layer backward"
                  onClick={() => applyEdit((current) => reorderLayer(current, scene.id, layer.id, index - 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn asset-cancel"
                  title="Remove this layer from the scene (its cutout stays in the project)"
                  onClick={() => {
                    if (layer.id === selectedLayerId) onSelect(undefined);
                    applyEdit((current) => removeLayer(current, scene.id, layer.id));
                  }}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected !== undefined && selectedZero !== undefined && (
        <div className="layer-details">
          <h2>Selected: {selected.name}</h2>
          <p className="layer-readout">
            {selected.keyframes.some((k) => k.time === playhead)
              ? `Keyframe at ${formatTime(playhead)} · ${selected.keyframes.length} on this layer`
              : `No keyframe at ${formatTime(playhead)} — editing makes one here`}
          </p>
          <div className="inspector-grid">
            <NumberField
              label="X"
              value={Math.round(selectedZero.x * 10) / 10}
              onCommit={(x) => commitKeyframe({ x })}
            />
            <NumberField
              label="Y"
              value={Math.round(selectedZero.y * 10) / 10}
              onCommit={(y) => commitKeyframe({ y })}
            />
            <NumberField
              label="Size"
              value={Math.round(selectedZero.scale * 100)}
              suffix="%"
              onCommit={(v) => commitKeyframe({ scale: Math.min(100, Math.max(0.01, v / 100)) })}
            />
            <NumberField
              label="Turn"
              value={Math.round(selectedZero.rotation * 10) / 10}
              suffix="°"
              onCommit={(rotation) => commitKeyframe({ rotation })}
            />
          </div>
          <label className="mask-tool inspector-field">
            Easing
            <select
              aria-label="Easing of the motion leaving this keyframe"
              title="How the motion leaving this keyframe speeds up and slows down"
              value={selectedZero.easing}
              onChange={(event) => commitKeyframe({ easing: event.target.value as EasingType })}
            >
              <option value="linear">Linear</option>
              <option value="ease-in">Ease in</option>
              <option value="ease-out">Ease out</option>
              <option value="ease-in-out">Ease in & out</option>
            </select>
          </label>
          {selected.source.kind === 'character' &&
            (() => {
              const characterId = selected.source.characterId;
              const character = doc.characters.find((c) => c.id === characterId);
              if (character === undefined || character.poses.length === 0) return null;
              return (
                <label className="mask-tool inspector-field">
                  Pose
                  <select
                    aria-label="Pose shown from this keyframe on"
                    title="The pose shown from this keyframe until the next keyframe that names one"
                    value={selectedZero.poseId ?? ''}
                    onChange={(event) => {
                      if (event.target.value !== '') commitKeyframe({ poseId: event.target.value });
                    }}
                  >
                    {selectedZero.poseId === undefined && <option value="">(first pose)</option>}
                    {character.poses.map((pose) => (
                      <option key={pose.id} value={pose.id}>
                        {pose.name}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })()}
          <label className="mask-tool layer-opacity">
            Opacity
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round((slidingOpacity ?? selectedZero.opacity) * 100)}
              onChange={(event) => {
                const opacity = Number(event.target.value) / 100;
                setSlidingOpacity(opacity);
                onOpacityPreview(opacity);
              }}
              onPointerUp={() => {
                if (slidingOpacity !== undefined) commitOpacity(slidingOpacity);
              }}
              onKeyUp={() => {
                if (slidingOpacity !== undefined) commitOpacity(slidingOpacity);
              }}
              onBlur={() => {
                if (slidingOpacity !== undefined) commitOpacity(slidingOpacity);
              }}
            />
            <span className="layer-readout">
              {Math.round((slidingOpacity ?? selectedZero.opacity) * 100)}%
            </span>
          </label>
          <div className="layer-detail-row">
            <button
              type="button"
              className="btn"
              aria-pressed={selectedZero.flipX}
              title="Mirror this layer left-to-right"
              onClick={toggleFlip}
            >
              Flip
            </button>
            <button
              type="button"
              className="btn"
              disabled={
                !selected.keyframes.some((k) => k.time === playhead) ||
                selected.keyframes.length <= 1
              }
              title={
                selected.keyframes.length <= 1
                  ? 'The last keyframe cannot be deleted'
                  : 'Delete the keyframe at the playhead (the motion around it closes over the gap)'
              }
              onClick={() =>
                applyEdit((current) => removeKeyframe(current, scene.id, selected.id, playhead))
              }
            >
              Delete keyframe
            </button>
          </div>
          <MotionPresets
            key={selected.id}
            document={doc}
            scene={scene}
            layer={selected}
            playhead={playhead}
            applyEdit={applyEdit}
            requestCanvasPick={requestCanvasPick}
            canvasPicking={canvasPicking}
          />
        </div>
      )}
    </section>
  );
}
