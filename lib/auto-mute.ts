/** How long an automatic mute, or an undo, holds the next automatic mute back. Not a setting. */
export const autoMuteCooldownMs = 5_000;

/**
 * A play that starts longer than this after the gesture or OtterTap command is not attributed.
 * Native controls and OtterTap's own play fire within this. A later scripted play is left alone.
 */
export const playIntentWindowMs = 1_000;

/** Session clock for the automatic hold. Not part of the undo batch, and not exported. */
export const autoMuteClockKey = 'ottertap-auto-mute-v1';

export type PlaybackPhase = 'paused' | 'ended' | 'playing';
export type PlayCause = 'control' | 'gesture';

export function playbackPhase(media: { paused: boolean; ended: boolean }): PlaybackPhase {
  if (media.ended) return 'ended';
  return media.paused ? 'paused' : 'playing';
}

/** A start worth considering: the media had been paused or had ended. Already playing does not count. */
export function isPlaybackStart(previous: PlaybackPhase) {
  return previous === 'paused' || previous === 'ended';
}

const playKeys = new Set([' ', 'Enter', 'MediaPlayPause']);

/**
 * A direct play gesture on the media element itself.
 * A click or key anywhere else on the page is not one: a site button that calls play() stays unattributed.
 */
export function isDirectPlayGesture(event: { type: string; isTrusted: boolean; key?: string; button?: number; repeat?: boolean }) {
  if (!event.isTrusted) return false;
  if (event.type === 'pointerup') return event.button === 0;
  if (event.type === 'keydown') return event.repeat !== true && typeof event.key === 'string' && playKeys.has(event.key);
  return false;
}

export function playCauseForStart(input: {
  enabled: boolean;
  previous: PlaybackPhase;
  cause: PlayCause | null;
  intentAt: number | null;
  now: number;
}): PlayCause | null {
  if (!input.enabled || !isPlaybackStart(input.previous)) return null;
  if (!input.cause || input.intentAt == null) return null;
  if (input.now < input.intentAt || input.now - input.intentAt > playIntentWindowMs) return null;
  return input.cause;
}

export function nextAutoMuteUntil(now: number) {
  return now + autoMuteCooldownMs;
}

/** `until` is exclusive at the start and open at the boundary: the instant it is reached, another automatic mute may run. */
export function autoMuteBlocked(now: number, until: number | null) {
  return until != null && Number.isFinite(until) && now < until;
}

export function parseAutoMuteUntil(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const until = (raw as { until?: unknown }).until;
  if (typeof until !== 'number' || !Number.isFinite(until)) return null;
  return until;
}

/**
 * Per-document memory of what last happened to each media id.
 * A start is reported once, and only with a fresh OtterTap play command or a direct gesture on that media.
 */
export function createPlayStartTracker(now: () => number = () => Date.now()) {
  const phases = new Map<string, PlaybackPhase>();
  const intents = new Map<string, { cause: PlayCause; at: number }>();
  return {
    see(id: string, phase: PlaybackPhase) {
      phases.set(id, phase);
    },
    arm(id: string, cause: PlayCause) {
      if ((phases.get(id) ?? 'playing') === 'playing') return false;
      intents.set(id, { cause, at: now() });
      return true;
    },
    /** Drop a command intent when play did not actually start. */
    drop(id: string) {
      intents.delete(id);
    },
    start(id: string): PlayCause | null {
      const previous = phases.get(id) ?? 'playing';
      phases.set(id, 'playing');
      const intent = intents.get(id) ?? null;
      intents.delete(id);
      return playCauseForStart({
        enabled: true,
        previous,
        cause: intent?.cause ?? null,
        intentAt: intent?.at ?? null,
        now: now(),
      });
    },
  };
}
