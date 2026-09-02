// The Assets panel (Phase 3, deliberately minimal — the full editor layout
// is Phase 4): a dense list of everything imported, with thumbnails, type,
// cutout status, and the import controls. Import by button or drag-and-drop;
// on import the user says what the picture is — background (no cutout) or
// character/prop (automatic cutout queues; the app never blocks; a cutout
// can be cancelled).

import { useEffect, useRef, useState, type JSX } from 'react';
import type { Asset, ProjectDocument } from '../../../shared/document/types';
import type { SegmentationJobUpdate } from '../../../shared/segmentation/types';
import { addAsset } from '../../../shared/document/edits';
import { importOneImage, workingCopyRgba, type ImportRole } from './importImages';

export type ApplyEdit = (edit: (doc: ProjectDocument) => ProjectDocument) => void;

const ROLE_LABEL: Record<string, string> = {
  background: 'background',
  'character-prop': 'character/prop'
};

const STATUS_LABEL: Record<SegmentationJobUpdate['status'], string> = {
  queued: 'cutout queued…',
  'loading-model': 'loading the cutout model…',
  'cutting-out': 'cutting out…',
  done: 'cutout ready',
  failed: 'cutout failed',
  cancelled: 'cutout cancelled'
};

function Thumbnail({ projectDir, asset }: { projectDir: string; asset: Asset }): JSX.Element {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let objectUrl: string | undefined;
    let cancelled = false;
    // Thumbnails live in cache/ (disposable); cutouts are small enough to
    // show directly.
    const path = asset.type === 'cutout' ? asset.file : `cache/thumbnails/${asset.id}.png`;
    window.papercut
      .readProjectFile(projectDir, path)
      .then((bytes) => {
        if (cancelled) return;
        const copy = new Uint8Array(bytes);
        objectUrl = URL.createObjectURL(new Blob([copy.buffer as ArrayBuffer]));
        setUrl(objectUrl);
      })
      .catch(() => setUrl(undefined));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectDir, asset.id, asset.file, asset.type]);
  if (!url) return <span className="asset-thumb asset-thumb-empty" aria-hidden="true" />;
  return <img className="asset-thumb" src={url} alt="" />;
}

