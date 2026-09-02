import { DEFAULT_FPS, type ProjectDocument, type ProjectFormat, type Scene } from './types';

export function newId(): string {
  return crypto.randomUUID();
}

export function newScene(name: string): Scene {
  return {
    id: newId(),
    name,
    durationSeconds: 5,
    cameraKeyframes: [],
    layers: [],
    audioClips: []
  };
}

/** A brand-new project: one empty scene, nothing else. */
export function newProject(name: string, format: ProjectFormat): ProjectDocument {
  return {
    schemaVersion: 1,
    name,
    format,
    fps: DEFAULT_FPS,
    assets: [],
    characters: [],
    scenes: [newScene('Scene 1')]
  };
}
