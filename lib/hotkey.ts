import { lockedMedia } from './media';
import type { MediaCommand, MediaState, PageState } from './types';

export type HotkeyAction = { type: 'volume'; delta: number };

export const volumeGestureEvent = 'ottertap-volume-gesture';

interface KeyInput { key: string; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }

export function hotkeyFromKeyboard(event: KeyInput): HotkeyAction | null {
  if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return null;
  if (event.key === 'ArrowUp') return { type: 'volume', delta: 10 };
  if (event.key === 'ArrowDown') return { type: 'volume', delta: -10 };
  return null;
}

export function wheelVolumeDelta(deltaY: number, deltaMode: number) {
  if (!deltaY) return 0;
  const notches = deltaMode === 0 ? deltaY / 100 : deltaY;
  return -notches * 10;
}

export function isHotkeyAction(value: unknown): value is HotkeyAction {
  if (!value || typeof value !== 'object') return false;
  const action = value as HotkeyAction;
  return action.type === 'volume' && Number.isFinite(action.delta) && Math.abs(action.delta) <= 150;
}

export function shownPercent(media: MediaState) {
  return media.muted || media.volume <= 0 ? 0 : media.volume * 100;
}

export function commandForHotkey(action: HotkeyAction, media: MediaState): MediaCommand | null {
  if (!action.delta) return null;
  const max = media.maxVolume * 100;
  return { type: 'volume', value: Math.max(0, Math.min(max, shownPercent(media) + action.delta)) / 100 };
}

export function isFloatingEvent(event: Event) {
  return event.composedPath().some(node => node instanceof Element && node.localName === 'ottertap-controller');
}

export function planHotkey(page: PageState, action: HotkeyAction) {
  if (!page.enabled || !page.media.length) return null;
  const media = lockedMedia(page.media, page.selectedId);
  if (!media) return null;
  const command = commandForHotkey(action, media);
  return command ? { media, command } : null;
}

export function createHotkeyInput(send: (action: HotkeyAction) => void) {
  let pending = 0;
  let frame = 0;
  const flush = () => {
    frame = 0;
    const step = Math.max(-150, Math.min(150, pending));
    pending = 0;
    if (!step) return;
    window.dispatchEvent(new window.CustomEvent(volumeGestureEvent));
    send({ type: 'volume', delta: step });
  };
  const queueVolume = (delta: number) => {
    pending += delta;
    if (!frame) frame = window.requestAnimationFrame(flush);
  };
  return {
    key(event: KeyInput & { preventDefault(): void; stopPropagation(): void }) {
      const action = hotkeyFromKeyboard(event);
      if (!action) return false;
      event.preventDefault();
      event.stopPropagation();
      queueVolume(action.delta);
      return true;
    },
    wheel(event: { deltaX: number; deltaY: number; deltaMode: number; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; preventDefault(): void; stopPropagation(): void }) {
      if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return false;
      // macOS can map Shift+wheel to the horizontal axis.
      const delta = wheelVolumeDelta(event.deltaY || event.deltaX, event.deltaMode);
      if (!delta) return false;
      event.preventDefault();
      event.stopPropagation();
      queueVolume(delta);
      return true;
    },
    dispose() { window.cancelAnimationFrame(frame); frame = 0; pending = 0; }
  };
}

export function createHotkeySession(perform: (action: HotkeyAction) => Promise<void>) {
  let tail = Promise.resolve();
  return createHotkeyInput(action => { tail = tail.then(() => perform(action), () => perform(action)); });
}
