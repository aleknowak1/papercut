// The scene strip's pure rules (Phase 7, ADR-015): new-scene naming and
// which neighbour survives a delete as the selection.

import { describe, expect, it } from 'vitest';
import type { Scene } from '../../app/shared/document/types';
import { neighbourAfterRemoval, nextSceneName } from '../../app/shared/scene/sceneList';

function scene(id: string, name: string): Scene {
  return { id, name, durationSeconds: 5, cameraKeyframes: [], layers: [], audioClips: [] };
}

describe('nextSceneName', () => {
  it('counts up from the number of scenes', () => {
    expect(nextSceneName([scene('a', 'Scene 1')])).toBe('Scene 2');
    expect(nextSceneName([scene('a', 'Scene 1'), scene('b', 'Scene 2')])).toBe('Scene 3');
  });

  it('skips names already taken', () => {
    // Two scenes, but one is already called "Scene 3" (a delete left a gap).
    expect(nextSceneName([scene('a', 'Scene 1'), scene('b', 'Scene 3')])).toBe('Scene 4');
  });

  it('renamed scenes do not block the count', () => {
    expect(nextSceneName([scene('a', 'The kitchen'), scene('b', 'The chase')])).toBe('Scene 3');
  });
});

describe('neighbourAfterRemoval', () => {
  const scenes = [scene('a', 'A'), scene('b', 'B'), scene('c', 'C')];

  it('prefers the NEXT scene', () => {
    expect(neighbourAfterRemoval(scenes, 'b')).toBe('c');
    expect(neighbourAfterRemoval(scenes, 'a')).toBe('b');
  });

  it('falls back to the previous scene for the last card', () => {
    expect(neighbourAfterRemoval(scenes, 'c')).toBe('b');
  });

  it('an unknown or only scene gives nothing', () => {
    expect(neighbourAfterRemoval(scenes, 'nope')).toBeUndefined();
    expect(neighbourAfterRemoval([scene('a', 'A')], 'a')).toBeUndefined();
  });
});
