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
import { Thumbnail } from './Thumbnail';
import { formatDuration, importOneAudio, isAudioPath } from './importAudio';
import { importOneImage, workingCopyRgba, type ImportRole } from './importImages';

export type ApplyEdit = (edit: (doc: ProjectDocument) => ProjectDocument) => void;

const ROLE_LABEL: Record<string, string> = {
  background: 'background',
  'character-prop': 'character/prop'
};

/** A per-row play/stop toggle for imported sounds (Chromium plays the file). */
function PlayButton({ projectDir, asset }: { projectDir: string; asset: Asset }): JSX.Element {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | undefined>(undefined);
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
    };
  }, []);
  const toggle = (): void => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    void window.papercut.readProjectFile(projectDir, asset.file).then((bytes) => {
      const copy = new Uint8Array(bytes);
      const url = URL.createObjectURL(new Blob([copy.buffer as ArrayBuffer]));
      if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      void audio.play();
      setPlaying(true);
    });
  };
  return (
    <button type="button" className="btn asset-cancel" onClick={toggle} title="Play this sound">
      {playing ? '■ Stop' : '► Play'}
    </button>
  );
}

const STATUS_LABEL: Record<SegmentationJobUpdate['status'], string> = {
  queued: 'cutout queued…',
  'loading-model': 'loading the cutout model…',
  'cutting-out': 'cutting out…',
  done: 'cutout ready',
  failed: 'cutout failed',
  cancelled: 'cutout cancelled'
};

export function AssetsPanel({
  projectDir,
  document: doc,
  applyEdit,
  onEditMask
}: {
  projectDir: string;
  document: ProjectDocument;
  applyEdit: ApplyEdit;
  onEditMask?: (assetId: string) => void;
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

  const importAudioBatch = async (paths: readonly string[]): Promise<void> => {
    setBusy(true);
    try {
      const hashes: string[] = docRef.current.assets
        .map((a) => a.metadata.contentHash)
        .filter((h): h is string => h !== undefined);
      for (const path of paths) {
        const outcome = await importOneAudio(projectDir, path, hashes);
        if (outcome.refused !== undefined || outcome.asset === undefined) {
          say(outcome.refused ?? `"${outcome.fileName}" could not be imported.`);
          continue;
        }
        const asset = outcome.asset;
        if (asset.metadata.contentHash !== undefined) hashes.push(asset.metadata.contentHash);
        applyEdit((current) => addAsset(current, asset));
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

  const importAudioByButton = (): void => {
    void window.papercut.chooseImportAudio().then((paths) => {
      if (paths.length > 0) return importAudioBatch(paths);
      return undefined;
    });
  };

  const onDrop = (event: React.DragEvent): void => {
    event.preventDefault();
    const paths = Array.from(event.dataTransfer.files).map((file) =>
      window.papercut.getPathForFile(file)
    );
    // Sounds import straight away; pictures first ask what they are.
    const audioPaths = paths.filter(isAudioPath);
    const imagePaths = paths.filter((p) => !isAudioPath(p));
    if (audioPaths.length > 0) void importAudioBatch(audioPaths);
    if (imagePaths.length > 0) setPendingDrop(imagePaths);
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
        <button type="button" className="btn" disabled={busy} onClick={importAudioByButton}>
          + Audio…
        </button>
        <span className="assets-hint">or drop image/sound files anywhere on this panel</span>
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
              asset.type === 'audio'
                ? asset.metadata.durationSeconds !== undefined
                  ? formatDuration(asset.metadata.durationSeconds)
                  : ''
                : asset.metadata.width !== undefined && asset.metadata.height !== undefined
                  ? `${asset.metadata.width}×${asset.metadata.height}`
                  : '';
            return (
              <li key={asset.id} className="asset-row">
                {asset.type === 'audio' ? (
                  <span className="asset-thumb asset-thumb-audio" aria-hidden="true">
                    ♪
                  </span>
                ) : (
                  <Thumbnail projectDir={projectDir} asset={asset} />
                )}
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
                {asset.type === 'audio' && <PlayButton projectDir={projectDir} asset={asset} />}
                {asset.type === 'cutout' && onEditMask && (
                  <button
                    type="button"
                    className="btn asset-cancel"
                    title="Open the mask editor for this cutout"
                    onClick={() => onEditMask(asset.id)}
                  >
                    Edit mask
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
