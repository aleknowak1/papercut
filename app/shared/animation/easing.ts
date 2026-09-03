// The four easing curves (DOC-01 §5.1; bounce and overshoot wait for 1.x).
// Each is a plain function from progress 0..1 to eased progress 0..1:
// 0 stays 0 and 1 stays 1, so a segment always starts and ends exactly on
// its keyframes — easing only changes the speed along the way.

import type { EasingType } from '../document/types';

export type EasingFunction = (u: number) => number;

export const linear: EasingFunction = (u) => u;

/** Starts slow, finishes fast (quadratic). */
export const easeIn: EasingFunction = (u) => u * u;

/** Starts fast, finishes slow (quadratic). */
export const easeOut: EasingFunction = (u) => 1 - (1 - u) * (1 - u);

/** Slow at both ends, fastest in the middle. */
export const easeInOut: EasingFunction = (u) =>
  u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);

const CURVES: Record<EasingType, EasingFunction> = {
  linear,
  'ease-in': easeIn,
  'ease-out': easeOut,
  'ease-in-out': easeInOut
};

/** Progress u (clamped to 0..1) run through the named curve. */
export function ease(type: EasingType, u: number): number {
  const clamped = u <= 0 ? 0 : u >= 1 ? 1 : u;
  return CURVES[type](clamped);
}
