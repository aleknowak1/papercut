// The Project Document: the single source of truth for everything in a
// project (DOC-03 §3). The UI reads it, edits produce new copies of it
// (see edits.ts), and undo/redo steps through its history (see history.ts).
//
// Every field is readonly on purpose: nothing may modify a document in
// place. TypeScript enforces this at compile time.

export type ProjectFormat = '9:16' | '16:9' | '1:1';

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export type TransitionType =
  | 'cut'
  | 'crossfade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'wipe';

export type AssetType = 'image' | 'cutout' | 'audio';

export interface AssetMetadata {
  /** The file name the user imported, for display. */
  readonly originalFileName?: string;
  readonly width?: number;
  readonly height?: number;
  readonly durationSeconds?: number;
}

export interface Asset {
  readonly id: string;
  readonly type: AssetType;
  /** Path relative to the project folder, e.g. "assets/images/abc.jpg". */
  readonly file: string;
  readonly metadata: AssetMetadata;
}

export interface Pose {
  readonly id: string;
  readonly name: string;
  readonly cutoutAssetId: string;
}

export interface Character {
  readonly id: string;
  readonly name: string;
  readonly poses: readonly Pose[];
  /** Voice id from the voice picker; absent until one is chosen (Phase 11). */
  readonly voice?: string;
}

export interface CameraKeyframe {
  readonly time: number;
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
  readonly easing: EasingType;
}

export type LayerSource =
  | { readonly kind: 'character'; readonly characterId: string }
  | { readonly kind: 'prop'; readonly assetId: string }
  | { readonly kind: 'text'; readonly text: string };

export interface Keyframe {
  readonly time: number;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly rotation: number;
  readonly flipX: boolean;
  readonly opacity: number;
  readonly easing: EasingType;
  /** For character layers: the pose shown from this keyframe on. */
  readonly poseId?: string;
}

export interface Layer {
  readonly id: string;
  readonly name: string;
  readonly source: LayerSource;
  readonly keyframes: readonly Keyframe[];
}

export interface TtsLine {
  readonly characterId: string;
  readonly text: string;
  /** Plain-English delivery instruction, e.g. "deadpan, slightly annoyed". */
  readonly delivery: string;
  readonly voice: string;
  /** The generated audio asset, once it exists; the cache key (DOC-09 rule 3). */
  readonly cachedAssetId?: string;
}

export type AudioClipSource =
  | { readonly kind: 'asset'; readonly assetId: string }
  | { readonly kind: 'tts'; readonly ttsLine: TtsLine };

export interface AudioClip {
  readonly id: string;
  readonly source: AudioClipSource;
  readonly startSeconds: number;
  /** 0..1 */
  readonly volume: number;
  readonly fadeInSeconds: number;
  readonly fadeOutSeconds: number;
  /** Layer this clip is attached to (drives the talking indicator later). */
  readonly attachedToLayerId?: string;
}

export interface Scene {
  readonly id: string;
  readonly name: string;
  readonly durationSeconds: number;
  readonly backgroundAssetId?: string;
  readonly cameraKeyframes: readonly CameraKeyframe[];
  readonly layers: readonly Layer[];
  readonly audioClips: readonly AudioClip[];
  readonly transitionOut?: TransitionType;
}

export interface ProjectDocument {
  /** Bumped only when the saved format changes shape; guards project.json loading. */
  readonly schemaVersion: 1;
  readonly name: string;
  readonly format: ProjectFormat;
  readonly fps: number;
  readonly assets: readonly Asset[];
  readonly characters: readonly Character[];
  readonly scenes: readonly Scene[];
}

export const PROJECT_FORMATS: readonly ProjectFormat[] = ['9:16', '16:9', '1:1'];
export const DEFAULT_FPS = 30;
