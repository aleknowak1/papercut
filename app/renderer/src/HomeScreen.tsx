import { useEffect, useState, type JSX } from 'react';
import type { OpenedProject, RecentProject } from '../../shared/ipc';
import { PROJECT_FORMATS, type ProjectFormat } from '../../shared/document/types';

const FORMAT_LABELS: Record<ProjectFormat, string> = {
  '9:16': 'vertical',
  '16:9': 'widescreen',
  '1:1': 'square'
};

const FORMAT_CLASSES: Record<ProjectFormat, string> = {
  '9:16': 'format-916',
  '16:9': 'format-169',
  '1:1': 'format-11'
};

/** Electron wraps IPC errors in "Error invoking remote method '...': Error: " noise. */
function plainErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const marker = ': Error: ';
  const index = message.indexOf(marker);
  return index >= 0 ? message.slice(index + marker.length) : message;
}

interface HomeScreenProps {
  readonly onProjectOpened: (opened: OpenedProject) => void;
}

export function HomeScreen({ onProjectOpened }: HomeScreenProps): JSX.Element {
  const [name, setName] = useState('');
  const [format, setFormat] = useState<ProjectFormat>('9:16');
  const [parentDir, setParentDir] = useState<string | undefined>(undefined);
  const [recents, setRecents] = useState<readonly RecentProject[]>([]);
  const [version, setVersion] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void window.papercut.getVersion().then(setVersion);
    void window.papercut.listRecents().then(setRecents);
  }, []);

  const canCreate = name.trim() !== '' && parentDir !== undefined && !busy;

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError(plainErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const chooseLocation = (): Promise<void> =>
    run(async () => {
      const dir = await window.papercut.chooseParentFolder();
      if (dir !== undefined) setParentDir(dir);
    });

  const createProject = (): Promise<void> =>
    run(async () => {
      if (!canCreate || parentDir === undefined) return;
      onProjectOpened(await window.papercut.createProject(parentDir, name.trim(), format));
    });

  const openExisting = (): Promise<void> =>
    run(async () => {
      const dir = await window.papercut.chooseProjectFolder();
      if (dir === undefined) return;
      onProjectOpened(await window.papercut.openProject(dir));
    });

  const openRecent = (dir: string): Promise<void> =>
    run(async () => {
      onProjectOpened(await window.papercut.openProject(dir));
    });

  return (
    <div className="home">
      <header className="home-masthead">
        <h1 className="wordmark">PAPERCUT</h1>
        <span className="tagline">your photos, animated, talking</span>
      </header>

      <div className="home-columns">
        <section className="panel panel-new" aria-label="New project">
          <h2>New project</h2>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void createProject();
            }}
          >
            <div className="field">
              <label className="field-label" htmlFor="project-name">
                Name
              </label>
              <input
                id="project-name"
                type="text"
                value={name}
                autoFocus
                spellCheck={false}
                onChange={(event) => setName(event.target.value)}
                placeholder="My first video"
              />
            </div>

            <div className="field">
              <span className="field-label" id="format-label">
                Format
              </span>
              <div className="format-row" role="group" aria-labelledby="format-label">
                {PROJECT_FORMATS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`format-option ${FORMAT_CLASSES[option]}`}
                    aria-pressed={format === option}
                    onClick={() => setFormat(option)}
                  >
                    <span className="format-glyph" aria-hidden="true" />
                    <span>
                      {option} {FORMAT_LABELS[option]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field-label">Save location</span>
              <div className="location-row">
                <span className="location-path">
                  {parentDir ?? 'no folder chosen yet'}
                </span>
                <button type="button" className="btn" onClick={() => void chooseLocation()}>
                  Choose…
                </button>
              </div>
            </div>

            {error !== undefined && <p className="error" role="alert">{error}</p>}

            <button type="submit" className="btn-primary" disabled={!canCreate}>
              Create project
            </button>
          </form>
        </section>

        <section className="panel panel-open" aria-label="Open project">
          <h2>Open</h2>
          <button type="button" className="btn" onClick={() => void openExisting()}>
            Open a project folder…
          </button>

          <span className="field-label">Recent</span>
          {recents.length === 0 ? (
            <p className="recent-empty">Nothing yet. Projects you create appear here.</p>
          ) : (
            <ul className="recent-list">
              {recents.map((recent) => (
                <li key={recent.dir}>
                  <button
                    type="button"
                    className="recent-item"
                    onClick={() => void openRecent(recent.dir)}
                  >
                    <span className="recent-name">
                      {recent.name} · {recent.format}
                    </span>
                    <span className="recent-dir">{recent.dir}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className="home-footer">
        <span>v{version}</span>
      </footer>
    </div>
  );
}
