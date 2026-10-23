import { i18n } from '#i18n';
import { isPipFailureKey, lockedMedia } from './media';
import { nextRate } from './rate';
import { actualSkipSeconds, hintSkipSeconds } from './skip';
import { isSkipSeconds, normalizeSkipSeconds, normalizeVolumeStep } from './settings';
import { steppedVolume } from './volume';
import type { MediaCommand, MediaState, PageState } from './types';

export type HotkeyAction =
  | { type: 'volume'; delta: number }
  | { type: 'rate'; direction: 1 | -1 | 0 }
  | { type: 'toggle' }
  | { type: 'mute' }
  | { type: 'pip' }
  | { type: 'skip'; delta: number };

export type ActionHintKey = 'play' | 'paused' | 'skipBack' | 'skipForward' | 'mute' | 'unmute';

export const volumeGestureEvent = 'ottertap-volume-gesture';
export const rateHintEvent = 'ottertap-rate';
export const actionHintEvent = 'ottertap-action-hint';

interface KeyInput { key: string; code?: string; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }
/** `onMedia`: the pointer is over a media element or one has focus. Single-key ↑/↓ need it so page scrolling keeps the arrows. */
export interface KeyContext { singleKey?: boolean; onMedia?: boolean; skipSeconds?: number; volumeStep?: number }

const typedKeys = new Set([',', '.', '0', '<', '>', ')', 'm', 'k', 'j', 'l']);
const physicalKeys: Record<string, string> = { Comma: ',', Period: '.', Digit0: '0', KeyM: 'm', KeyK: 'k', KeyJ: 'j', KeyL: 'l' };

function keyName(event: KeyInput) {
  // The typed glyph wins, so AZERTY keeps its printed keys. macOS Option rewrites key (Option+M types µ), so fall back to code.
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (typedKeys.has(key) || key.startsWith('Arrow')) return key;
  return physicalKeys[event.code ?? ''] ?? key;
}

const rate = (direction: 1 | -1 | 0): HotkeyAction => ({ type: 'rate', direction });

