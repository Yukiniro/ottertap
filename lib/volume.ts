import { normalizeVolumeStep } from './settings';
import type { WheelDirection } from './types';

/** Shown percent below which hover-wheel and Alt+wheel take a 1% step. */
export const fineWheelThreshold = 25;
/** One wheel notch while auto-fine applies. The panel slider stays on its own 1% grid. */
export const fineWheelStep = 1;

/**
 * Percentage points for one hover-wheel or Alt+wheel notch.
 * Compares the rounded percent the floater and panel show, so 25% on screen uses the saved step.
 * A coarse/fine modifier (#113) wins by choosing the step before this runs; skip this function while that modifier is held.
 */
export function volumeStepForWheel(percent: number, volumeStep: number, fineWheel: boolean) {
  const step = normalizeVolumeStep(volumeStep);
  if (fineWheel && Math.round(percent) < fineWheelThreshold) return fineWheelStep;
  return step;
}

/** Percentage points for one hover-wheel or Alt+wheel notch. `down` flips the sign only; the step, including the 1% fine step, stays. */
export function wheelVolumePoints(notches: number, percent: number, volumeStep: number, fineWheel: boolean, direction: WheelDirection = 'up') {
  const sign = direction === 'down' ? -1 : 1;
  return notches * volumeStepForWheel(percent, volumeStep, fineWheel) * sign;
}

export function snapDraggedVolume(percent: number) {
  return Math.abs(percent - 100) <= 3 ? 100 : percent;
}

export function snapVolumeStep(previous: number, next: number) {
  // Converting gain to percent can leave a tiny remainder at the baseline.
  if (Math.abs(next - 100) < 1e-9) return 100;
  return (previous < 100 && next > 100) || (previous > 100 && next < 100) ? 100 : next;
}

export function steppedVolume(previous: number, delta: number, max: number) {
  return snapVolumeStep(previous, Math.max(0, Math.min(max, previous + delta)));
}
