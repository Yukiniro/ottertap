import { pipFields, pipRequestFailureKey, type PipFailureKey } from './media';

/** After any picture-in-picture exit or a failed automatic attempt in this frame, another automatic enter waits this long. */
export const autoPipCooldownMs = 10_000;

export type AutoPipHintKey = 'pipOnHint' | 'pipOffHint' | PipFailureKey;
export type AutoPipHint = (key: AutoPipHintKey) => void;

/** One quiet window shared by automatic enter and exit, so a failure or an exit does not immediately try again. */
export function createAutoPipQuiet(now: () => number = Date.now) {
  let at: number | null = null;
  return {
    at() { return at; },
    hold(when = now()) { at = when; },
    quiet(when = now()) { return at != null && when - at < autoPipCooldownMs; },
  };
}

export type AutoPipQuiet = ReturnType<typeof createAutoPipQuiet>;

/**
 * Whether an automatic enter that already decided to try may call `requestPictureInPicture`.
 * `quiet` and `skip` stay silent. A failure key is the existing short note, and the caller starts the quiet window.
 */
export function autoPipDecision(element: HTMLMediaElement, input: { lastExitAt: number | null; now: number }): 'enter' | 'quiet' | 'skip' | PipFailureKey {
  if (input.lastExitAt != null && input.now - input.lastExitAt < autoPipCooldownMs) return 'quiet';
  if (!element.isConnected || element.paused || element.ended) return 'skip';
  if (element.localName !== 'video') return 'pipUnavailableAudio';
  if (element.ownerDocument.pictureInPictureElement) return 'skip';
  const fields = pipFields(element, element.ownerDocument);
  if (fields.pip) return 'skip';
  if (fields.pipAvailable) return 'enter';
  if (fields.pipBlock === 'disabled') return 'pipDisabledBySite';
  if (fields.pipBlock === 'not-ready') return 'pipNotReady';
  if (fields.pipBlock === 'audio') return 'pipUnavailableAudio';
  return 'pipUnsupported';
}

/** Whether the selected media may enter picture-in-picture on its own right now. */
export function shouldAutoPip(input: { enabled: boolean; element: HTMLMediaElement | undefined; lastExitAt: number | null; now: number }) {
  return input.enabled && !!input.element && autoPipDecision(input.element, input) === 'enter';
}

/** Runs the request. Success reports `pipOnHint`; a refusal starts the quiet window and reports the existing failure note. */
export function settleAutoPip(video: HTMLVideoElement, quiet: AutoPipQuiet, onHint?: AutoPipHint, onEntered?: (video: HTMLVideoElement) => void) {
  return video.requestPictureInPicture().then(() => {
    onEntered?.(video);
    onHint?.('pipOnHint');
    return true;
  }, (error: unknown) => {
    quiet.hold();
    onHint?.(pipRequestFailureKey(error, video.readyState));
    return false;
  });
}

function noteRefusal(decision: ReturnType<typeof autoPipDecision>, quiet: AutoPipQuiet, onHint?: AutoPipHint) {
  if (decision === 'enter') return true;
  if (decision !== 'quiet' && decision !== 'skip') {
    quiet.hold();
    onHint?.(decision);
  }
  return false;
}

type ActionSession = { setActionHandler(action: string, handler: (() => void) | null): void };

/**
 * Enters picture-in-picture for `target()` when the tab is hidden.
 * Two paths share one gate: the hidden page itself, which the browser allows after a recent gesture,
 * and the Media Session `enterpictureinpicture` action, which the browser fires when it allows automatic entry.
 * Success and failure use the same short notes as a manual toggle. A failure stays quiet for `autoPipCooldownMs`.
 * `onEntered` hears only entries made here, never manual ones.
 */
export function createAutoPip(document: Document, options: { enabled: () => boolean; target: () => HTMLMediaElement | undefined; mediaSession?: boolean; now?: () => number; onEntered?: (element: HTMLVideoElement) => void; onHint?: AutoPipHint; quiet?: AutoPipQuiet }) {
  const now = options.now ?? Date.now;
  const quiet = options.quiet ?? createAutoPipQuiet(now);
  let entering = false;
  let hooked = false;
  const enter = () => {
    if (entering) return;
    const element = options.target();
    if (!options.enabled() || !element) return;
    if (!noteRefusal(autoPipDecision(element, { lastExitAt: quiet.at(), now: now() }), quiet, options.onHint)) return;
    entering = true;
    void settleAutoPip(element as HTMLVideoElement, quiet, options.onHint, options.onEntered).finally(() => { entering = false; });
  };
  const onVisibility = () => { if (document.visibilityState === 'hidden') enter(); };
  const onLeave = () => { quiet.hold(); };
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('leavepictureinpicture', onLeave, true);
  const session = options.mediaSession ? (document.defaultView?.navigator as { mediaSession?: ActionSession } | undefined)?.mediaSession : undefined;
  const hook = (handler: (() => void) | null) => {
    try { session?.setActionHandler('enterpictureinpicture', handler); return true; }
    catch { return false; }
  };
  return {
    sync() {
      const want = options.enabled();
      if (want === hooked) return;
      // Browsers without the action throw; the hidden-page path still works there.
      if (want) hooked = hook(enter);
      else { hook(null); hooked = false; }
    },
    dispose() {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('leavepictureinpicture', onLeave, true);
      if (hooked) hook(null);
      hooked = false;
    }
  };
}
