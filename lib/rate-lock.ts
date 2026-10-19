/** Per-media decision for optional playback-rate lock. Time and DOM stay outside. */

export const rateLockEpsilon = 0.01;
export const rateLockBaseMs = 200;
export const rateLockMaxMs = 2000;
/** The fight that reaches this count is a surrender: no further rewrite. */
export const rateLockMaxFights = 5;
export const rateLockWindowMs = rateLockMaxMs + 1000;
export const rateLockEvent = 'ottertap-rate-lock';

export interface RateLockState {
  desired: number | null;
  /** Rate of our latest write. The matching ratechange is an echo, not a site override. */
  echo: number | null;
  fights: number;
  lastFightAt: number;
  /** A rewrite is already scheduled; further ratechange events must not start another round. */
  pending: boolean;
  givenUp: boolean;
}

export type RateLockDecision =
  | { type: 'ignore' }
  | { type: 'rewrite'; rate: number; delayMs: number }
  | { type: 'give-up' };

export function createRateLockState(): RateLockState {
  return { desired: null, echo: null, fights: 0, lastFightAt: 0, pending: false, givenUp: false };
}

/** Remember a successful user or site-memory rate command and treat its write as an echo. */
export function noteDesiredRate(_state: RateLockState, rate: number): RateLockState {
  return { desired: rate, echo: rate, fights: 0, lastFightAt: 0, pending: false, givenUp: false };
}

/** Call immediately before our own playbackRate write. */
export function armRateEcho(state: RateLockState): RateLockState {
  if (state.desired == null) return state;
  return { ...state, echo: state.desired, pending: false };
}

export function rateLockDelayMs(fight: number) {
  return Math.min(rateLockBaseMs * 2 ** Math.max(0, fight - 1), rateLockMaxMs);
}

const near = (left: number, right: number) => Math.abs(left - right) <= rateLockEpsilon;

export function observePlaybackRate(state: RateLockState, observed: number, now: number, enabled: boolean): { state: RateLockState; decision: RateLockDecision } {
  if (!enabled || state.desired == null || !Number.isFinite(observed)) return { state, decision: { type: 'ignore' } };
  if (state.echo != null && near(observed, state.echo)) return { state: { ...state, echo: null }, decision: { type: 'ignore' } };
  if (near(observed, state.desired)) return { state: state.echo == null ? state : { ...state, echo: null }, decision: { type: 'ignore' } };
  if (state.givenUp || state.pending) return { state: { ...state, echo: null }, decision: { type: 'ignore' } };
  const fights = state.lastFightAt > 0 && now - state.lastFightAt > rateLockWindowMs ? 0 : state.fights;
  const next = fights + 1;
  if (next >= rateLockMaxFights) {
    return {
      state: { desired: state.desired, echo: null, fights: 0, lastFightAt: 0, pending: false, givenUp: true },
      decision: { type: 'give-up' }
    };
  }
  return {
    state: { desired: state.desired, echo: null, fights: next, lastFightAt: now, pending: true, givenUp: false },
    decision: { type: 'rewrite', rate: state.desired, delayMs: rateLockDelayMs(next) }
  };
}
