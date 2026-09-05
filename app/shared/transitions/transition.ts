// The seven transitions as numbers (Phase 7, decision g): for a type and
// a progress 0..1, exactly what the renderer applies to the outgoing and
// the incoming scene — alpha, x/y offset in reference pixels, scale about
// the frame centre, which scene draws on top, and the wipe's reveal
// width. projectStage applies these numbers and draws; nothing about a
// transition's look lives anywhere else, so the whole look is tested
// here as arithmetic.
//
// A cut never comes here: its overlap length is 0 (projectTime), so no
// frame ever shows two scenes.
//
// Pure: no browser APIs, everything tested under plain Node.

import { easeInOut } from '../animation/easing';
import type { TransitionType } from '../document/types';

/** How a zoomed scene ends up (zoom-in) or arrives (zoom-out): 2.5×. */
export const ZOOM_TRANSITION_SCALE = 2.5;

/** What one scene's picture does at this moment of the transition. */
export interface TransitionScenePose {
  readonly alpha: number;
  /** Offset of the whole scene, in reference pixels. */
  readonly offsetX: number;
  readonly offsetY: number;
  /** Scale about the frame's centre. */
  readonly scale: number;
}

export interface TransitionPose {
  readonly outgoing: TransitionScenePose;
  readonly incoming: TransitionScenePose;
  /** Which scene draws over the other at this moment. */
  readonly onTop: 'outgoing' | 'incoming';
  /**
   * Wipe only: how many reference pixels of the incoming scene show,
   * measured from the left edge — the hard vertical edge sits here.
   */
  readonly wipeRevealPx?: number;
}

const REST: TransitionScenePose = { alpha: 1, offsetX: 0, offsetY: 0, scale: 1 };

/**
 * The two scenes' poses at `progress` (clamped to 0..1) of a transition,
 * for a frame of `width` × `height` reference pixels. Decision g exactly:
 * crossfade linear; the slides are ease-in-out pushes (the incoming scene
 * follows the outgoing one in from the opposite edge); zoom-in grows the
 * outgoing scene to 2.5× and fades it out over the incoming one beneath;
 * zoom-out lands the incoming scene from 2.5× fading in on top; wipe
 * reveals the incoming scene left-to-right behind a hard edge. Zoom
 * scale and every fade run linearly in progress.
 */
export function transitionPose(
  type: TransitionType,
  progress: number,
  width: number,
  height: number
): TransitionPose {
  const p = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;
  switch (type) {
    case 'crossfade':
      return { outgoing: REST, incoming: { ...REST, alpha: p }, onTop: 'incoming' };
    case 'slide-left':
    case 'slide-right':
    case 'slide-up':
    case 'slide-down': {
      const e = easeInOut(p);
      // The push, as a unit direction: everything moves this way.
      const [dx, dy] =
        type === 'slide-left'
          ? [-1, 0]
          : type === 'slide-right'
            ? [1, 0]
            : type === 'slide-up'
              ? [0, -1]
              : [0, 1];
      const [w, h] = [width, height];
      // `|| 0` turns the -0 the direction arithmetic can produce into 0.
      return {
        // The outgoing scene moves off in the push direction…
        outgoing: { ...REST, offsetX: dx * e * w || 0, offsetY: dy * e * h || 0 },
        // …and the incoming one follows exactly one frame behind it.
        incoming: { ...REST, offsetX: dx * (e - 1) * w || 0, offsetY: dy * (e - 1) * h || 0 },
        onTop: 'incoming'
      };
    }
    case 'zoom-in':
      return {
        outgoing: { ...REST, scale: 1 + (ZOOM_TRANSITION_SCALE - 1) * p, alpha: 1 - p },
        incoming: REST,
        onTop: 'outgoing'
      };
    case 'zoom-out':
      return {
        outgoing: REST,
        incoming: { ...REST, scale: ZOOM_TRANSITION_SCALE - (ZOOM_TRANSITION_SCALE - 1) * p, alpha: p },
        onTop: 'incoming'
      };
    case 'wipe':
      return { outgoing: REST, incoming: REST, onTop: 'incoming', wipeRevealPx: p * width };
    case 'cut':
      // Defensive only: a cut has no overlap, so no frame asks for this.
      return { outgoing: REST, incoming: REST, onTop: 'incoming' };
  }
}
