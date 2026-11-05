import { pipFields } from './media';

/** After any picture-in-picture exit in this frame, hiding the tab does not enter again for this long. */
export const autoPipCooldownMs = 10_000;

/** Whether the selected media may enter picture-in-picture on its own right now. */
export function shouldAutoPip(input: { enabled: boolean; element: HTMLMediaElement | undefined; lastExitAt: number | null; now: number }) {
  const { element } = input;
  if (!input.enabled || !element?.isConnected || element.localName !== 'video') return false;
  if (element.paused || element.ended) return false;
  if (input.lastExitAt != null && input.now - input.lastExitAt < autoPipCooldownMs) return false;
  // Something on this page already holds picture-in-picture; leave it in place.
  if (element.ownerDocument.pictureInPictureElement) return false;
  const fields = pipFields(element, element.ownerDocument);
  return !fields.pip && fields.pipAvailable;
}

type ActionSession = { setActionHandler(action: string, handler: (() => void) | null): void };

/**
 * Enters picture-in-picture for `target()` when the tab is hidden.
 * Two paths share one gate: the hidden page itself, which the browser allows after a recent gesture,
 * and the Media Session `enterpictureinpicture` action, which the browser fires when it allows automatic entry.
 * A refusal stays silent. `sync()` adds or drops the Media Session hook to match `enabled()`.
 * `onEntered` hears only entries made here, never manual ones.
 */
export function createAutoPip(document: Document, options: { enabled: () => boolean; target: () => HTMLMediaElement | undefined; mediaSession?: boolean; now?: () => number; onEntered?: (element: HTMLVideoElement) => void }) {
  const now = options.now ?? Date.now;
  let lastExitAt: number | null = null;
  let entering = false;
  let hooked = false;
  const enter = () => {
    if (entering) return;
    const element = options.target();
    if (!shouldAutoPip({ enabled: options.enabled(), element, lastExitAt, now: now() })) return;
    entering = true;
    const video = element as HTMLVideoElement;
    void video.requestPictureInPicture().then(() => options.onEntered?.(video), () => {}).finally(() => { entering = false; });
  };
  const onVisibility = () => { if (document.visibilityState === 'hidden') enter(); };
  const onLeave = () => { lastExitAt = now(); };
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
