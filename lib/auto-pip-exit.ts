import { autoPipCooldownMs, createAutoPipQuiet, type AutoPipHint, type AutoPipQuiet } from './auto-pip';
import { scrollInShare, visibleShare } from './auto-pip-scroll';
import { pipRequestFailureKey } from './media';

/** The way back has to hold this long before picture-in-picture closes, so a passing tab or a scroll wobble does not flicker it. */
export const autoPipExitDelayMs = 500;

const thresholds = Array.from({ length: 21 }, (_, step) => step / 20);

/**
 * Closes picture-in-picture that an automatic entry opened, once the user is back in front of the video:
 * the page is visible again and the video shows at least `scrollInShare` of itself.
 * Only elements passed to `mark()` count, so picture-in-picture the user opened by hand is never closed here.
 * Any exit ends the session; `sync()` follows the switch, and turning it off stops watching.
 * A successful close shows the same short off note as a manual exit. A refusal shows the usual short note
 * and does not try again until the shared quiet window ends, so a boundary wobble cannot flash the window.
 */
export function createAutoPipExit(document: Document, options: { enabled: () => boolean; delayMs?: number; onHint?: AutoPipHint; quiet?: AutoPipQuiet }) {
  const view = document.defaultView;
  const delayMs = options.delayMs ?? autoPipExitDelayMs;
  const quiet = options.quiet ?? createAutoPipQuiet();
  let session: HTMLVideoElement | undefined;
  let observer: IntersectionObserver | null = null;
  let inView = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const holdsPip = (element: HTMLVideoElement) => (element.getRootNode() as Document | ShadowRoot).pictureInPictureElement === element;
  const back = () => document.visibilityState === 'visible' && inView;
  const cancel = () => { if (timer !== undefined) { clearTimeout(timer); timer = undefined; } };
  const cancelRetry = () => { if (retry !== undefined) { clearTimeout(retry); retry = undefined; } };
  const end = () => {
    cancel();
    cancelRetry();
    session = undefined;
    inView = false;
    observer?.disconnect();
    observer = null;
  };
  const exit = () => {
    timer = undefined;
    const element = session;
    if (!element || !options.enabled() || !back()) return;
    if (!holdsPip(element)) { end(); return; }
    if (quiet.quiet()) return;
    void element.ownerDocument.exitPictureInPicture().then(() => {
      quiet.hold();
      options.onHint?.('pipOffHint');
    }, (error: unknown) => {
      quiet.hold();
      options.onHint?.(pipRequestFailureKey(error, element.readyState));
      if (retry !== undefined || !session) return;
      retry = setTimeout(() => { retry = undefined; check(); }, autoPipCooldownMs + 50);
    });
  };
  const check = () => {
    // The quiet window blocks a retry after a failed close. A fresh return is not quiet, so the first close still runs.
    if (quiet.quiet()) { cancel(); return; }
    if (session && options.enabled() && back()) { if (timer === undefined) timer = setTimeout(exit, delayMs); }
    else cancel();
  };
  const onEntries = (entries: IntersectionObserverEntry[]) => {
    const entry = entries.at(-1);
    if (!entry || entry.target !== session || !view) return;
    inView = visibleShare(entry.boundingClientRect, entry.intersectionRect, { width: view.innerWidth, height: view.innerHeight }) >= scrollInShare;
    check();
  };
  const watch = () => {
    if (!session || !view || observer || !options.enabled()) return;
    observer = new view.IntersectionObserver(onEntries, { threshold: thresholds });
    observer.observe(session);
  };
  // Picture-in-picture events do not cross a shadow root, so any exit here re-checks the marked element itself.
  const onLeave = () => { if (session && !holdsPip(session)) end(); };
  document.addEventListener('visibilitychange', check);
  document.addEventListener('leavepictureinpicture', onLeave, true);
  return {
    /** Records that `element` entered picture-in-picture on its own; manual entries must never call this. */
    mark(element: HTMLVideoElement) {
      if (session === element) return;
      end();
      session = element;
      watch();
    },
    /** Follows the switch; call it when settings or the site gate change. */
    sync() {
      if (options.enabled()) { watch(); check(); return; }
      cancel();
      observer?.disconnect();
      observer = null;
      inView = false;
    },
    dispose() {
      end();
      document.removeEventListener('visibilitychange', check);
      document.removeEventListener('leavepictureinpicture', onLeave, true);
    }
  };
}
