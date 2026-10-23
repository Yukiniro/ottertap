import { normalizeSkipSeconds } from './settings';

/** Playback rates outside this window use the nearer bound, so one skip cannot run away. */
export const minSkipRate = 0.5;
export const maxSkipRate = 3;

function skipRateFactor(rate: number) {
  if (!Number.isFinite(rate) || rate === 0) return 1;
  return Math.min(maxSkipRate, Math.max(minSkipRate, Math.abs(rate)));
}

/** Configured step, or that step times the current speed when the switch is on. */
export function actualSkipSeconds(step: number, rate: number, scaleWithRate: boolean) {
  const seconds = normalizeSkipSeconds(step);
  if (!scaleWithRate) return seconds;
  return Math.round(seconds * skipRateFactor(rate));
}

const minHintSeconds = Math.round(5 * minSkipRate);
const maxHintSeconds = Math.round(30 * maxSkipRate);

/** Seconds a skip hint may show. Anything this product cannot jump falls back to the default step. */
export function hintSkipSeconds(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minHintSeconds || value > maxHintSeconds) return 10;
  return value;
}
