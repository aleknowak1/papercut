// A small preview for an asset row: cutouts are shown directly (they are
// PNGs with transparency); images use the cache/thumbnails/ file the import
// wrote (cache/ is disposable; a missing thumbnail just shows the empty
// checker square).

import { useEffect, useState, type JSX } from 'react';
import type { Asset } from '../../../shared/document/types';

export function Thumbnail({ projectDir, asset }: { projectDir: string; asset: Asset }): JSX.Element {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let objectUrl: string | undefined;
    let cancelled = false;
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
