// The render-snapshot fixture (Phase 5, ADR-015): a small project generated
// entirely in code — a gradient background, an orange diamond with soft
// transparent edges, and a two-pose "character" — plus the fixed list of
// named moments the snapshot check renders through the REAL sceneStage.
// Lives under tests/fixtures and never ships (the build scan proves it).
//
// Every moment is deterministic: keyframe times sit on whole frames, and
// sampling times either sit on keyframes or hit exact easing fractions, so
// the only pixel wiggle between runs is the GPU's anti-aliasing — which
// the check's documented tolerance absorbs (decision h).

import {
  bobKeyframes,
  popKeyframes,
  shakeKeyframes,
  walkKeyframes
} from '../../app/shared/animation/presets';
import { applyKeyframes } from '../../app/shared/document/edits';
import type {
  CameraKeyframe,
  Keyframe,
  Layer,
  ProjectDocument,
  ProjectFormat,
  Scene,
  TransitionType
} from '../../app/shared/document/types';
import { pixelPng, type PixelRgba } from './png';

const FPS = 30;
const BG = 'snap-bg';
const BG2 = 'snap-bg2';
const SHAPE = 'snap-shape';
const POSE_A_ASSET = 'snap-pose-a';
const POSE_B_ASSET = 'snap-pose-b';
const CHARACTER = 'snap-char';
const POSE_A = 'pose-standing';
const POSE_B = 'pose-waving';

/** Rendered snapshot size per project format (16:9 default, 9:16 portrait). */
export const SNAPSHOT_SIZE: Record<string, { width: number; height: number }> = {
  '16:9': { width: 480, height: 270 },
  '9:16': { width: 270, height: 480 }
};

// ---- the fixture pictures, drawn pixel by pixel ----

function gradientBackground(): Uint8Array {
  const w = 480;
  const h = 270;
  return pixelPng(w, h, (x, y): PixelRgba => {
    const r = Math.round(24 + (110 * x) / (w - 1));
    const g = Math.round(36 + (80 * y) / (h - 1));
    return [r, g, 96, 255];
  });
}

/** Scene B's background (Phase 7): a clearly different ramp, so any part
    of either scene showing through a transition is unmistakable. */
function secondBackground(): Uint8Array {
  const w = 480;
  const h = 270;
  return pixelPng(w, h, (x, y): PixelRgba => {
    const r = Math.round(140 - (110 * x) / (w - 1));
    const b = Math.round(70 + (120 * y) / (h - 1));
    return [r, 46, b, 255];
  });
}

/** An orange diamond with a soft transparent edge (tests alpha blending). */
function diamondShape(): Uint8Array {
  const size = 200;
  const half = size / 2;
  return pixelPng(size, size, (x, y): PixelRgba => {
    const d = Math.abs(x - half) + Math.abs(y - half);
    if (d <= 70) return [255, 140, 26, 255];
    if (d <= 95) {
      const alpha = Math.round(255 * (1 - (d - 70) / 25));
      return [255, 140, 26, alpha];
    }
    return [0, 0, 0, 0];
  });
}

/** A simple figure: a head above a body, on a transparent ground. */
function figure(body: PixelRgba, stripe: PixelRgba): Uint8Array {
  const w = 120;
  const h = 240;
  return pixelPng(w, h, (x, y): PixelRgba => {
    const headDx = x - 60;
    const headDy = y - 40;
    if (headDx * headDx + headDy * headDy <= 32 * 32) return [235, 210, 180, 255];
    if (y >= 80 && x >= 30 && x < 90) {
      // A diagonal stripe tells the two poses apart at a glance.
      return (x + y) % 40 < 12 ? stripe : body;
    }
    return [0, 0, 0, 0];
  });
}

/** The fixture pictures, by asset id — decode these into the texture map. */
export function snapshotAssetBytes(): ReadonlyMap<string, Uint8Array> {
  return new Map([
    [BG, gradientBackground()],
    [BG2, secondBackground()],
    [SHAPE, diamondShape()],
    [POSE_A_ASSET, figure([40, 90, 200, 255], [90, 140, 240, 255])],
    [POSE_B_ASSET, figure([40, 160, 80, 255], [110, 220, 140, 255])]
  ]);
}

// ---- the document each moment renders ----

function kf(time: number, x: number, y: number, extra: Partial<Keyframe> = {}): Keyframe {
  return { time, x, y, scale: 1, rotation: 0, flipX: false, opacity: 1, easing: 'linear', ...extra };
}

function shapeLayer(keyframes: Keyframe[]): Layer {
  return { id: 'snap-layer-shape', name: 'Diamond', source: { kind: 'prop', assetId: SHAPE }, keyframes };
}

