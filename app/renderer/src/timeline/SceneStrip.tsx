// The scene strip (Phase 7, M-6.1, decisions a–c): one card per scene in
// play order across the full window width, directly above the timeline's
// header inside the dock. Cards show number · name · duration; a small
// arrow between cards shows the transition type; "+ Scene" sits at the
// end and the whole video's length at the right. The selected card
// carries its own controls — Duplicate, ◀ ▶ reorder, Transition, and ✕
// (refused for the last scene). Clicking a selected card's name renames
// it in place (Enter confirms, Escape cancels).
//
// Selection is UI state owned by the project view — not saved, never an
// undo step. Every edit here goes through the ready-made one-undo-step
// scene edits; this file holds no rules of its own (the naming and
// neighbour rules live in shared/scene/sceneList.ts, tested).

import { Fragment, useState, type JSX } from 'react';
import {
  duplicateScene,
  insertScene,
  removeScene,
  renameScene,
  reorderScene
} from '../../../shared/document/edits';
import { newScene } from '../../../shared/document/create';
import type { ProjectDocument, TransitionType } from '../../../shared/document/types';
import { neighbourAfterRemoval, nextSceneName } from '../../../shared/scene/sceneList';
import {
  effectiveTransitionSeconds,
  projectDurationSeconds
} from '../../../shared/timeline/projectTime';

type ApplyEdit = (edit: (current: ProjectDocument) => ProjectDocument) => void;

export interface SceneStripProps {
  readonly document: ProjectDocument;
  /** The selected scene's id (the project view's fallback already applied). */
  readonly selectedSceneId: string;
  readonly applyEdit: ApplyEdit;
  /** Selecting a card switches the whole editor to that scene (decision c). */
  readonly onSelectScene: (sceneId: string) => void;
  /** Clicking an arrow (or the Transition button) opens the Transition
      panel for the transition OUT of that scene. */
  readonly onEditTransition: (sceneId: string) => void;
}

/** The arrow's compact face per type; the tooltip carries the full story. */
const ARROW_LABELS: Record<TransitionType, string> = {
  cut: 'cut',
  crossfade: 'fade',
  'slide-left': '←',
  'slide-right': '→',
  'slide-up': '↑',
  'slide-down': '↓',
  'zoom-in': 'z+',
  'zoom-out': 'z−',
  wipe: 'wipe'
};

const TRANSITION_NAMES: Record<TransitionType, string> = {
  cut: 'Cut',
  crossfade: 'Crossfade',
  'slide-left': 'Slide left',
  'slide-right': 'Slide right',
  'slide-up': 'Slide up',
  'slide-down': 'Slide down',
  'zoom-in': 'Zoom in',
  'zoom-out': 'Zoom out',
  wipe: 'Wipe'
};

/** Seconds as the strip shows them: "10 s", "13.5 s". */
function fmtSeconds(seconds: number): string {
  return `${Number(seconds.toFixed(2))} s`;
}

