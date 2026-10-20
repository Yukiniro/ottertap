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
/** `onMedia`: the pointer is over a media element or one has focus. Single-key ↑/↓ need it so page scrolling keeps the arrows. */
export interface KeyContext { singleKey?: boolean; onMedia?: boolean }

const typedKeys = new Set([',', '.', '0', '<', '>', ')', 'm', 'k', 'j', 'l']);
const physicalKeys: Record<string, string> = { Comma: ',', Period: '.', Digit0: '0', KeyM: 'm', KeyK: 'k', KeyJ: 'j', KeyL: 'l' };

function keyName(event: KeyInput) {
  // The typed glyph wins, so AZERTY keeps its printed keys. macOS Option rewrites key (Option+M types µ), so fall back to code.
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (typedKeys.has(key) || key.startsWith('Arrow')) return key;
  return physicalKeys[event.code ?? ''] ?? key;
}

const rate = (direction: 1 | -1 | 0): HotkeyAction => ({ type: 'rate', direction });

export function hotkeyFromKeyboard(event: KeyInput, { singleKey = false, onMedia = false }: KeyContext = {}): HotkeyAction | null {
  if (event.ctrlKey || event.metaKey) return null;
  const name = keyName(event);
  if (event.altKey) {
    if (name === '.' || name === '>') return rate(1);
    if (name === ',' || name === '<') return rate(-1);
    if (name === '0' || name === ')') return rate(0);
    return name === 'm' ? { type: 'mute' } : null;
  }
  if (!singleKey) return null;
  if (event.shiftKey) {
    if (name === '>' || name === '.') return rate(1);
    if (name === '<' || name === ',') return rate(-1);
    return null;
  }
  if (name === '>') return rate(1);
  if (name === '<') return rate(-1);
  if (name === 'k') return { type: 'toggle' };
  if (name === 'm') return { type: 'mute' };
  if (name === 'j' || name === 'ArrowLeft') return { type: 'skip', delta: -10 };
  if (name === 'l' || name === 'ArrowRight') return { type: 'skip', delta: 10 };
  if (!onMedia) return null;
  if (name === 'ArrowUp') return { type: 'volume', delta: 10 };
  if (name === 'ArrowDown') return { type: 'volume', delta: -10 };
  return null;
}

const nonTextInputs = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit']);

export function isTypingTarget(node: unknown) {
  const element = node as Partial<HTMLInputElement> | null | undefined;
  if (!element || typeof element !== 'object' || element.nodeType !== 1) return false;
  if (element.isContentEditable) return true;
  if (element.localName === 'textarea' || element.localName === 'select') return true;
  return element.localName === 'input' && !nonTextInputs.has(element.type ?? 'text');
}

export function isTypingEvent(event: Event) {
  return isTypingTarget(event.composedPath()[0]);
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

/** `target` names the hovered or focused media for gestures that only fire over media. */
export function createHotkeyInput(send: (action: HotkeyAction, target?: string) => void) {
  let pending: { action: HotkeyAction; target?: string }[] = [];
  let frame = 0;
  let altWheel = false;
  const flush = () => {
    frame = 0;
    const steps = pending;
    pending = [];
    if (steps.some(step => step.action.type === 'volume')) window.dispatchEvent(new window.CustomEvent(volumeGestureEvent));
    // Keep event boundaries so the input after landing on 100% can leave it.
    for (const { action, target } of steps) {
      if (action.type === 'volume') send({ type: 'volume', delta: Math.max(-150, Math.min(150, action.delta)) }, target);
      else send(action, target);
    }
  };
  const queue = (action: HotkeyAction, target?: string) => {
    pending.push({ action, target });
    if (!frame) frame = window.requestAnimationFrame(flush);
  };
  return {
    key(event: KeyInput & { type?: string; preventDefault(): void; stopPropagation(): void; stopImmediatePropagation?(): void }, { singleKey = false, target }: { singleKey?: boolean; target?: string } = {}) {
      if (event.key === 'Alt') {
        // Windows Chrome focuses its menu when Alt is released on its own, which an Alt+wheel gesture looks like.
        const swallow = event.type === 'keyup' && altWheel;
        altWheel = false;
        if (swallow) event.preventDefault();
        return swallow;
      }
      const action = hotkeyFromKeyboard(event, { singleKey, onMedia: target !== undefined });
      if (!action) return false;
      // Capture-phase stop keeps the site's own shortcut on the same key from also running.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if (event.type === 'keyup') return true;
      queue(action, action.type === 'volume' ? target : undefined);
      return true;
    },
    wheel(event: { deltaX: number; deltaY: number; deltaMode: number; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; preventDefault(): void; stopPropagation(): void }, target?: string) {
      if (event.ctrlKey || event.metaKey) return false;
      if (!event.altKey && (target === undefined || event.shiftKey)) return false;
      // Alt+wheel keeps the horizontal axis for macOS. A bare hover wheel leaves sideways swipes to the page.
      const delta = wheelVolumeDelta(event.altKey ? event.deltaY || event.deltaX : event.deltaY, event.deltaMode);
      if (!delta) return false;
      event.preventDefault();
      event.stopPropagation();
      if (event.altKey) altWheel = true;
      queue({ type: 'volume', delta }, target);
      return true;
    },
    dispose() { window.cancelAnimationFrame(frame); frame = 0; pending = []; }
  };
}

export function createHotkeySession(perform: (action: HotkeyAction, target?: string) => Promise<void>) {
  let tail = Promise.resolve();
  return createHotkeyInput((action, target) => { tail = tail.then(() => perform(action, target)).catch(() => {}); });
}
