export const sleepPresets = [15, 30, 45, 60] as const;
export type SleepPreset = (typeof sleepPresets)[number];
export const maxSleepMinutes = 180;
/** Fixed extension. Not a list of choices. */
export const sleepExtendMinutes = 15;
/** Page note when this much time is left. A timer that is already inside the window does not warn at the moment it starts. */
export const sleepSoonLeadMs = 60_000;

/** Whole minutes from 1 to `maxSleepMinutes`, else null. */
export function sleepMinutes(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= maxSleepMinutes ? value : null;
}

export function isSleepPreset(value: unknown): value is SleepPreset {
  return typeof value === 'number' && (sleepPresets as readonly number[]).includes(value);
}

export interface SleepTimerClient {
  /** Count down on the current tab. When it runs out, the media OtterTap controls then is paused. */
  start(minutes: number): Promise<void>;
  /** Drop the countdown. Playback stays as it is. */
  cancel(): Promise<void>;
  /** Add `sleepExtendMinutes` to the deadline that is already running. */
  extend(): Promise<void>;
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
export function createSleepTimer(onDue: () => void, clock: SleepClock = windowClock, onSoon?: () => void) {
  let deadline: number | null = null;
  let timer = 0;
  let soonTimer = 0;
  const clear = () => {
    if (!timer) return;
    clock.clearTimeout(timer);
    timer = 0;
  };
  const clearSoon = () => {
    if (!soonTimer) return;
    clock.clearTimeout(soonTimer);
    soonTimer = 0;
  };
  const scheduleSoon = () => {
    clearSoon();
    if (!onSoon || deadline == null) return;
    const soonAt = deadline - sleepSoonLeadMs;
    // Already inside the last minute, including a 1-minute timer armed right now. The start note covers that.
    if (soonAt <= clock.now()) return;
    soonTimer = clock.setTimeout(() => {
      soonTimer = 0;
      if (deadline == null || !onSoon) return;
      if (clock.now() >= deadline) return;
      if (clock.now() < deadline - sleepSoonLeadMs) { scheduleSoon(); return; }
      onSoon();
    }, soonAt - clock.now());
  };
  const schedule = () => {
    clear();
    if (deadline == null) return;
    timer = clock.setTimeout(() => {
      timer = 0;
      if (deadline == null) return;
      if (clock.now() < deadline) { schedule(); return; }
      deadline = null;
      clearSoon();
      onDue();
    }, Math.max(0, deadline - clock.now()));
  };
  return {
    arm(at: number) {
      deadline = at;
      schedule();
      scheduleSoon();
    },
    /** Add `ms` to the current deadline. Null when nothing is running. */
    extend(ms: number) {
      if (deadline == null || !Number.isFinite(ms) || ms <= 0) return null;
      deadline += ms;
      schedule();
      scheduleSoon();
      return deadline;
    },
    cancel() {
      deadline = null;
      clear();
      clearSoon();
    },
    deadline: () => deadline,
    dispose() {
      clear();
      clearSoon();
      deadline = null;
    },
  };
}
