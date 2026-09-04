// The clip inspector (Phase 6 decision h, M-5.5): when a sound clip is
// selected on the timeline, the right panel shows its numbers — Start,
// Volume, Fade in, Fade out — and Delete. Every field commits once on
// Enter/blur through the same one-undo-step edits the drag gestures use.

import type { JSX } from 'react';
import { formatTime } from '../../../shared/animation/time';
import {
  moveAudioClip,
  removeAudioClip,
  setAudioClipFadeIn,
  setAudioClipFadeOut,
  setAudioClipVolume,
  trimAudioClip
} from '../../../shared/document/edits';
import type { AudioClip, ProjectDocument, Scene } from '../../../shared/document/types';
import { NumberField } from '../scene/NumberField';

type ApplyEdit = (edit: (current: ProjectDocument) => ProjectDocument) => void;

export interface ClipPanelProps {
  readonly document: ProjectDocument;
  readonly scene: Scene;
  readonly clip: AudioClip;
  readonly applyEdit: ApplyEdit;
  readonly onClose: () => void;
}

export function ClipPanel(props: ClipPanelProps): JSX.Element {
  const { document: doc, scene, clip, applyEdit, onClose } = props;
  const source = clip.source;
  const asset =
    source.kind === 'asset' ? doc.assets.find((a) => a.id === source.assetId) : undefined;
  const name =
    asset?.metadata.originalFileName ?? asset?.file.split('/').pop() ?? 'sound';
  const sourceSeconds = asset?.metadata.durationSeconds;
  const trimStart = clip.trimStartSeconds ?? 0;
  const playSeconds =
    clip.durationSeconds ??
    (sourceSeconds !== undefined ? Math.max(0, sourceSeconds - trimStart) : 0);
  const round = (value: number): number => Math.round(value * 1000) / 1000;

  return (
    <section className="panel layers-panel" aria-label="Sound clip">
      <h2>Sound clip</h2>
      <p className="layer-readout" title={asset?.file}>
        {name} · plays {formatTime(playSeconds)}
        {trimStart > 0 ? ` from ${formatTime(trimStart)} in` : ''}
      </p>
      <div className="inspector-grid">
        <NumberField
          label="Start"
          value={round(clip.startSeconds)}
          suffix="s"
          title="When the clip begins, in seconds from the scene start"
          onCommit={(value) =>
            applyEdit((current) => moveAudioClip(current, scene.id, clip.id, value))
          }
        />
        <NumberField
          label="Volume"
          value={Math.round(clip.volume * 100)}
          suffix="%"
          title="How loud the clip plays (100% is the sound as recorded)"
          onCommit={(value) =>
            applyEdit((current) => setAudioClipVolume(current, scene.id, clip.id, value / 100))
          }
        />
        <NumberField
          label="Fade in"
          value={round(clip.fadeInSeconds)}
          suffix="s"
          title="Seconds to rise from silence at the clip's start"
          onCommit={(value) =>
            applyEdit((current) =>
              setAudioClipFadeIn(current, scene.id, clip.id, value, playSeconds)
            )
          }
        />
        <NumberField
          label="Fade out"
          value={round(clip.fadeOutSeconds)}
          suffix="s"
          title="Seconds to sink to silence at the clip's end"
          onCommit={(value) =>
            applyEdit((current) =>
              setAudioClipFadeOut(current, scene.id, clip.id, value, playSeconds)
            )
          }
        />
        {sourceSeconds !== undefined && (
          <NumberField
            label="Play"
            value={round(playSeconds)}
            suffix="s"
            title="How much of the sound plays (trimming from the end)"
            onCommit={(value) =>
              applyEdit((current) =>
                trimAudioClip(current, scene.id, clip.id, trimStart, value, sourceSeconds)
              )
            }
          />
        )}
      </div>
      <div className="layer-detail-row">
        <button
          type="button"
          className="btn"
          title="Remove this clip from the timeline (the sound stays in Assets)"
          onClick={() => {
            onClose();
            applyEdit((current) => removeAudioClip(current, scene.id, clip.id));
          }}
        >
          Delete clip
        </button>
        <button type="button" className="btn" onClick={onClose} title="Back to the Layers panel (Escape)">
          Done
        </button>
      </div>
    </section>
  );
}
