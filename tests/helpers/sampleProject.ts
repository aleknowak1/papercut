// Builds a small but complete sample project entirely in code, touching
// every part of the document format: assets, a character with poses, layers,
// keyframes, an audio clip, a TTS line, camera, and a transition.
import { newId } from '../../app/shared/document/create';
import type { ProjectDocument } from '../../app/shared/document/types';

export function sampleProject(): ProjectDocument {
  const bgAsset = newId();
  const cutoutA = newId();
  const cutoutB = newId();
  const audioAsset = newId();
  const characterId = newId();
  const poseA = newId();
  const poseB = newId();
  const layerId = newId();

  return {
    schemaVersion: 1,
    name: 'Sample',
    format: '9:16',
    fps: 30,
    assets: [
      { id: bgAsset, type: 'image', file: 'assets/images/bg.jpg', metadata: { originalFileName: 'bg.jpg', width: 1080, height: 1920 } },
      { id: cutoutA, type: 'cutout', file: 'assets/cutouts/a.png', metadata: { width: 400, height: 800 } },
      { id: cutoutB, type: 'cutout', file: 'assets/cutouts/b.png', metadata: { width: 400, height: 800 } },
      { id: audioAsset, type: 'audio', file: 'assets/audio/step.wav', metadata: { durationSeconds: 1.2 } }
    ],
    characters: [
      {
        id: characterId,
        name: 'Dave',
        poses: [
          { id: poseA, name: 'standing', cutoutAssetId: cutoutA },
          { id: poseB, name: 'shocked', cutoutAssetId: cutoutB }
        ],
        voice: 'voice-1'
      }
    ],
    scenes: [
      {
        id: newId(),
        name: 'Scene 1',
        durationSeconds: 10,
        backgroundAssetId: bgAsset,
        cameraKeyframes: [
          { time: 0, x: 0, y: 0, zoom: 1, easing: 'linear' },
          { time: 5, x: 100, y: 0, zoom: 1.2, easing: 'ease-in-out' }
        ],
        layers: [
          {
            id: layerId,
            name: 'Dave',
            source: { kind: 'character', characterId },
            keyframes: [
              { time: 0, x: -200, y: 800, scale: 1, rotation: 0, flipX: false, opacity: 1, easing: 'ease-out', poseId: poseA },
              { time: 2, x: 300, y: 800, scale: 1, rotation: 0, flipX: false, opacity: 1, easing: 'linear', poseId: poseB }
            ]
          }
        ],
        audioClips: [
          {
            id: newId(),
            source: { kind: 'asset', assetId: audioAsset },
            startSeconds: 0.5,
            volume: 0.8,
            fadeInSeconds: 0,
            fadeOutSeconds: 0.2
          },
          {
            id: newId(),
            source: {
              kind: 'tts',
              ttsLine: { characterId, text: "That's not mine.", delivery: 'deadpan', voice: 'voice-1' }
            },
            startSeconds: 2,
            volume: 1,
            fadeInSeconds: 0,
            fadeOutSeconds: 0,
            attachedToLayerId: layerId
          }
        ],
        transitionOut: 'crossfade'
      },
      {
        id: newId(),
        name: 'Scene 2',
        durationSeconds: 4,
        cameraKeyframes: [],
        layers: [],
        audioClips: []
      }
    ]
  };
}
