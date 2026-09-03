// The strip above the scene canvas: which imported picture is the scene's
// background, and how it fills the frame (cover — the default — or
// stretch). Every change is one document edit through the undo path.

import type { JSX } from 'react';
import { setSceneBackground, setSceneBackgroundFit } from '../../../shared/document/edits';
import type { BackgroundFit, ProjectDocument, Scene } from '../../../shared/document/types';

type ApplyEdit = (edit: (current: ProjectDocument) => ProjectDocument) => void;

export function SceneToolbar({
  document: doc,
  scene,
  applyEdit
}: {
  document: ProjectDocument;
  scene: Scene;
  applyEdit: ApplyEdit;
}): JSX.Element {
  const images = doc.assets.filter((a) => a.type === 'image');
  const fit: BackgroundFit = scene.backgroundFit ?? 'cover';

  // Clear states instead of disabled controls: no photos yet → say what
  // to do; photos but no background → just the picker; background set →
  // picker plus the fit choice.
  return (
    <div className="scene-toolbar">
      {images.length === 0 ? (
        <span className="assets-hint">
          Background: import a background photo in the Assets tab, then pick it here — or press
          its "Set as background" button.
        </span>
      ) : (
        <label className="mask-tool">
          Background
          <select
            className="pose-select scene-background-select"
            aria-label="Background picture for this scene"
            value={scene.backgroundAssetId ?? ''}
            onChange={(event) => {
              const assetId = event.target.value === '' ? undefined : event.target.value;
              applyEdit((current) => setSceneBackground(current, scene.id, assetId));
            }}
          >
            <option value="">(none)</option>
            {images.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.metadata.originalFileName ?? asset.file.split('/').pop() ?? asset.id}
              </option>
            ))}
          </select>
        </label>
      )}
      {scene.backgroundAssetId !== undefined && (
        <span className="mask-tool">
          Fit
          <button
            type="button"
            className="btn asset-cancel"
            aria-pressed={fit === 'cover'}
            title="Scale the picture to fill the frame and crop the overflow, centred"
            onClick={() => applyEdit((current) => setSceneBackgroundFit(current, scene.id, 'cover'))}
          >
            Cover
          </button>
          <button
            type="button"
            className="btn asset-cancel"
            aria-pressed={fit === 'stretch'}
            title="Distort the picture to fit the frame exactly"
            onClick={() =>
              applyEdit((current) => setSceneBackgroundFit(current, scene.id, 'stretch'))
            }
          >
            Stretch
          </button>
        </span>
      )}
    </div>
  );
}
