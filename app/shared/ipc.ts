// The contract between the UI and the main process. The preload script
// implements this interface and exposes it to the page as window.papercut;
// the main process answers each call. Keeping the type here means both
// sides are checked against the same definition.

import type { ProjectDocument, ProjectFormat } from './document/types';

export interface RecentProject {
  readonly dir: string;
  readonly name: string;
  readonly format: ProjectFormat;
  readonly lastOpenedIso: string;
}

export interface OpenedProject {
  readonly projectDir: string;
  readonly document: ProjectDocument;
}

export interface PapercutApi {
  getVersion(): Promise<string>;
  /** Folder picker for where a new project will be created. Undefined = cancelled. */
  chooseParentFolder(): Promise<string | undefined>;
  /** Folder picker for an existing .papercut project. Undefined = cancelled. */
  chooseProjectFolder(): Promise<string | undefined>;
  createProject(
    parentDir: string,
    name: string,
    format: ProjectFormat
  ): Promise<OpenedProject>;
  openProject(projectDir: string): Promise<OpenedProject>;
  listRecents(): Promise<readonly RecentProject[]>;
}

export const IPC_CHANNELS = {
  getVersion: 'app:get-version',
  chooseParentFolder: 'dialog:choose-parent-folder',
  chooseProjectFolder: 'dialog:choose-project-folder',
  createProject: 'project:create',
  openProject: 'project:open',
  listRecents: 'recents:list'
} as const;
