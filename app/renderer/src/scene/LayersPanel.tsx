// The Layers panel (M-3.2): every layer of the current scene, front-most
// at the top (the document's layers[0] is at the back). Add character and
// prop layers, reorder, hide, lock, delete; the selected layer's opacity
// and Flip live here too. Every change is one document edit through the
// undo path; selection is UI state only — never saved, never undoable.

import { useState, type JSX } from 'react';
import { newId } from '../../../shared/document/create';
import {
  addLayer,
  removeLayer,
  reorderLayer,
  setKeyframe,
  setLayerHidden,
  setLayerLocked
} from '../../../shared/document/edits';
import type {
  Asset,
  Layer,
  ProjectDocument,
  Scene
} from '../../../shared/document/types';
import { defaultPlacementKeyframe, timeZeroKeyframe } from '../../../shared/scene/geometry';

type ApplyEdit = (edit: (current: ProjectDocument) => ProjectDocument) => void;

export interface LayersPanelProps {
  readonly document: ProjectDocument;
  readonly scene: Scene;
  readonly applyEdit: ApplyEdit;
  readonly selectedLayerId?: string;
  readonly onSelect: (layerId: string | undefined) => void;
  /** Live opacity slider preview (0..1), cleared when it commits. */
  readonly onOpacityPreview: (opacity: number | undefined) => void;
}

/** A readable label for a cutout: the photo it was cut from, if known. */
function cutoutLabel(cutout: Asset, doc: ProjectDocument): string {
  const source = doc.assets.find((a) => a.id === cutout.metadata.sourceAssetId);
  const name = source?.metadata.originalFileName ?? cutout.file.split('/').pop() ?? cutout.id;
  return cutout.metadata.model === 'hd' ? `${name} (HD)` : name;
}

function assetSize(asset: Asset | undefined): { width: number; height: number } {
  return { width: asset?.metadata.width ?? 0, height: asset?.metadata.height ?? 0 };
}

export function LayersPanel(props: LayersPanelProps): JSX.Element {
  const { document: doc, scene, applyEdit, selectedLayerId, onSelect, onOpacityPreview } = props;
  const characters = doc.characters.filter((c) => c.poses.length > 0);
  const cutouts = doc.assets.filter((a) => a.type === 'cutout');
  const [chosenCharacter, setChosenCharacter] = useState('');
  const [chosenCutout, setChosenCutout] = useState('');
  // The slider's live value while it is being dragged (0..1).
  const [slidingOpacity, setSlidingOpacity] = useState<number | undefined>(undefined);

  const selected = scene.layers.find((l) => l.id === selectedLayerId);
  const selectedZero = selected !== undefined ? timeZeroKeyframe(selected) : undefined;

  const addCharacterLayer = (): void => {
    const character = characters.find((c) => c.id === chosenCharacter) ?? characters[0];
    const pose = character?.poses[0];
    if (character === undefined || pose === undefined) return;
    const cutout = doc.assets.find((a) => a.id === pose.cutoutAssetId);
    const layer: Layer = {
      id: newId(),
      name: character.name,
      source: { kind: 'character', characterId: character.id },
      keyframes: [defaultPlacementKeyframe(assetSize(cutout), doc.format, pose.id)]
    };
    applyEdit((current) => addLayer(current, scene.id, layer));
    onSelect(layer.id);
  };

  const addPropLayer = (): void => {
    const cutout = cutouts.find((c) => c.id === chosenCutout) ?? cutouts[0];
    if (cutout === undefined) return;
    const layer: Layer = {
      id: newId(),
      name: cutoutLabel(cutout, doc),
      source: { kind: 'prop', assetId: cutout.id },
      keyframes: [defaultPlacementKeyframe(assetSize(cutout), doc.format)]
    };
    applyEdit((current) => addLayer(current, scene.id, layer));
    onSelect(layer.id);
  };

  const commitOpacity = (opacity: number): void => {
    if (selected === undefined || selectedZero === undefined) return;
    applyEdit((current) =>
      setKeyframe(current, scene.id, selected.id, { ...selectedZero, opacity })
    );
    setSlidingOpacity(undefined);
    onOpacityPreview(undefined);
  };

  const toggleFlip = (): void => {
    if (selected === undefined || selectedZero === undefined) return;
    applyEdit((current) =>
      setKeyframe(current, scene.id, selected.id, {
        ...selectedZero,
        flipX: !selectedZero.flipX
      })
    );
  };

  // Front-most first in the list: walk the document's layers backwards.
  const rows = [...scene.layers].reverse();

  return (
    <section className="panel layers-panel" aria-label="Layers">
      <h2>Layers</h2>

      <div className="pose-add-row">
        <select
          className="pose-select"
          aria-label="Character to add as a layer"
          value={chosenCharacter === '' && characters.length > 0 ? (characters[0]?.id ?? '') : chosenCharacter}
          onChange={(event) => setChosenCharacter(event.target.value)}
          disabled={characters.length === 0}
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
          disabled={characters.length === 0}
          title="Add this character to the scene (showing its first pose)"
          onClick={addCharacterLayer}
        >
          + Character
        </button>
      </div>
      <div className="pose-add-row">
        <select
          className="pose-select"
          aria-label="Cutout to add as a prop layer"
          value={chosenCutout === '' && cutouts.length > 0 ? (cutouts[0]?.id ?? '') : chosenCutout}
          onChange={(event) => setChosenCutout(event.target.value)}
          disabled={cutouts.length === 0}
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
          disabled={cutouts.length === 0}
          title="Add this cutout to the scene as a prop"
          onClick={addPropLayer}
        >
          + Prop
        </button>
      </div>
      {characters.length === 0 && cutouts.length === 0 && (
        <p className="assets-hint">
          Layers come from cutouts — import a character or prop photo in the Assets tab first.
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
            <span className="layer-readout">
              at {Math.round(selectedZero.x)}, {Math.round(selectedZero.y)} · size{' '}
              {Math.round(selectedZero.scale * 100)}%
              {selectedZero.rotation !== 0 && ` · turned ${Math.round(selectedZero.rotation)}°`}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
