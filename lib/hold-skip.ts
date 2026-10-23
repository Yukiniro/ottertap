import { hotkeyFromKeyboard } from './hotkey';
import type { HoldKeyEvent } from './hold-rate';
import type { Keybinds } from './keybinds';

/**
 * Tap-or-hold on the skip keys. A press shorter than this stays a skip.
 * 300ms is past a normal tap and earlier than a typical key-repeat delay, so a
 * short press cannot fall into the temporary speed.
 */
export const holdSkipThresholdMs = 300;

export type HoldSkipPhase = 'ignore' | 'arm' | 'repeat' | 'boost' | 'skip' | 'release';

export interface HoldSkipDecision {
  phase: HoldSkipPhase;
  /** Set for `skip`: -1 back, 1 forward. */
  direction?: -1 | 1;
}

/** The same keys single-key mode already uses to skip. Other chords stay with their own handlers. */
export function skipHoldDirection(event: HoldKeyEvent, singleKey: boolean, keybinds?: Keybinds): -1 | 1 | null {
  const action = hotkeyFromKeyboard(event, { singleKey, keybinds });
  if (action?.type !== 'skip') return null;
  return action.delta < 0 ? -1 : 1;
}

export function createHoldSkipSession(now: () => number = () => Date.now()) {
  let code: string | null = null;
  let direction: -1 | 1 = 1;
  let armedAt = 0;
  let boosted = false;
  const physical = (event: HoldKeyEvent) => event.code || event.key;
  return {
    holding() { return code != null; },
    boosted() { return boosted; },
    /** Milliseconds left before a waiting press becomes a boost. 0 when nothing is waiting. */
    remaining(at = now()) {
      if (!code || boosted) return 0;
      return Math.max(0, holdSkipThresholdMs - (at - armedAt));
    },
    /**
     * `active` is hold-to-boost, this option, single-key mode, a media page, and a non-typing target.
     * The keyup for the key that armed the press still finishes it when `active` is false,
     * so releasing the key cannot leave a temporary speed on or skip a second time.
     */
    key(event: HoldKeyEvent, active: boolean, singleKey: boolean, keybinds?: Keybinds): HoldSkipDecision {
      const id = physical(event);
      if (code && event.type === 'keyup' && id === code) {
        const phase: HoldSkipPhase = boosted ? 'release' : 'skip';
        const decided = direction;
        code = null;
        boosted = false;
        return phase === 'skip' ? { phase, direction: decided } : { phase };
      }
      if (code && id === code && event.type !== 'keyup') return { phase: 'repeat' };
      if (code) return { phase: 'ignore' };
      if (!active || event.type === 'keyup' || event.repeat) return { phase: 'ignore' };
      const next = skipHoldDirection(event, singleKey, keybinds);
      if (next == null) return { phase: 'ignore' };
      code = id;
      direction = next;
      armedAt = now();
      boosted = false;
      return { phase: 'arm' };
    },
    /** Call from the threshold timer. Boosts once while the key is still down. */
    tick(at = now()): HoldSkipDecision {
      if (!code || boosted) return { phase: 'ignore' };
      if (at - armedAt < holdSkipThresholdMs) return { phase: 'arm' };
      boosted = true;
      return { phase: 'boost' };
    },
    /** Blur or hide. A tap that never came up is dropped. A boost in progress must end. */
    cancel(): HoldSkipDecision {
      if (!code) return { phase: 'ignore' };
      const phase: HoldSkipPhase = boosted ? 'release' : 'ignore';
      code = null;
      boosted = false;
      return { phase };
    }
  };
}
