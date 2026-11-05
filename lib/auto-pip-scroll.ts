import { shouldAutoPip } from './auto-pip';
import { hoverFullscreenActive } from './fullscreen-wheel';
import { isMainStageSize, stageViewport } from './media';

/** At or below this visible share the picture counts as scrolled out, so reading just under the player does not trigger. */
export const scrollOutShare = 0.1;
/** The picture has to come back to this share, at main-stage size, before another scroll-out may enter. */
export const scrollInShare = 0.5;

type Box = { width: number; height: number };

/** Visible share measured against what the frame could show of it, so a player taller than the window still reaches 1. */
export function visibleShare(rect: Box, visible: Box, viewport: Box) {
  const possible = Math.min(rect.width, viewport.width) * Math.min(rect.height, viewport.height);
  if (!(possible > 0)) return 0;
  return Math.min(1, (visible.width * visible.height) / possible);
}

const thresholds = Array.from({ length: 21 }, (_, step) => step / 20);
// Pointer and key presses are the user activation the browser asks for; a wheel scroll alone is not.
const activations = ['pointerup', 'keydown'] as const;

/**
 * Enters picture-in-picture when `target()` scrolls out of view while it is playing.
 * It arms only after the video has been seen at main-stage size, so feed cards and a player that starts off-screen never enter.
 * One scroll-out enters at most once; any exit while it is still out waits until it scrolls back in.
 * Fullscreen holds it back; leaving fullscreen checks again. A refusal stays silent and the next press, play, or scroll tries again.
 */
export function createScrollPip(document: Document, options: { enabled: () => boolean; target: () => HTMLMediaElement | undefined; now?: () => number }) {
  const view = document.defaultView;
  const now = options.now ?? Date.now;
  let observer: IntersectionObserver | null = null;
  let watched: HTMLVideoElement | undefined;
  let armed = false;
  let out = false;
  let entering = false;
  let lastExitAt: number | null = null;

  const enter = () => {
    const element = watched;
    if (entering || !armed || !out || !element || !view) return;
    if (!shouldAutoPip({ enabled: options.enabled(), element, lastExitAt, now: now() })) return;
    if (hoverFullscreenActive(view)) return;
    entering = true;
    void element.requestPictureInPicture().then(() => { if (watched === element) armed = false; }, () => {}).finally(() => { entering = false; });
  };
  const onEntries = (entries: IntersectionObserverEntry[]) => {
    const entry = entries.at(-1);
    if (!entry || entry.target !== watched || !view) return;
    const rect = entry.boundingClientRect;
    if (!(rect.width > 0 && rect.height > 0)) { armed = false; out = false; return; }
    const share = visibleShare(rect, entry.intersectionRect, { width: view.innerWidth, height: view.innerHeight });
    if (share >= scrollInShare) armed = isMainStageSize(rect, stageViewport(view));
    out = share <= scrollOutShare;
    enter();
  };
  const onLeave = () => {
    lastExitAt = now();
    if (out) armed = false;
  };
  const onPlay = (event: Event) => { if (event.target === watched) enter(); };
  const start = () => {
    if (observer || !view) return;
    observer = new view.IntersectionObserver(onEntries, { threshold: thresholds });
    document.addEventListener('leavepictureinpicture', onLeave, true);
    document.addEventListener('play', onPlay, true);
    document.addEventListener('fullscreenchange', enter);
    for (const type of activations) view.addEventListener(type, enter, true);
  };
  const stop = () => {
    if (!observer) return;
    observer.disconnect();
    observer = null;
    document.removeEventListener('leavepictureinpicture', onLeave, true);
    document.removeEventListener('play', onPlay, true);
    document.removeEventListener('fullscreenchange', enter);
    for (const type of activations) view?.removeEventListener(type, enter, true);
  };
  return {
    /** Follows the switch and the selection; call it when either may have changed. */
    sync() {
      const target = options.enabled() ? options.target() : undefined;
      const next = target?.localName === 'video' ? target as HTMLVideoElement : undefined;
      if (next === watched) return;
      if (watched) observer?.unobserve(watched);
      watched = next;
      armed = false;
      out = false;
      if (!next) { stop(); return; }
      start();
      observer?.observe(next);
    },
    dispose() {
      watched = undefined;
      stop();
    }
  };
}
