// projectSchedule (Phase 7, decision i): the whole video's sound as ONE
// list of scheduled clips — every scene's previewSchedule, shifted by
// that scene's global start under the overlap timing model
// (projectTime.ts). The export mixer renders these entries sample for
// sample and the Web Audio preview plays them, both unchanged from
// Phase 6 — so what plays across a scene boundary is what exports, by
// construction. Each scene's clips are still cut at their OWN scene's
// end (previewSchedule does that); during a transition's overlap both
// scenes simply sound, with no automatic fades (decision j).
//
// Pure arithmetic: no browser APIs, everything tested under plain Node.

import type { ProjectDocument } from '../document/types';
import { previewSchedule, type ScheduledClip } from './previewSchedule';
import { sceneStartSeconds } from './projectTime';

/**
 * Every clip audible from `fromGlobalTime` to the end of the video, as
 * entries whose delays are measured from that moment. Entries keep scene
 * order then clip order, so consumers are deterministic.
 */
export function projectSchedule(
  doc: ProjectDocument,
  fromGlobalTime: number,
  assetDurations: ReadonlyMap<string, number>
): ScheduledClip[] {
  const starts = sceneStartSeconds(doc);
  const out: ScheduledClip[] = [];
  for (let i = 0; i < doc.scenes.length; i++) {
    const scene = doc.scenes[i];
    const start = starts[i];
    if (scene === undefined || start === undefined) continue;
    // A scene already over by fromGlobalTime contributes nothing.
    if (start + scene.durationSeconds <= fromGlobalTime) continue;
    // Inside the scene the schedule starts part-way; a scene still to
    // come is scheduled whole, shifted by how far away its start is.
    const localFrom = Math.max(0, fromGlobalTime - start);
    const shift = Math.max(0, start - fromGlobalTime);
    for (const entry of previewSchedule(scene, localFrom, assetDurations)) {
      out.push(shift === 0 ? entry : { ...entry, delaySeconds: entry.delaySeconds + shift });
    }
  }
  return out;
}
