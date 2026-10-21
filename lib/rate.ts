export const minRate = 0.25;
export const maxRate = 4;
export const rateStep = 0.25;
export const maxRatePresets = 10;
export const defaultRatePresets = [0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];

export function clampRate(rate: number) {
  if (!Number.isFinite(rate)) return 1;
  return Math.min(maxRate, Math.max(minRate, rate));
}

/** Move to the next 0.25 grid point. Off-grid values align before stepping. */
export function stepRate(current: number, direction: 1 | -1) {
  if (!Number.isFinite(current)) return minRate;
  const steps = current / rateStep;
  const nearest = Math.round(steps);
  const onGrid = Math.abs(current - nearest * rateStep) <= 1e-6;
  const aligned = onGrid ? nearest + direction : direction > 0 ? Math.ceil(steps - 1e-9) : Math.floor(steps + 1e-9);
  return clampRate(aligned * rateStep);
}

export function nextRate(current: number, direction: 1 | -1 | 0, remembered?: number | null) {
  if (direction !== 0) return stepRate(current, direction);
  if (sameRate(current, 1)) {
    const recalled = remembered == null ? null : recallableRate(remembered);
    if (recalled != null) return recalled;
  }
  return 1;
}

/** A non-1× speed this page can return to. 1× and unusable numbers are ignored. */
export function recallableRate(rate: number): number | null {
  if (!Number.isFinite(rate)) return null;
  const clamped = clampRate(rate);
  return sameRate(clamped, 1) ? null : clamped;
}

/** Keep the latest non-1× speed. Observing 1× leaves the previous value in place. */
export function noteRecallRate(remembered: number | null, observed: number): number | null {
  return recallableRate(observed) ?? remembered;
}

export function formatRate(rate: number) {
  if (!Number.isFinite(rate)) return '1';
  return String(Math.round(rate * 100) / 100);
}

export function sameRate(a: number, b: number) {
  return formatRate(a) === formatRate(b);
}

/** Keep a user-ordered list inside 0.25×–4×. Empty or unusable input falls back to the built-in presets. */
export function normalizeRatePresets(value: unknown): number[] {
  if (!Array.isArray(value)) return [...defaultRatePresets];
  const presets: number[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isFinite(item)) continue;
    const rate = Number(formatRate(clampRate(item)));
    if (seen.has(rate)) continue;
    seen.add(rate);
    presets.push(rate);
    if (presets.length === maxRatePresets) break;
  }
  return presets.length ? presets : [...defaultRatePresets];
}

/** Accept a typed preset. Out-of-range and non-numeric input is rejected so the form can explain it. */
export function parseRatePreset(input: string): number | null {
  const text = input.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const rate = Number(formatRate(Number(text)));
  if (rate < minRate || rate > maxRate) return null;
  return rate;
}

/** Read after the page's own timers, so a player that restores the old rate is what we report. */
export function readSettledRate(element: HTMLMediaElement) {
  const view = element.ownerDocument.defaultView;
  return new Promise<number>(resolve => {
    const finish = () => resolve(element.playbackRate);
    if (view) view.setTimeout(finish, 0);
    else finish();
  });
}
