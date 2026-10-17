export const minRate = 0.25;
export const maxRate = 4;
export const rateStep = 0.25;

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

export function nextRate(current: number, direction: 1 | -1 | 0) {
  return direction === 0 ? 1 : stepRate(current, direction);
}

export function formatRate(rate: number) {
  if (!Number.isFinite(rate)) return '1';
  return String(Math.round(rate * 100) / 100);
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
