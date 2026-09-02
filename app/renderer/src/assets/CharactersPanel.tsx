// Characters with several poses (M-2.5, DOC-03 §3 characters[]): a
// character is a named group of cutouts. Create a character, add a pose
// from an imported cutout, rename, reorder, delete — document and panel
// only; nothing on a canvas until Phase 4. Every operation is one undo
// step through the same applyEdit path as everything else.

import { useEffect, useState, type JSX } from 'react';
import type { Asset, Character, ProjectDocument } from '../../../shared/document/types';
import {
  addCharacter,
  addPose,
  removeCharacter,
  removePose,
  renameCharacter,
  renamePose,
  reorderPose
} from '../../../shared/document/edits';
import type { ApplyEdit } from './AssetsPanel';
import { Thumbnail } from './Thumbnail';

/** An inline name editor: commits once on Enter/blur, Escape cancels. */
function NameInput({
  value,
  ariaLabel,
  onCommit
}: {
  value: string;
  ariaLabel: string;
  onCommit: (name: string) => void;
}): JSX.Element {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = (): void => {
    const trimmed = text.trim();
    if (trimmed !== '' && trimmed !== value) onCommit(trimmed);
    else setText(value);
  };
  return (
    <input
      type="text"
      className="name-input"
      aria-label={ariaLabel}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setText(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

/** A readable label for a cutout: the photo it was cut from, if known. */
function cutoutLabel(cutout: Asset, doc: ProjectDocument): string {
  const source = doc.assets.find((a) => a.id === cutout.metadata.sourceAssetId);
  const name = source?.metadata.originalFileName ?? cutout.file.split('/').pop() ?? cutout.id;
  return cutout.metadata.model === 'hd' ? `${name} (HD)` : name;
}

function CharacterCard({
  projectDir,
  doc,
  character,
  applyEdit
}: {
  projectDir: string;
  doc: ProjectDocument;
  character: Character;
  applyEdit: ApplyEdit;
}): JSX.Element {
  const cutouts = doc.assets.filter((a) => a.type === 'cutout');
  const [chosenCutout, setChosenCutout] = useState('');

  const addPoseFromCutout = (): void => {
    const cutout = cutouts.find((c) => c.id === chosenCutout) ?? cutouts[0];
    if (!cutout) return;
    const pose = {
      id: crypto.randomUUID(),
      name: `Pose ${character.poses.length + 1}`,
      cutoutAssetId: cutout.id
    };
    applyEdit((current) => addPose(current, character.id, pose));
  };

  return (
    <div className="character-card">
      <div className="character-head">
        <NameInput
          value={character.name}
          ariaLabel={`Character name`}
          onCommit={(name) => applyEdit((current) => renameCharacter(current, character.id, name))}
        />
        <button
          type="button"
          className="btn asset-cancel"
          title="Delete this character (its cutouts stay in the project)"
          onClick={() => applyEdit((current) => removeCharacter(current, character.id))}
        >
          Delete
        </button>
      </div>

      {character.poses.length === 0 ? (
        <p className="assets-hint">No poses yet — add one from a cutout below.</p>
      ) : (
        <ul className="pose-list">
          {character.poses.map((pose, index) => {
            const cutout = doc.assets.find((a) => a.id === pose.cutoutAssetId);
            return (
              <li key={pose.id} className="asset-row pose-row">
                {cutout ? (
                  <Thumbnail projectDir={projectDir} asset={cutout} />
                ) : (
                  <span className="asset-thumb asset-thumb-empty" />
                )}
                <NameInput
                  value={pose.name}
                  ariaLabel={`Name of pose ${index + 1}`}
                  onCommit={(name) =>
                    applyEdit((current) => renamePose(current, character.id, pose.id, name))
                  }
                />
                <button
                  type="button"
                  className="btn asset-cancel"
                  disabled={index === 0}
                  title="Move this pose up"
                  onClick={() =>
                    applyEdit((current) => reorderPose(current, character.id, pose.id, index - 1))
                  }
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn asset-cancel"
                  disabled={index === character.poses.length - 1}
                  title="Move this pose down"
                  onClick={() =>
                    applyEdit((current) => reorderPose(current, character.id, pose.id, index + 1))
                  }
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn asset-cancel"
                  title="Remove this pose (the cutout stays in the project)"
                  onClick={() =>
                    applyEdit((current) => removePose(current, character.id, pose.id))
                  }
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pose-add-row">
        <select
          className="pose-select"
          aria-label="Cutout to add as a pose"
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
        <button type="button" className="btn" disabled={cutouts.length === 0} onClick={addPoseFromCutout}>
          Add pose
        </button>
      </div>
    </div>
  );
}

export function CharactersPanel({
  projectDir,
  document: doc,
  applyEdit
}: {
  projectDir: string;
  document: ProjectDocument;
  applyEdit: ApplyEdit;
}): JSX.Element {
  const hasCutouts = doc.assets.some((a) => a.type === 'cutout');

  const createCharacter = (): void => {
    const character: Character = {
      id: crypto.randomUUID(),
      name: `Character ${doc.characters.length + 1}`,
      poses: []
    };
    applyEdit((current) => addCharacter(current, character));
  };

  return (
    <section className="panel characters-panel">
      <h2>Characters</h2>
      <div className="assets-actions">
        <button type="button" className="btn" onClick={createCharacter}>
          + New character
        </button>
        {!hasCutouts && (
          <span className="assets-hint">
            poses come from cutouts — import a character/prop photo first
          </span>
        )}
      </div>
      {doc.characters.length === 0 ? (
        <p className="opened-note">
          A character groups several cutouts of the same person or thing as poses, so it can
          switch between them in a scene.
        </p>
      ) : (
        doc.characters.map((character) => (
          <CharacterCard
            key={character.id}
            projectDir={projectDir}
            doc={doc}
            character={character}
            applyEdit={applyEdit}
          />
        ))
      )}
    </section>
  );
}
