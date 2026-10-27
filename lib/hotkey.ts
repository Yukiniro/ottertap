import { i18n } from '#i18n';
import { defaultKeybinds, pressedKey, type KeyPress, type Keybinds } from './keybinds';
import { isPipFailureKey, lockedMedia } from './media';
import { nextRate } from './rate';
import { actualSkipSeconds, hintSkipSeconds } from './skip';
import { isSkipSeconds, normalizeCoarseStep, normalizeSkipSeconds, normalizeVolumeStep } from './settings';
import { steppedVolume, volumeStepForWheel } from './volume';
import type { MediaCommand, MediaState, PageState, WheelDirection } from './types';

export type HotkeyAction =
  | { type: 'volume'; delta: number }
  | { type: 'volume'; notches: number; coarse?: boolean }
  | { type: 'rate'; direction: 1 | -1 | 0 }
  | { type: 'toggle' }
  | { type: 'mute' }
  | { type: 'pip' }
  | { type: 'skip'; delta: number }
  | { type: 'frame'; direction: 1 | -1 }
  | { type: 'mirror' }
  | { type: 'mark'; action: 'set' | 'jump' };

export type MirrorMarkHintKey = 'mirrorOnHint' | 'mirrorOffHint' | 'markSetHint' | 'markJumpHint';
export type ActionHintKey = 'play' | 'paused' | 'skipBack' | 'skipForward' | 'mute' | 'unmute' | 'shortcutFrameBack' | 'shortcutFrameForward' | 'frameStepUnavailable' | MirrorMarkHintKey;

export const volumeGestureEvent = 'ottertap-volume-gesture';
export const rateHintEvent = 'ottertap-rate';
export const actionHintEvent = 'ottertap-action-hint';

type KeyInput = KeyPress;
/** `onMedia`: the pointer is over a media element or one has focus. Single-key ↑/↓ need it so page scrolling keeps the arrows. */
export interface KeyContext { singleKey?: boolean; onMedia?: boolean; skipSeconds?: number; volumeStep?: number; keybinds?: Keybinds }

const altTypedKeys = new Set([',', '.', '0', '<', '>', ')', 'm']);
const altPhysicalKeys: Record<string, string> = { Comma: ',', Period: '.', Digit0: '0', KeyM: 'm' };

function altKeyName(event: KeyInput) {
  // macOS Option rewrites key (Option+M types µ), so fall back to code.
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (altTypedKeys.has(key)) return key;
  return altPhysicalKeys[event.code ?? ''] ?? key;
}

const rate = (direction: 1 | -1 | 0): HotkeyAction => ({ type: 'rate', direction });