export function AssetsPanel({
  projectDir,
  document: doc,
  applyEdit
}: {
  projectDir: string;
  document: ProjectDocument;
  applyEdit: ApplyEdit;
}): JSX.Element {
  const [messages, setMessages] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<readonly string[] | undefined>(undefined);
  const [cutoutStatus, setCutoutStatus] = useState<ReadonlyMap<string, SegmentationJobUpdate>>(
    new Map()
  );
  // The freshest document, for edits made from async work.
  const docRef = useRef(doc);
  docRef.current = doc;

  useEffect(() => window.papercut.onCutoutUpdate((update) => {
    setCutoutStatus((old) => new Map(old).set(update.jobId, update));
  }), []);

  const say = (text: string): void => setMessages((old) => [...old.slice(-4), text]);

  const startCutout = (asset: Asset, bitmap: ImageBitmap): void => {
    let working;
    try {
      working = workingCopyRgba(bitmap);
    } catch (error) {
      say(String(error instanceof Error ? error.message : error));
      return;
    } finally {
      bitmap.close();
    }
    window.papercut
      .enqueueCutout(projectDir, asset.id, 'lite', working.rgba, working.width, working.height)
      .then((cutout) => applyEdit((current) => addAsset(current, cutout)))
      .catch(() => {
        // The status push already says failed/cancelled and why.
      });
  };

  const importBatch = async (paths: readonly string[], role: ImportRole): Promise<void> => {
    setBusy(true);
    try {
      const hashes: string[] = docRef.current.assets
        .map((a) => a.metadata.contentHash)
        .filter((h): h is string => h !== undefined);
      for (const path of paths) {
        const outcome = await importOneImage(projectDir, path, role, hashes);
        if (outcome.refused !== undefined || outcome.asset === undefined) {
          say(outcome.refused ?? `"${outcome.fileName}" could not be imported.`);
          continue;
        }
        const asset = outcome.asset;
        if (asset.metadata.contentHash !== undefined) hashes.push(asset.metadata.contentHash);
        applyEdit((current) => addAsset(current, asset));
        if (role === 'character-prop' && outcome.bitmap) {
          startCutout(asset, outcome.bitmap);
        } else {
          outcome.bitmap?.close();
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const importByButton = (role: ImportRole): void => {
    void window.papercut.chooseImportImages().then((paths) => {
      if (paths.length > 0) return importBatch(paths, role);
      return undefined;
    });
  };

  const onDrop = (event: React.DragEvent): void => {
    event.preventDefault();
    const paths = Array.from(event.dataTransfer.files).map((file) =>
      window.papercut.getPathForFile(file)
    );
    if (paths.length > 0) setPendingDrop(paths);
  };

  // A cutout exists for an image once an asset points back at it.
  const cutoutBySource = new Map<string, Asset>();
  for (const asset of doc.assets) {
    if (asset.type === 'cutout' && asset.metadata.sourceAssetId !== undefined) {
      cutoutBySource.set(asset.metadata.sourceAssetId, asset);
    }
  }

  const statusFor = (asset: Asset): { text: string; active: boolean; error?: string } => {
    if (asset.type !== 'image' || asset.metadata.role !== 'character-prop') {
      return { text: '—', active: false };
    }
    if (cutoutBySource.has(asset.id)) return { text: 'cutout ready', active: false };
    const update = cutoutStatus.get(asset.id);
    if (!update) return { text: 'no cutout', active: false };
    return {
      text: STATUS_LABEL[update.status],
      active: update.status === 'queued' || update.status === 'loading-model' || update.status === 'cutting-out',
      error: update.error
    };
  };

  return (
    <section
      className="panel assets-panel"
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <h2>Assets</h2>
      <div className="assets-actions">
        <button type="button" className="btn" disabled={busy} onClick={() => importByButton('background')}>
          + Background…
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => importByButton('character-prop')}
        >
          + Character / prop…
        </button>
        <span className="assets-hint">or drop image files anywhere on this panel</span>
      </div>

      {pendingDrop !== undefined && (
        <div className="assets-drop-choice">
          <span>
            {pendingDrop.length} file{pendingDrop.length === 1 ? '' : 's'} dropped — what are they?
          </span>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setPendingDrop(undefined);
              void importBatch(pendingDrop, 'background');
            }}
          >
            Backgrounds
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setPendingDrop(undefined);
              void importBatch(pendingDrop, 'character-prop');
            }}
          >
            Characters / props
          </button>
          <button type="button" className="btn" onClick={() => setPendingDrop(undefined)}>
            Cancel
          </button>
        </div>
      )}

      {doc.assets.length === 0 ? (
        <p className="opened-note">
          Nothing imported yet. Bring in your own photos — backgrounds, characters, props.
        </p>
      ) : (
        <ul className="asset-list">
          {doc.assets.map((asset) => {
            const status = statusFor(asset);
            const size =
              asset.metadata.width !== undefined && asset.metadata.height !== undefined
                ? `${asset.metadata.width}×${asset.metadata.height}`
                : '';
            return (
              <li key={asset.id} className="asset-row">
                <Thumbnail projectDir={projectDir} asset={asset} />
                <span className="asset-name" title={asset.file}>
                  {asset.metadata.originalFileName ?? asset.file}
                </span>
                <span className="asset-kind">
                  {asset.type === 'image'
                    ? (ROLE_LABEL[asset.metadata.role ?? ''] ?? 'image')
                    : asset.type}
                </span>
                <span className="asset-size">{size}</span>
                <span className={status.error !== undefined ? 'asset-status asset-status-error' : 'asset-status'}>
                  {status.text}
                  {status.error !== undefined ? ` — ${status.error}` : ''}
                </span>
                {status.active && (
                  <button
                    type="button"
                    className="btn asset-cancel"
                    onClick={() => void window.papercut.cancelCutout(asset.id)}
                  >
                    Cancel
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {messages.length > 0 && (
        <div className="assets-messages">
          {messages.map((message, index) => (
            <p key={index} className="error">
              {message}
            </p>
          ))}
          <button type="button" className="btn" onClick={() => setMessages([])}>
            Clear messages
          </button>
        </div>
      )}
    </section>
  );
}
