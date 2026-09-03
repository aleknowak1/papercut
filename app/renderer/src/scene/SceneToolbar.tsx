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

  return (
    <div className="scene-toolbar">
      <label className="mask-tool">
        Background
        <select
          className="pose-select scene-background-select"
          aria-label="Background picture for this scene"
          value={scene.backgroundAssetId ?? ''}
          disabled={images.length === 0}
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
      <span className="mask-tool">
        Fit
        <button
          type="button"
          className="btn asset-cancel"
          aria-pressed={fit === 'cover'}
          disabled={scene.backgroundAssetId === undefined}
          title="Scale the picture to fill the frame and crop the overflow, centred"
          onClick={() => applyEdit((current) => setSceneBackgroundFit(current, scene.id, 'cover'))}
        >
          Cover
        </button>
        <button
          type="button"
          className="btn asset-cancel"
          aria-pressed={fit === 'stretch'}
          disabled={scene.backgroundAssetId === undefined}
          title="Distort the picture to fit the frame exactly"
          onClick={() =>
            applyEdit((current) => setSceneBackgroundFit(current, scene.id, 'stretch'))
          }
        >
          Stretch
        </button>
      </span>
      {images.length === 0 && (
        <span className="assets-hint">import a background photo in the Assets tab first</span>
      )}
    </div>
  );
}