export function SceneStrip(props: SceneStripProps): JSX.Element {
  const { document: doc, selectedSceneId, applyEdit, onSelectScene, onEditTransition } = props;
  const [renaming, setRenaming] = useState<{ sceneId: string; text: string } | undefined>(
    undefined
  );

  const commitRename = (): void => {
    const pending = renaming;
    setRenaming(undefined);
    if (pending === undefined) return;
    const name = pending.text.trim();
    const scene = doc.scenes.find((s) => s.id === pending.sceneId);
    if (name.length === 0 || scene === undefined || name === scene.name) return;
    applyEdit((current) => renameScene(current, pending.sceneId, name));
  };

  const addScene = (): void => {
    const scene = newScene(nextSceneName(doc.scenes));
    applyEdit((current) => insertScene(current, selectedSceneId, scene));
    onSelectScene(scene.id);
  };

  const duplicate = (sceneId: string): void => {
    // The copy lands right after the original; select it (the thing you
    // will edit next). Its id is read from the document the edit built —
    // the addToTimeline pattern.
    let copyId: string | undefined;
    applyEdit((current) => {
      const next = duplicateScene(current, sceneId);
      const at = next.scenes.findIndex((s) => s.id === sceneId);
      copyId = next.scenes[at + 1]?.id;
      return next;
    });
    if (copyId !== undefined) onSelectScene(copyId);
  };

  const remove = (sceneId: string): void => {
    // Deleting the selected scene selects its neighbour (next, else
    // previous) — decided BEFORE the edit so the choice is well-defined.
    const neighbour = neighbourAfterRemoval(doc.scenes, sceneId);
    applyEdit((current) => removeScene(current, sceneId));
    if (sceneId === selectedSceneId && neighbour !== undefined) onSelectScene(neighbour);
  };

  const last = doc.scenes.length - 1;
  return (
    <div className="scene-strip" aria-label="Scenes">
      {doc.scenes.map((scene, i) => {
        const selected = scene.id === selectedSceneId;
        const type: TransitionType = scene.transitionOut ?? 'cut';
        const effective = effectiveTransitionSeconds(doc, i);
        const arrowTitle =
          type === 'cut'
            ? 'Cut — the next scene starts on the next frame. Click to change the transition.'
            : `${TRANSITION_NAMES[type]}, ${fmtSeconds(effective)} of overlap. Click to change the transition.`;
        return (
          <Fragment key={scene.id}>
            <div
              className={`scene-card${selected ? ' scene-card-selected' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!selected) onSelectScene(scene.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !selected) onSelectScene(scene.id);
              }}
              title={selected ? undefined : `Switch the editor to ${scene.name}`}
            >
              <span className="scene-card-number">{i + 1}</span>
              {renaming?.sceneId === scene.id ? (
                <input
                  className="scene-card-rename"
                  aria-label="Scene name"
                  value={renaming.text}
                  autoFocus
                  onChange={(event) =>
                    setRenaming({ sceneId: scene.id, text: event.target.value })
                  }
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitRename();
                    if (event.key === 'Escape') {
                      event.stopPropagation();
                      setRenaming(undefined);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="scene-card-name"
                  title={selected ? 'Click to rename this scene' : undefined}
                  onClick={(event) => {
                    if (selected) {
                      event.stopPropagation();
                      setRenaming({ sceneId: scene.id, text: scene.name });
                    }
                  }}
                >
                  {scene.name}
                </button>
              )}
              <span className="scene-card-duration">{fmtSeconds(scene.durationSeconds)}</span>
              {selected && (
                <span className="scene-card-actions">
                  <button
                    type="button"
                    className="btn scene-card-btn"
                    title="Duplicate this scene — everything in it, as a new scene right after"
                    onClick={(event) => {
                      event.stopPropagation();
                      duplicate(scene.id);
                    }}
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    className="btn scene-card-btn"
                    disabled={i === 0}
                    title="Move this scene one place earlier"
                    onClick={(event) => {
                      event.stopPropagation();
                      applyEdit((current) => reorderScene(current, scene.id, -1));
                    }}
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    className="btn scene-card-btn"
                    disabled={i === last}
                    title="Move this scene one place later"
                    onClick={(event) => {
                      event.stopPropagation();
                      applyEdit((current) => reorderScene(current, scene.id, 1));
                    }}
                  >
                    ▶
                  </button>
                  {i < last && (
                    <button
                      type="button"
                      className="btn scene-card-btn"
                      title="The transition into the next scene"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditTransition(scene.id);
                      }}
                    >
                      Transition
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn scene-card-btn"
                    disabled={doc.scenes.length <= 1}
                    title={
                      doc.scenes.length <= 1
                        ? 'A project always has one scene'
                        : 'Delete this scene'
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      remove(scene.id);
                    }}
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
            {i < last && (
              <button
                type="button"
                className="scene-arrow"
                title={arrowTitle}
                onClick={() => onEditTransition(scene.id)}
              >
                <span aria-hidden="true">»</span> {ARROW_LABELS[type]}
              </button>
            )}
          </Fragment>
        );
      })}
      <button type="button" className="btn scene-add" title="A new empty scene after the selected one" onClick={addScene}>
        + Scene
      </button>
      <span className="scene-total" title="The whole video: scene lengths minus the transitions (M-6.3)">
        {fmtSeconds(projectDurationSeconds(doc))}
      </span>
    </div>
  );
}
