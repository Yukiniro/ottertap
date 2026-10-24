import { normalizeCoarseVolumeStep, normalizeVolumeStep } from './settings';

/** Shown percent below which hover-wheel and Alt+wheel take a 1% step. */
export const fineWheelThreshold = 25;
/** One wheel notch while auto-fine applies. The panel slider stays on its own 1% grid. */
export const fineWheelStep = 1;

/**
 * Percentage points for one hover-wheel or Alt+wheel notch.
 * Compares the rounded percent the floater and panel show, so 25% on screen uses the saved step.
 * Holding Shift uses the coarse step and skips the under-25% fine step.
 */
export function volumeStepForWheel(percent: number, volumeStep: number, fineWheel: boolean, coarse = false, coarseVolumeStep = 50) {
  if (coarse) return normalizeCoarseVolumeStep(coarseVolumeStep);
  const step = normalizeVolumeStep(volumeStep);
  if (fineWheel && Math.round(percent) < fineWheelThreshold) return fineWheelStep;
  return step;
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
