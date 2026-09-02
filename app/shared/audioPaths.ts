// Pure audio-import helpers shared by the renderer panel and the checks
// (no DOM, no Node — safe everywhere).

export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg'];

export function isAudioPath(path: string): boolean {
  const dot = path.lastIndexOf('.');
  return dot >= 0 && AUDIO_EXTENSIONS.includes(path.slice(dot).toLowerCase());
}

/** 83.4 s → "1:23.4" — how durations show in the Assets panel. */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
}
