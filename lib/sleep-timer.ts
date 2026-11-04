export const sleepPresets = [15, 30, 45, 60] as const;
export const maxSleepMinutes = 180;

/** Whole minutes from 1 to `maxSleepMinutes`, else null. */
export function sleepMinutes(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= maxSleepMinutes ? value : null;
}

export interface SleepTimerClient {
  /** Count down on the current tab. When it runs out, the media OtterTap controls then is paused. */
  start(minutes: number): Promise<void>;
}

interface SleepClock {
  now(): number;
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

const windowClock: SleepClock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => window.setTimeout(callback, ms),
  clearTimeout: id => window.clearTimeout(id),
};

/**
 * One countdown for a tab, held by its top frame so closing the panel keeps it.
 * The deadline is wall-clock time; a timer woken early, such as after the computer slept, waits again.
 */
export function createSleepTimer(onDue: () => void, clock: SleepClock = windowClock) {
  let deadline: number | null = null;
  let timer = 0;
  const clear = () => {
    if (!timer) return;
    clock.clearTimeout(timer);
    timer = 0;
  };
  const schedule = () => {
    clear();
    if (deadline == null) return;
    timer = clock.setTimeout(() => {
      timer = 0;
      if (deadline == null) return;
      if (clock.now() < deadline) { schedule(); return; }
      deadline = null;
      onDue();
    }, Math.max(0, deadline - clock.now()));
  };
  return {
    arm(at: number) {
      deadline = at;
      schedule();
    },
    deadline: () => deadline,
    dispose() {
      clear();
      deadline = null;
    },
  };
}