export function hotkeyFromKeyboard(event: KeyInput, { singleKey = false, onMedia = false, skipSeconds = 10, volumeStep = 10, keybinds = defaultKeybinds }: KeyContext = {}): HotkeyAction | null {
  const step = normalizeSkipSeconds(skipSeconds);
  const volume = normalizeVolumeStep(volumeStep);
  if (event.ctrlKey || event.metaKey) return null;
  if (event.altKey) {
    const name = altKeyName(event);
    if (name === '.' || name === '>') return rate(1);
    if (name === ',' || name === '<') return rate(-1);
    if (name === '0' || name === ')') return rate(0);
    return name === 'm' ? { type: 'mute' } : null;
  }
  const name = pressedKey(event, keybinds);
  // Frame keys, and any mirror or mark key the user bound, work even when single-key mode is off.
  if (name === keybinds.frameBack) return { type: 'frame', direction: -1 };
  if (name === keybinds.frameForward) return { type: 'frame', direction: 1 };
  if (keybinds.mirror && name === keybinds.mirror) return { type: 'mirror' };
  if (keybinds.markSet && name === keybinds.markSet) return { type: 'mark', action: 'set' };
  if (keybinds.markJump && name === keybinds.markJump) return { type: 'mark', action: 'jump' };
  if (!singleKey) return null;
  if (name === keybinds.rateUp) return rate(1);
  if (name === keybinds.rateDown) return rate(-1);
  if (name === keybinds.toggle) return { type: 'toggle' };
  if (name === keybinds.mute) return { type: 'mute' };
  if (name === keybinds.skipBack || name === 'ArrowLeft') return { type: 'skip', delta: -step };
  if (name === keybinds.skipForward || name === 'ArrowRight') return { type: 'skip', delta: step };
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

/** Focus inside a text field, including an open shadow root. Wheel events target the element under the pointer, not the field. */
export function isTypingFocus(root: { activeElement: unknown } | null | undefined = typeof document === 'undefined' ? undefined : document): boolean {
  const node = root?.activeElement as { shadowRoot?: { activeElement: unknown } | null } | null | undefined;
  if (!node) return false;
  if (node.shadowRoot?.activeElement) return isTypingFocus(node.shadowRoot);
  return isTypingTarget(node);
}

/** A focused text field keeps Shift+wheel. Alt+wheel still adjusts volume there. */
export function keepShiftWheel(event: { altKey: boolean; shiftKey: boolean }, typing: boolean) {
  return typing && event.shiftKey && !event.altKey;
}

/** Hover wheel over the main player. Shift may arrive as a horizontal delta after the browser remaps it. Sideways swipes without Shift stay with the page. */
export function bareVolumeWheel(event: { altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; deltaX: number; deltaY: number }, overStage: boolean) {
  if (event.altKey || event.ctrlKey || event.metaKey || !overStage) return false;
  return Boolean(event.deltaY || (event.shiftKey && event.deltaX));
}

/** Signed wheel notches. Pixel mode treats 100 as one notch; line and page modes use the raw delta. Scroll-up is positive. */
export function wheelNotches(delta: number, deltaMode: number) {
  if (!delta) return 0;
  return -(deltaMode === 0 ? delta / 100 : delta);
}

/** `up` keeps scroll-up as volume-up. `down` flips the notch sign. Arrow keys and the slider do not use this. */
export function directedWheelNotches(notches: number, direction: WheelDirection = 'up') {
  return direction === 'down' ? -notches : notches;
}

export function wheelVolumeDelta(deltaY: number, deltaMode: number, volumeStep = 10) {
  return wheelNotches(deltaY, deltaMode) * normalizeVolumeStep(volumeStep);
}

export function isHotkeyAction(value: unknown): value is HotkeyAction {
  if (!value || typeof value !== 'object') return false;
  const action = value as HotkeyAction;
  if (action.type === 'volume') {
    const record = action as { delta?: unknown; notches?: unknown };
    const notches = 'notches' in action;
    const delta = 'delta' in action;
    if (notches === delta) return false;
    const amount = notches ? record.notches : record.delta;
    return typeof amount === 'number' && Number.isFinite(amount) && Math.abs(amount) <= 150;
  }
  if (action.type === 'rate') return action.direction === 1 || action.direction === -1 || action.direction === 0;
  if (action.type === 'toggle' || action.type === 'mute' || action.type === 'pip' || action.type === 'mirror') return true;
  if (action.type === 'mark') return action.action === 'set' || action.action === 'jump';
  if (action.type === 'frame') return action.direction === 1 || action.direction === -1;
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
  if (action.type !== 'volume' || !('delta' in action)) return action;
  const direction = action.delta < 0 ? -1 : 1;
  return { type: 'volume', delta: direction * normalizeVolumeStep(step) };
}

export function commandForHotkey(action: HotkeyAction, media: MediaState, remembered?: number | null, rateStep?: number, skipWithRate = false, volumeStep = 10, fineWheel = true, wheelDirection: WheelDirection = 'up', coarseStep = 20): MediaCommand | null {
  if (action.type === 'rate') {
    const value = nextRate(media.rate, action.direction, remembered, rateStep);
    return value === media.rate ? null : { type: 'rate', value };
  }
  if (action.type === 'toggle') return { type: media.paused ? 'play' : 'pause' };
  if (action.type === 'mute') return { type: 'mute' };
  if (action.type === 'pip') return { type: 'pip' };
  if (action.type === 'mirror') return { type: 'mirror', value: media.mirrored !== true };
  if (action.type === 'mark') return { type: 'mark', action: action.action };
  if (action.type === 'frame') return { type: 'frame', direction: action.direction };
  if (action.type === 'skip') {
    if (!isSkipSeconds(Math.abs(action.delta))) return null;
    const seconds = actualSkipSeconds(Math.abs(action.delta), media.rate, skipWithRate);
    return { type: 'skip', value: action.delta < 0 ? -seconds : seconds };
  }
  if (action.type !== 'volume') return null;
  const percent = shownPercent(media);
  // Shift already picked the coarse step. Skip the 1% rule for that gesture.
  const delta = 'notches' in action
    ? directedWheelNotches(action.notches, wheelDirection) * (action.coarse ? normalizeCoarseStep(coarseStep) : volumeStepForWheel(percent, volumeStep, fineWheel))
    : action.delta;
  if (!delta) return null;
  const max = media.maxVolume * 100;
  return { type: 'volume', value: steppedVolume(percent, delta, max) / 100 };
}

/** Success copy for a mirror toggle or a mark set/jump. Clear has no success hint. */
export function mirrorMarkHintKey(command: MediaCommand): MirrorMarkHintKey | '' {
  if (command.type === 'mirror') return command.value ? 'mirrorOnHint' : 'mirrorOffHint';
  if (command.type === 'mark' && command.action === 'set') return 'markSetHint';
  if (command.type === 'mark' && command.action === 'jump') return 'markJumpHint';
  return '';
}

export function actionHintText(key: string, seconds?: number) {
  if (key === 'skipBack' || key === 'skipForward') return i18n.t(key, { seconds: hintSkipSeconds(seconds) });
  if (key === 'play' || key === 'paused' || key === 'mute' || key === 'unmute' || key === 'shortcutFrameBack' || key === 'shortcutFrameForward' || key === 'frameStepUnavailable' || key === 'mirrorOnHint' || key === 'mirrorOffHint' || key === 'markSetHint' || key === 'markJumpHint' || key === 'mirrorUnavailableAudio' || key === 'markUnavailable' || key === 'markMissing' || key === 'cannotSeek' || isPipFailureKey(key)) return i18n.t(key);
  return '';
}

export function actionHintKey(action: HotkeyAction, media: MediaState): ActionHintKey | '' {
  if (action.type === 'toggle') return media.paused ? 'play' : 'paused';
  if (action.type === 'skip') return action.delta < 0 ? 'skipBack' : 'skipForward';
  if (action.type === 'frame') return action.direction < 0 ? 'shortcutFrameBack' : 'shortcutFrameForward';
  if (action.type === 'mute') return media.muted ? 'unmute' : 'mute';
  if (action.type === 'mirror' || action.type === 'mark') {
    const command = commandForHotkey(action, media);
    return command ? mirrorMarkHintKey(command) : '';
  }
  return '';
}

export function isFloatingEvent(event: Event) {
  return event.composedPath().some(node => node instanceof Element && node.localName === 'ottertap-controller');
}

export function planHotkey(page: PageState, action: HotkeyAction, remembered?: number | null, rateStep?: number, skipWithRate = false, volumeStep = 10, fineWheel = true, wheelDirection: WheelDirection = 'up', coarseStep = 20) {
  if (!page.enabled || !page.media.length) return null;
  const media = lockedMedia(page.media, page.selectedId);
  if (!media) return null;
  const command = commandForHotkey(action, media, remembered, rateStep, skipWithRate, volumeStep, fineWheel, wheelDirection, coarseStep);
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
  /** Physical keys whose keydown was taken. Their keyup is taken too, even after Shift is released first. */
  const held = new Set<string>();
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
      if (action.type === 'volume' && 'notches' in action) send({ type: 'volume', notches: Math.max(-150, Math.min(150, action.notches)), ...(action.coarse ? { coarse: true } : {}) }, target);
      else if (action.type === 'volume') send({ type: 'volume', delta: Math.max(-150, Math.min(150, action.delta)) }, target);
      else send(action, target);
    }
  };
  const queue = (action: HotkeyAction, target?: string) => {
    pending.push({ action, target });
    if (!frame) frame = window.requestAnimationFrame(flush);
  };
  return {
    key(event: KeyInput & { type?: string; repeat?: boolean; preventDefault(): void; stopPropagation(): void; stopImmediatePropagation?(): void }, { singleKey = false, skipSeconds = 10, volumeStep = 10, keybinds, target }: Omit<KeyContext, 'onMedia'> & { target?: string } = {}) {
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
      const id = event.code || event.key;
      const paired = held.delete(id) && event.type === 'keyup';
      const action = paired ? null : hotkeyFromKeyboard(event, { singleKey, onMedia: target !== undefined, skipSeconds, volumeStep, keybinds });
      if (!action && !paired) return false;
      // Capture-phase stop keeps the site's own shortcut on the same key from also running.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if (!action || event.type === 'keyup') return true;
      held.add(id);
      if (event.altKey) useAlt();
      // A held key repeats. Mirror and marks are one shot per press.
      if (event.repeat && (action.type === 'mirror' || action.type === 'mark')) return true;
      queue(action, action.type === 'volume' ? target : undefined);
      return true;
    },
    wheel(event: { deltaX: number; deltaY: number; deltaMode: number; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; preventDefault(): void; stopPropagation(): void }, target?: string) {
      if (event.ctrlKey || event.metaKey) return false;
      // Shift changes the step, not where the gesture works. Without Alt, only a player target counts.
      if (!event.altKey && target === undefined) return false;
      // Alt+wheel keeps the horizontal axis for macOS. Shift may arrive as that axis after the browser remaps it.
      // Notches stay unscaled. Without Shift, the applier picks 1% or the saved step. Shift skips that and uses the coarse step.
      const notches = wheelNotches(event.altKey || event.shiftKey ? event.deltaY || event.deltaX : event.deltaY, event.deltaMode);
      if (!notches) return false;
      event.preventDefault();
      event.stopPropagation();
      if (event.altKey) useAlt();
      queue(event.shiftKey ? { type: 'volume', notches, coarse: true } : { type: 'volume', notches }, target);
      return true;
    },
    /** An action decided outside the keyboard path, such as a short tap on a hold-to-skip key. */
    press(action: HotkeyAction) { queue(action); },
    /** Another frame used the current Alt press; this frame may be the one that receives its release. */
    arm() { altUsed = true; },
    dispose() { window.cancelAnimationFrame(frame); frame = 0; pending = []; held.clear(); }
  };
}

export function createHotkeySession(perform: (action: HotkeyAction, target?: string) => Promise<void>) {
  let tail = Promise.resolve();
  return createHotkeyInput((action, target) => { tail = tail.then(() => perform(action, target)).catch(() => {}); });
}
