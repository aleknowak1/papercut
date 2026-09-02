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
  /** Reads a file inside the project folder (e.g. "assets/audio/x.wav"). */
  readProjectFile(projectDir: string, relativePath: string): Promise<Uint8Array>;
  /** Writes a file inside the project folder. Refuses paths that lead outside it. */
  writeProjectFile(projectDir: string, relativePath: string, data: Uint8Array): Promise<void>;
  /** Validates and saves the document as the project's project.json (atomic). */
  saveProjectDocument(projectDir: string, document: ProjectDocument): Promise<void>;

  // Development only — the main process registers these only outside
  // packaged builds; they serve the export check and dev tools.
  devCreateScratchProject(
    name: string,
    format: ProjectFormat,
    where: 'temp' | 'tests-output'
  ): Promise<OpenedProject>;
  /** Delivers the export check's result to the main process, which prints it and exits. */
  devReportExportCheck(payloadJson: string): void;
}

export const IPC_CHANNELS = {
  getVersion: 'app:get-version',
  chooseParentFolder: 'dialog:choose-parent-folder',
  chooseProjectFolder: 'dialog:choose-project-folder',
  createProject: 'project:create',
  openProject: 'project:open',
  listRecents: 'recents:list',
  readProjectFile: 'project:read-file',
  writeProjectFile: 'project:write-file',
  saveProjectDocument: 'project:save-document',
  devCreateScratchProject: 'dev:create-scratch-project',
  devReportExportCheck: 'dev:report-export-check'
} as const;
