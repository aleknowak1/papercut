// The Transition panel (Phase 7, decision m): replaces the right panel
// while the transition between two scenes is being edited — opened by the
// strip's arrow or the selected card's Transition button. Type (Cut
// first, then the six), Length (hidden for Cut; the edit clamps to
// 0.1–3 s, half the shorter neighbour, then a whole frame), a one-line
// hint per type, Done. One undo step per change; Escape steps back out
// (App's Escape ladder), as the Camera and Sound clip panels do.

import type { JSX } from 'react';
import {
  setSceneTransition,
  setSceneTransitionLength
} from '../../../shared/document/edits';
import type { ProjectDocument, TransitionType } from '../../../shared/document/types';
import { TRANSITION_TYPES } from '../../../shared/document/types';
import { effectiveTransitionSeconds } from '../../../shared/timeline/projectTime';
import { NumberField } from '../scene/NumberField';

type ApplyEdit = (edit: (current: ProjectDocument) => ProjectDocument) => void;

export interface TransitionPanelProps {
  readonly document: ProjectDocument;
  /** The scene whose transition OUT (into the next scene) is edited. */
  readonly sceneId: string;
  readonly applyEdit: ApplyEdit;
  readonly onClose: () => void;
}

const TYPE_NAMES: Record<TransitionType, string> = {
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

/** One line per type, in M-6.2's words. */
const TYPE_HINTS: Record<TransitionType, string> = {
  cut: 'The next scene starts on the next frame — no overlap. Right most of the time.',
  crossfade: 'The next scene fades in over this one. A gentle change of place or mood.',
  'slide-left': 'A push to the left — the next scene follows in from the right.',
  'slide-right': 'A push to the right — the next scene follows in from the left.',
  'slide-up': 'A push upward — the next scene rises in from below.',
  'slide-down': 'A push downward — the next scene drops in from above.',
  'zoom-in': 'This scene grows and fades away, revealing the next beneath. A dramatic plunge.',
  'zoom-out': 'The next scene arrives huge and settles into place, fading in. Pulling back.',
  wipe: 'A hard edge sweeps left to right, revealing the next scene. Use with a wink.'
};

// Cut first (decision m), then the six in a sensible order.
const TYPE_ORDER: readonly TransitionType[] = [
  'cut',
  ...TRANSITION_TYPES.filter((t) => t !== 'cut')
];

export function TransitionPanel(props: TransitionPanelProps): JSX.Element | null {
  const { document: doc, sceneId, applyEdit, onClose } = props;

  const at = doc.scenes.findIndex((s) => s.id === sceneId);
  const scene = doc.scenes[at];
  const next = doc.scenes[at + 1];
  // The scene vanished (undo) or became the last one (a reorder while
  // the panel was open): nothing to edit — App renders the Layers panel.
  if (scene === undefined || next === undefined) return null;

  const type: TransitionType = scene.transitionOut ?? 'cut';
  const storedLength = scene.transitionOutSeconds ?? 0.5;
  const effective = effectiveTransitionSeconds(doc, at);
  const round = (value: number): number => Math.round(value * 1000) / 1000;

  return (
    <section className="panel layers-panel" aria-label="Transition">
      <h2>Transition</h2>
      <p className="layer-readout">
        Between {scene.name} and {next.name}
      </p>
      <div className="inspector-grid">
        <label className="mask-tool">
          Type
          <select
            aria-label="Transition type"
            value={type}
            onChange={(event) =>
              applyEdit((current) =>
                setSceneTransition(current, sceneId, event.target.value as TransitionType)
              )
            }
          >
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {TYPE_NAMES[t]}
              </option>
            ))}
          </select>
        </label>
        {type !== 'cut' && (
          <NumberField
            label="Length"
            value={round(storedLength)}
            suffix="s"
            title="How long the two scenes overlap: 0.1 to 3 seconds, never more than half the shorter scene, landing on a whole frame"
            onCommit={(value) =>
              applyEdit((current) => setSceneTransitionLength(current, sceneId, value))
            }
          />
        )}
      </div>
      {type !== 'cut' && (
        <p className="layer-readout" title="The clamped length actually used between these two scenes">
          Runs as {round(effective)} s here — the scenes overlap by that long (M-6.3).
        </p>
      )}
      <p className="layer-readout">{TYPE_HINTS[type]}</p>
      <div className="layer-detail-row">
        <button
          type="button"
          className="btn"
          onClick={onClose}
          title="Back to the Layers panel (Escape)"
        >
          Done
        </button>
      </div>
    </section>
  );
}