export function hotkeyFromKeyboard(event: KeyInput, { singleKey = false, onMedia = false, skipSeconds = 10, volumeStep = 10 }: KeyContext = {}): HotkeyAction | null {
  const step = normalizeSkipSeconds(skipSeconds);
  const volume = normalizeVolumeStep(volumeStep);
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
  if (name === 'j' || name === 'ArrowLeft') return { type: 'skip', delta: -step };
  if (name === 'l' || name === 'ArrowRight') return { type: 'skip', delta: step };
  if (!onMedia) return null;
  if (name === 'ArrowUp') return { type: 'volume', delta: volume };
  if (name === 'ArrowDown') return { type: 'volume', delta: -volume };
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

export function wheelVolumeDelta(deltaY: number, deltaMode: number, volumeStep = 10) {
  if (!deltaY) return 0;
  const notches = deltaMode === 0 ? deltaY / 100 : deltaY;
  return -notches * normalizeVolumeStep(volumeStep);
}

export function isHotkeyAction(value: unknown): value is HotkeyAction {
  if (!value || typeof value !== 'object') return false;
  const action = value as HotkeyAction;
  if (action.type === 'volume') return Number.isFinite(action.delta) && Math.abs(action.delta) <= 150;
  if (action.type === 'rate') return action.direction === 1 || action.direction === -1 || action.direction === 0;
  if (action.type === 'toggle' || action.type === 'mute' || action.type === 'pip') return true;
  return action.type === 'skip' && isSkipSeconds(Math.abs(action.delta));
}

export function shownPercent(media: MediaState) {
  return media.muted || media.volume <= 0 ? 0 : media.volume * 100;
}

/** Command deltas only point backward or forward. The stored step supplies the seconds. */
export function applySkipStep(action: HotkeyAction, seconds: number): HotkeyAction {
  if (action.type !== 'skip') return action;
  const direction = action.delta < 0 ? -1 : 1;
  return { type: 'skip', delta: direction * normalizeSkipSeconds(seconds) };
}

/** Command deltas only point up or down. The stored step supplies the percentage points. */
export function applyVolumeStep(action: HotkeyAction, step: number): HotkeyAction {
  if (action.type !== 'volume') return action;
  const direction = action.delta < 0 ? -1 : 1;
  return { type: 'volume', delta: direction * normalizeVolumeStep(step) };
}

export function commandForHotkey(action: HotkeyAction, media: MediaState, remembered?: number | null, rateStep?: number, skipWithRate = false): MediaCommand | null {
  if (action.type === 'rate') {
    const value = nextRate(media.rate, action.direction, remembered, rateStep);
    return value === media.rate ? null : { type: 'rate', value };
  }
  if (action.type === 'toggle') return { type: media.paused ? 'play' : 'pause' };
  if (action.type === 'mute') return { type: 'mute' };
  if (action.type === 'pip') return { type: 'pip' };
  if (action.type === 'skip') {
    if (!isSkipSeconds(Math.abs(action.delta))) return null;
    const seconds = actualSkipSeconds(Math.abs(action.delta), media.rate, skipWithRate);
    return { type: 'skip', value: action.delta < 0 ? -seconds : seconds };
  }
  if (!action.delta) return null;
  const max = media.maxVolume * 100;
  return { type: 'volume', value: steppedVolume(shownPercent(media), action.delta, max) / 100 };
}

export function actionHintText(key: string, seconds?: number) {
  if (key === 'skipBack' || key === 'skipForward') return i18n.t(key, { seconds: hintSkipSeconds(seconds) });
  if (key === 'play' || key === 'paused' || key === 'mute' || key === 'unmute' || isPipFailureKey(key)) return i18n.t(key);
  return '';
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

export function planHotkey(page: PageState, action: HotkeyAction, remembered?: number | null, rateStep?: number, skipWithRate = false) {
  if (!page.enabled || !page.media.length) return null;
  const media = lockedMedia(page.media, page.selectedId);
  if (!media) return null;
  const command = commandForHotkey(action, media, remembered, rateStep, skipWithRate);
  return command ? { media, command } : null;
}

/**
 * `target` names the hovered or focused media for gestures that only fire over media.
 * `onAltUse` runs once per Alt press that drove a gesture, so frames without the keyboard can be told to `arm`.
 */
export function createHotkeyInput(send: (action: HotkeyAction, target?: string) => void, onAltUse?: () => void) {
  let pending: { action: HotkeyAction; target?: string }[] = [];
  let frame = 0;
  let altUsed = false;
  const useAlt = () => {
    if (altUsed) return;
    altUsed = true;
    onAltUse?.();
  };
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
    key(event: KeyInput & { type?: string; repeat?: boolean; preventDefault(): void; stopPropagation(): void; stopImmediatePropagation?(): void }, { singleKey = false, skipSeconds = 10, volumeStep = 10, target }: { singleKey?: boolean; skipSeconds?: number; volumeStep?: number; target?: string } = {}) {
      if (event.key === 'Alt') {
        // Windows Chrome focuses its menu on an Alt release the page leaves unhandled, even after the page used Alt+wheel or Alt+key.
        if (event.type !== 'keyup') {
          if (!event.repeat) altUsed = false;
          return false;
        }
        const swallow = altUsed;
        altUsed = false;
        if (swallow) event.preventDefault();
        return swallow;
      }
      const action = hotkeyFromKeyboard(event, { singleKey, onMedia: target !== undefined, skipSeconds, volumeStep });
      if (!action) return false;
      // Capture-phase stop keeps the site's own shortcut on the same key from also running.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if (event.type === 'keyup') return true;
      if (event.altKey) useAlt();
      queue(action, action.type === 'volume' ? target : undefined);
      return true;
    },
    wheel(event: { deltaX: number; deltaY: number; deltaMode: number; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; preventDefault(): void; stopPropagation(): void }, target?: string, volumeStep = 10) {
      if (event.ctrlKey || event.metaKey) return false;
      if (!event.altKey && (target === undefined || event.shiftKey)) return false;
      // Alt+wheel keeps the horizontal axis for macOS. A bare hover wheel leaves sideways swipes to the page.
      const delta = wheelVolumeDelta(event.altKey ? event.deltaY || event.deltaX : event.deltaY, event.deltaMode, volumeStep);
      if (!delta) return false;
      event.preventDefault();
      event.stopPropagation();
      if (event.altKey) useAlt();
      queue({ type: 'volume', delta }, target);
      return true;
    },
    /** Another frame used the current Alt press; this frame may be the one that receives its release. */
    arm() { altUsed = true; },
    dispose() { window.cancelAnimationFrame(frame); frame = 0; pending = []; }
  };
}

export function createHotkeySession(perform: (action: HotkeyAction, target?: string) => Promise<void>) {
  let tail = Promise.resolve();
  return createHotkeyInput((action, target) => { tail = tail.then(() => perform(action, target)).catch(() => {}); });
}