function characterLayer(keyframes: Keyframe[]): Layer {
  return {
    id: 'snap-layer-char',
    name: 'Figure',
    source: { kind: 'character', characterId: CHARACTER },
    keyframes
  };
}

function buildDocument(
  format: ProjectFormat,
  layers: Layer[],
  cameraKeyframes: CameraKeyframe[] = []
): ProjectDocument {
  const scene: Scene = {
    id: 'snap-scene',
    name: 'Snapshot scene',
    durationSeconds: 4,
    backgroundAssetId: BG,
    cameraKeyframes,
    layers,
    audioClips: []
  };
  return {
    schemaVersion: 1,
    name: 'Snapshot fixture',
    format,
    fps: FPS,
    assets: [
      { id: BG, type: 'image', file: 'assets/images/bg.png', metadata: { width: 480, height: 270 } },
      { id: BG2, type: 'image', file: 'assets/images/bg2.png', metadata: { width: 480, height: 270 } },
      { id: SHAPE, type: 'cutout', file: 'assets/cutouts/shape.png', metadata: { width: 200, height: 200 } },
      { id: POSE_A_ASSET, type: 'cutout', file: 'assets/cutouts/a.png', metadata: { width: 120, height: 240 } },
      { id: POSE_B_ASSET, type: 'cutout', file: 'assets/cutouts/b.png', metadata: { width: 120, height: 240 } }
    ],
    characters: [
      {
        id: CHARACTER,
        name: 'Figure',
        poses: [
          { id: POSE_A, name: 'standing', cutoutAssetId: POSE_A_ASSET },
          { id: POSE_B, name: 'waving', cutoutAssetId: POSE_B_ASSET }
        ]
      }
    ],
    scenes: [scene]
  };
}

/** Bakes a preset into the document's shape/character layer, as the app would. */
function withPreset(
  doc: ProjectDocument,
  layerId: string,
  make: (layer: Layer) => Keyframe[]
): ProjectDocument {
  const layer = doc.scenes[0]!.layers.find((l) => l.id === layerId)!;
  return applyKeyframes(doc, 'snap-scene', layerId, make(layer));
}

export interface SnapshotMoment {
  readonly name: string;
  readonly document: ProjectDocument;
  /** The second the moment renders at. */
  readonly time: number;
}

/** The fixed list of named moments, in contact-sheet order. */
export function snapshotMoments(): readonly SnapshotMoment[] {
  const easeMid = (easing: Keyframe['easing']): ProjectDocument =>
    buildDocument('16:9', [
      shapeLayer([kf(0, 300, 540, { easing }), kf(4, 1620, 540)]),
      characterLayer([kf(0, 480, 700, { scale: 1.2, poseId: POSE_A })])
    ]);

  const staticDoc = buildDocument('16:9', [
    shapeLayer([kf(0, 960, 540)]),
    characterLayer([kf(0, 480, 700, { scale: 1.2, poseId: POSE_A })])
  ]);

  return [
    { name: 'static', document: staticDoc, time: 0 },
    { name: 'ease-linear', document: easeMid('linear'), time: 2 },
    { name: 'ease-in', document: easeMid('ease-in'), time: 2 },
    { name: 'ease-out', document: easeMid('ease-out'), time: 2 },
    { name: 'ease-in-out', document: easeMid('ease-in-out'), time: 2 },
    {
      name: 'rotate-flip',
      document: buildDocument('16:9', [
        shapeLayer([kf(0, 960, 540), kf(2, 960, 540, { rotation: 45, flipX: true }), kf(4, 960, 540, { rotation: 90, flipX: true })]),
        characterLayer([kf(0, 1400, 700, { scale: 1.2, flipX: true, poseId: POSE_A })])
      ]),
      time: 3
    },
    {
      name: 'opacity',
      document: buildDocument('16:9', [shapeLayer([kf(0, 960, 540), kf(4, 960, 540, { opacity: 0.2 })])]),
      time: 2
    },
    {
      name: 'pose-swap',
      document: buildDocument('16:9', [
        characterLayer([kf(0, 960, 640, { scale: 1.4, poseId: POSE_A }), kf(2, 960, 640, { scale: 1.4, poseId: POSE_B })])
      ]),
      time: 3
    },
    {
      name: 'camera-zoom-pan',
      document: buildDocument(
        '16:9',
        [
          shapeLayer([kf(0, 1300, 700)]),
          characterLayer([kf(0, 800, 640, { scale: 1.2, poseId: POSE_A })])
        ],
        [
          { time: 0, x: 960, y: 540, zoom: 1, easing: 'linear' },
          { time: 4, x: 1300, y: 700, zoom: 1.8, easing: 'linear' }
        ]
      ),
      time: 3
    },
    {
      name: 'preset-bob',
      document: withPreset(
        buildDocument('16:9', [shapeLayer([kf(0, 960, 540)])]),
        'snap-layer-shape',
        (layer) => bobKeyframes(layer, { startTime: 0, endTime: 2, fps: FPS, amount: 60 })
      ),
      time: 0.3 // the first dip: 60 px above resting
    },
    {
      name: 'preset-shake',
      document: withPreset(
        buildDocument('16:9', [shapeLayer([kf(0, 960, 540)])]),
        'snap-layer-shape',
        (layer) => shakeKeyframes(layer, { startTime: 0, endTime: 1, fps: FPS, amount: 40 })
      ),
      time: 2 / FPS // the first jolt to the right
    },
    {
      name: 'preset-walk',
      document: withPreset(
        buildDocument('16:9', [characterLayer([kf(0, 400, 800, { poseId: POSE_A })])]),
        'snap-layer-char',
        (layer) =>
          walkKeyframes(layer, {
            startTime: 0,
            endTime: 2,
            fps: FPS,
            destination: { x: 1500, y: 800 },
            bobAmount: 40
          })
      ),
      time: 0.9 // mid-stride, hopped up
    },
    {
      name: 'preset-pop',
      document: withPreset(
        buildDocument('16:9', [shapeLayer([kf(0, 1400, 300, { scale: 0.8 })])]),
        'snap-layer-shape',
        (layer) => popKeyframes(layer, { startTime: 0, durationSeconds: 0.5, fps: FPS })
      ),
      time: 11 / FPS // the 1.15× overshoot
    },
    {
      // The one portrait moment (Alek's addition): proves the 9:16
      // reference space renders right, at 270×480.
      name: 'portrait-pose-swap',
      document: buildDocument('9:16', [
        characterLayer([
          kf(0, 540, 1300, { scale: 1.5, poseId: POSE_A }),
          kf(2, 540, 1300, { scale: 1.5, poseId: POSE_B })
        ])
      ]),
      time: 3
    }
  ];
}

