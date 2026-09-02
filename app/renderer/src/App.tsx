import { useState, type JSX } from 'react';
import type { OpenedProject } from '../../shared/ipc';
import { HomeScreen } from './HomeScreen';

export function App(): JSX.Element {
  const [opened, setOpened] = useState<OpenedProject | undefined>(undefined);

  if (opened === undefined) {
    return <HomeScreen onProjectOpened={setOpened} />;
  }

  // The editor arrives in later phases; for now, opening a project shows
  // what was loaded so creating and reopening can be tried end to end.
  const doc = opened.document;
  return (
    <div className="opened">
      <h1 className="wordmark">PAPERCUT</h1>
      <dl>
        <dt>Project</dt>
        <dd>{doc.name}</dd>
        <dt>Format</dt>
        <dd>{doc.format}</dd>
        <dt>Frame rate</dt>
        <dd>{doc.fps} fps</dd>
        <dt>Scenes</dt>
        <dd>{doc.scenes.length}</dd>
        <dt>Folder</dt>
        <dd>{opened.projectDir}</dd>
      </dl>
      <p className="opened-note">
        The editor is built in the next phases. This page confirms the project
        opened correctly from its folder.
      </p>
      <button type="button" className="btn" onClick={() => setOpened(undefined)}>
        ← Back to Home
      </button>
    </div>
  );
}
