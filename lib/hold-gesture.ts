import { createHoldKeySession, isHoldRateChord, type HoldKeyEvent } from './hold-rate';
import { createHoldSkipSession } from './hold-skip';

export interface HoldGestureInput {
  /** Hold-to-boost is on, the page has media, and the event is outside a text field. */
  boost: boolean;
  /** The combo switch and single-key mode are on, and this is not a floater arrow. */
  skip: boolean;
  singleKey: boolean;
}

export type HoldGestureEffect =
  | { type: 'ignore' }
  | { type: 'consume'; armAlt: boolean }
  | { type: 'start'; armAlt: boolean }
  | { type: 'end' }
  | { type: 'arm' }
  | { type: 'skip'; direction: -1 | 1 };

/**
 * One temporary speed per page. The key that already started it keeps it:
 * a skip key that is down blocks S / Alt+Shift+., and a dedicated hold blocks
 * the skip key from boosting. A short skip tap still jumps once.
 * A swallowed chord remembers its physical key so the matching keyup is eaten
 * even after Shift or Alt is released, and that keyup does not end the boost.
 */
export function createHoldGesture(now: () => number = () => Date.now()) {
  const keys = createHoldKeySession();
  const skip = createHoldSkipSession(now);
  const blocked = new Set<string>();
  let armedId: string | null = null;
  const idOf = (event: HoldKeyEvent) => event.code || event.key;
  return {
    /** True while a skip key is down and has not entered the temporary speed yet. */
    waiting() { return skip.holding() && !skip.boosted(); },
    remaining() { return skip.remaining(); },
    key(event: HoldKeyEvent, input: HoldGestureInput): HoldGestureEffect {
      const decision = keys.key(event, input.boost && !skip.holding(), input.singleKey);
      if (decision === 'start') return { type: 'start', armAlt: event.altKey };
      if (decision === 'end') return { type: 'end' };
      if (decision === 'repeat') return { type: 'consume', armAlt: false };
      const id = idOf(event);
      if (blocked.has(id)) {
        if (event.type === 'keyup') blocked.delete(id);
        return { type: 'consume', armAlt: false };
      }
      if (skip.holding() && input.boost && event.type !== 'keyup' && !event.repeat && isHoldRateChord(event, input.singleKey)) {
        blocked.add(id);
        return { type: 'consume', armAlt: event.altKey };
      }
      const next = skip.key(event, input.skip, input.singleKey);
      if (next.phase === 'arm') {
        armedId = id;
        return { type: 'arm' };
      }
      if (next.phase === 'repeat') return { type: 'consume', armAlt: false };
      if (next.phase === 'skip' && next.direction) {
        armedId = null;
        return { type: 'skip', direction: next.direction };
      }
      if (next.phase === 'release') {
        armedId = null;
        return { type: 'end' };
      }
      return { type: 'ignore' };
    },
    /**
     * Threshold timer. If a dedicated hold still owns the temporary speed when the
     * skip key's moment arrives, drop that press. It must not start a second boost,
     * and releasing it must not restore the speed.
     */
    tick(): HoldGestureEffect {
      if (!skip.holding() || skip.boosted()) return { type: 'ignore' };
      if (keys.holding()) {
        if (skip.remaining() > 0) return { type: 'arm' };
        // Keep eating this key until it comes up, so a repeat cannot fall through and skip.
        if (armedId) blocked.add(armedId);
        armedId = null;
        skip.cancel();
        return { type: 'ignore' };
      }
      if (skip.tick().phase === 'boost') {
        armedId = null;
        return { type: 'start', armAlt: false };
      }
      return skip.holding() && !skip.boosted() ? { type: 'arm' } : { type: 'ignore' };
    },
    /** Blur or hide. True when a temporary speed is on and must end. */
    cancel() {
      blocked.clear();
      armedId = null;
      const skipEnded = skip.cancel().phase === 'release';
      return skipEnded || keys.cancel();
    }
  };
}