// ---- the Phase 7 transition moments, through the REAL projectStage ----

/**
 * Two clearly different scenes joined by the named transition: scene A is
 * the fixture's usual look (gradient, diamond, standing figure), scene B
 * has the other background ramp, the waving pose and the diamond small
 * and turned — so at mid-transition every visible strip, fade or scaled
 * copy is unmistakably one scene or the other. A 1 s transition on a 4 s
 * scene A puts the overlap at 3–4 s (scene B starts globally at 3 s); a
 * cut puts scene B's first frame at exactly 4 s.
 */
function buildTwoSceneDocument(transition: TransitionType): ProjectDocument {
  const base = buildDocument('16:9', [
    shapeLayer([kf(0, 600, 540)]),
    characterLayer([kf(0, 1300, 700, { scale: 1.2, poseId: POSE_A })])
  ]);
  const sceneA: Scene = {
    ...base.scenes[0]!,
    transitionOut: transition,
    ...(transition === 'cut' ? {} : { transitionOutSeconds: 1 })
  };
  const sceneB: Scene = {
    id: 'snap-scene-b',
    name: 'Snapshot scene B',
    durationSeconds: 4,
    backgroundAssetId: BG2,
    cameraKeyframes: [],
    layers: [
      {
        id: 'snap-layer-shape-b',
        name: 'Diamond B',
        source: { kind: 'prop', assetId: SHAPE },
        keyframes: [kf(0, 1500, 300, { scale: 0.7, rotation: 45 })]
      },
      {
        id: 'snap-layer-char-b',
        name: 'Figure B',
        source: { kind: 'character', characterId: CHARACTER },
        keyframes: [kf(0, 700, 640, { scale: 1.4, poseId: POSE_B })]
      }
    ],
    audioClips: []
  };
  return { ...base, scenes: [sceneA, sceneB] };
}

export interface ProjectSnapshotMoment {
  readonly name: string;
  readonly document: ProjectDocument;
  /** The GLOBAL second the moment renders at, through projectStage. */
  readonly globalTime: number;
}

/**
 * The nine Phase 7 moments (decision o), in contact-sheet order: every
 * transition type mid-progress (global 3.5 s = progress 0.5 of the 1 s
 * overlap starting at 3 s), and the first frame after a cut (global 4 s,
 * scene B's local 0).
 */
export function projectSnapshotMoments(): readonly ProjectSnapshotMoment[] {
  const mid = (type: TransitionType): ProjectSnapshotMoment => ({
    name: `transition-${type}`,
    document: buildTwoSceneDocument(type),
    globalTime: 3.5
  });
  return [
    mid('crossfade'),
    mid('slide-left'),
    mid('slide-right'),
    mid('slide-up'),
    mid('slide-down'),
    mid('zoom-in'),
    mid('zoom-out'),
    mid('wipe'),
    { name: 'cut-first-frame', document: buildTwoSceneDocument('cut'), globalTime: 4 }
  ];
}
