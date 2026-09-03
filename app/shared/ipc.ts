// The contract between the UI and the main process. The preload script
// implements this interface and exposes it to the page as window.papercut;
// the main process answers each call. Keeping the type here means both
// sides are checked against the same definition.

import type { Asset, ProjectDocument, ProjectFormat } from './document/types';
import type { SegmentationJobUpdate, SegmentationModel } from './segmentation/types';

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

/** One rendered snapshot frame against its approved reference (dev only). */
export interface SnapshotCompareResult {
  readonly name: string;
  /** 'new' = no reference existed; this frame was written as the first one. */
  readonly status: 'match' | 'new' | 'mismatch';
  /** Pixels off by more than the per-channel tolerance, and the total. */
  readonly badPixels: number;
  readonly totalPixels: number;
}

export interface SnapshotRunSummary {
  readonly results: readonly SnapshotCompareResult[];
  /** Where expected/actual/diff images were left — only on a mismatch. */
  readonly outputDir?: string;
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

  // ---- Asset import and cutouts (Phase 3) ----

  /** File picker for images to import. Empty list = cancelled. */
  chooseImportImages(): Promise<readonly string[]>;
  /** The absolute path of a file dragged into the window. */
  getPathForFile(file: File): string;
  /**
   * Reads a file the user picked for import (image types only), so the UI
   * can prove it decodes before anything is copied into the project.
   */
  readImportFile(sourcePath: string): Promise<Uint8Array>;
  /**
   * Copies the file unchanged into assets/images/ and returns the asset
   * record (with content hash). Throws in plain language for duplicates
   * (same bytes as an existingHashes entry) and unsupported types.
   */
  importImageAsset(
    projectDir: string,
    sourcePath: string,
    role: 'background' | 'character-prop',
    info: { width: number; height: number; existingHashes: readonly string[] }
  ): Promise<Asset>;
  /** File picker for sounds to import. Empty list = cancelled. */
  chooseImportAudio(): Promise<readonly string[]>;
  /** Reads a sound file the user picked (audio types only), for decoding. */
  readImportAudioFile(sourcePath: string): Promise<Uint8Array>;
  /** Copies the sound unchanged into assets/audio/ and returns the record. */
  importAudioAsset(
    projectDir: string,
    sourcePath: string,
    info: { durationSeconds: number; existingHashes: readonly string[] }
  ): Promise<Asset>;
  /**
   * Queues an automatic cutout for an imported image (raw RGBA pixels,
   * already capped per ADR-017). Resolves with the cutout asset record once
   * the file is written; rejects on failure or cancellation. Progress
   * arrives through onCutoutUpdate.
   */
  enqueueCutout(
    projectDir: string,
    sourceAssetId: string,
    model: SegmentationModel,
    rgba: Uint8Array,
    width: number,
    height: number
  ): Promise<Asset>;
  /** Cancels the queued or running cutout for that image. */
  cancelCutout(sourceAssetId: string): Promise<boolean>;
  /**
   * The exact pixels of a cutout file (RGB = working copy, alpha = mask),
   * decoded losslessly in the main process — the mask editor's input.
   */
  readCutoutPixels(
    projectDir: string,
    relativePath: string
  ): Promise<{ width: number; height: number; rgba: Uint8Array }>;
  /**
   * Writes the next cutout version: the current file's RGB plus the edited
   * alpha (never through a canvas). Returns the new relative path for the
   * one document repoint edit.
   */
  saveCutoutVersion(
    projectDir: string,
    currentRelativePath: string,
    alpha: Uint8Array,
    width: number,
    height: number
  ): Promise<string>;
  /** Subscribes to cutout status pushes; returns an unsubscribe function. */
  onCutoutUpdate(listener: (update: SegmentationJobUpdate) => void): () => void;

  // Development only — the main process registers these only outside
  // packaged builds; they serve the export check and dev tools.
  devCreateScratchProject(
    name: string,
    format: ProjectFormat,
    where: 'temp' | 'tests-output'
  ): Promise<OpenedProject>;
  /** Delivers the export check's result to the main process, which prints it and exits. */
  devReportExportCheck(payloadJson: string): void;
  /**
   * Compares one rendered snapshot frame against its approved reference in
   * tests/snapshots/ (writing it as the new reference when none exists yet).
   */
  devCompareSnapshot(
    name: string,
    width: number,
    height: number,
    rgba: Uint8Array
  ): Promise<SnapshotCompareResult>;
  /** Ends a snapshot run: writes the contact sheet for any mismatches and returns the summary. */
  devFinishSnapshots(): Promise<SnapshotRunSummary>;

  /** Appends one line to logs/startup.log in the user-data folder (CL-0022 diagnostics). */
  logStartup(message: string): void;
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
  chooseImportImages: 'dialog:choose-import-images',
  readImportFile: 'import:read-file',
  importImageAsset: 'import:image-asset',
  chooseImportAudio: 'dialog:choose-import-audio',
  readImportAudioFile: 'import:read-audio-file',
  importAudioAsset: 'import:audio-asset',
  enqueueCutout: 'segmentation:enqueue',
  cancelCutout: 'segmentation:cancel',
  cutoutUpdate: 'segmentation:update',
  readCutoutPixels: 'cutout:read-pixels',
  saveCutoutVersion: 'cutout:save-version',
  devCreateScratchProject: 'dev:create-scratch-project',
  devReportExportCheck: 'dev:report-export-check',
  devCompareSnapshot: 'dev:compare-snapshot',
  devFinishSnapshots: 'dev:finish-snapshots',
  startupLog: 'startup:log'
} as const;
