import { lockedMedia } from './media';
import { nextRate } from './rate';
import { steppedVolume } from './volume';
import type { MediaCommand, MediaState, PageState } from './types';

export type HotkeyAction =
  | { type: 'volume'; delta: number }
  | { type: 'rate'; direction: 1 | -1 | 0 }
  | { type: 'toggle' }
  | { type: 'mute' }
  | { type: 'skip'; delta: number };

export type ActionHintKey = 'play' | 'paused' | 'skipBack' | 'skipForward' | 'mute' | 'unmute';

export const volumeGestureEvent = 'ottertap-volume-gesture';
export const rateHintEvent = 'ottertap-rate';
export const actionHintEvent = 'ottertap-action-hint';

interface KeyInput { key: string; code?: string; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }

function rateDirection(event: KeyInput): 1 | -1 | 0 | null {
  // Characters follow the typed glyph, including AZERTY. code stays stable when macOS Option rewrites key.
  if (event.key === '.' || event.key === '>') return 1;
  if (event.key === ',' || event.key === '<') return -1;
  if (event.key === '0' || event.key === ')') return 0;
  if (event.code === 'Period') return 1;
  if (event.code === 'Comma') return -1;
  if (event.code === 'Digit0') return 0;
  return null;
}

export function hotkeyFromKeyboard(event: KeyInput): HotkeyAction | null {
  if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return null;
  if (event.key === 'ArrowUp') return { type: 'volume', delta: 10 };
  if (event.key === 'ArrowDown') return { type: 'volume', delta: -10 };
  const direction = rateDirection(event);
  return direction === null ? null : { type: 'rate', direction };
}

export function wheelVolumeDelta(deltaY: number, deltaMode: number) {
  if (!deltaY) return 0;
  const notches = deltaMode === 0 ? deltaY / 100 : deltaY;
  return -notches * 10;
}

export function isHotkeyAction(value: unknown): value is HotkeyAction {
  if (!value || typeof value !== 'object') return false;
  const action = value as HotkeyAction;
  if (action.type === 'volume') return Number.isFinite(action.delta) && Math.abs(action.delta) <= 150;
  if (action.type === 'rate') return action.direction === 1 || action.direction === -1 || action.direction === 0;
  if (action.type === 'toggle' || action.type === 'mute') return true;
  return action.type === 'skip' && (action.delta === 10 || action.delta === -10);
}

export function shownPercent(media: MediaState) {
  return media.muted || media.volume <= 0 ? 0 : media.volume * 100;
}

export function commandForHotkey(action: HotkeyAction, media: MediaState): MediaCommand | null {
  if (action.type === 'rate') {
    const value = nextRate(media.rate, action.direction);
    return value === media.rate ? null : { type: 'rate', value };
  }
  if (action.type === 'toggle') return { type: media.paused ? 'play' : 'pause' };
  if (action.type === 'mute') return { type: 'mute' };
  if (action.type === 'skip') return action.delta === 10 || action.delta === -10 ? { type: 'skip', value: action.delta } : null;
  if (!action.delta) return null;
  const max = media.maxVolume * 100;
  return { type: 'volume', value: steppedVolume(shownPercent(media), action.delta, max) / 100 };
}

export function actionHintKey(action: HotkeyAction, media: MediaState): ActionHintKey | '' {
  if (action.type === 'toggle') return media.paused ? 'play' : 'paused';
  if (action.type === 'skip') return action.delta < 0 ? 'skipBack' : 'skipForward';
  if (action.type === 'mute') return media.muted ? 'unmute' : 'mute';
  return '';
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
  let pending: HotkeyAction[] = [];
  let frame = 0;
  const flush = () => {
    frame = 0;
    const steps = pending;
    pending = [];
    if (steps.some(action => action.type === 'volume')) window.dispatchEvent(new window.CustomEvent(volumeGestureEvent));
    // Keep event boundaries so the input after landing on 100% can leave it.
    for (const action of steps) {
      if (action.type === 'volume') send({ type: 'volume', delta: Math.max(-150, Math.min(150, action.delta)) });
      else send(action);
    }
  };
  const queue = (action: HotkeyAction) => {
    pending.push(action);
    if (!frame) frame = window.requestAnimationFrame(flush);
  };
  return {
    key(event: KeyInput & { type?: string; preventDefault(): void; stopPropagation(): void; stopImmediatePropagation?(): void }) {
      const action = hotkeyFromKeyboard(event);
      if (!action) return false;
      // Capture-phase stop keeps Shift+, / Shift+. on the page from also stepping speed.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if (event.type === 'keyup') return true;
      queue(action);
      return true;
    },
    wheel(event: { deltaX: number; deltaY: number; deltaMode: number; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; preventDefault(): void; stopPropagation(): void }) {
      if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return false;
      // macOS can map Shift+wheel to the horizontal axis.
      const delta = wheelVolumeDelta(event.deltaY || event.deltaX, event.deltaMode);
      if (!delta) return false;
      event.preventDefault();
      event.stopPropagation();
      queue({ type: 'volume', delta });
      return true;
    },
    dispose() { window.cancelAnimationFrame(frame); frame = 0; pending = []; }
  };
}

export function createHotkeySession(perform: (action: HotkeyAction) => Promise<void>) {
  let tail = Promise.resolve();
  return createHotkeyInput(action => { tail = tail.then(() => perform(action)).catch(() => {}); });
}
