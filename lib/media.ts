import { i18n } from '#i18n';
import { canAmplify, createAmplifier, maxGain, splitVolume, type Amplifier } from './amplifier';
import { maxRate, minRate, readSettledRate } from './rate';
import type { MediaCommand, MediaState } from './types';
import { formatTime } from './utils';

export const mediaPresenceEvent = 'ottertap-media';

export function discoverMedia(root: Document | ShadowRoot, onRoot?: (root: Document | ShadowRoot) => void): HTMLMediaElement[] {
  onRoot?.(root);
  const media = [...root.querySelectorAll<HTMLMediaElement>('audio,video')].filter(element => element.namespaceURI === 'http://www.w3.org/1999/xhtml');
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot && element.localName !== 'ottertap-controller') media.push(...discoverMedia(element.shadowRoot, onRoot));
  }
  return media;
}

const maxVolume = (element: HTMLMediaElement, amplifier?: Amplifier) => amplifier && (amplifier.gain(element) > 1 || canAmplify(element, element.ownerDocument)) ? maxGain : 1;

export function pickMedia(media: MediaState[]) {
  return media.find(item => !item.paused && !item.muted && item.volume > 0) ?? media.find(item => !item.paused) ?? media[0];
}

export function lockedMedia(media: MediaState[], selectedId: string) {
  return media.find(item => item.id === selectedId) ?? pickMedia(media);
}

export function keptSelection(selectedId: string, ids: string[], failedFrames: Set<number>) {
  if (!selectedId) return '';
  if (ids.includes(selectedId)) return selectedId;
  return failedFrames.has(Number(selectedId.split(':')[0])) ? selectedId : '';
}

export function mediaChoiceLabel(media: MediaState, index: number) {
  const kind = media.kind === 'video' ? i18n.t('video') : i18n.t('audio');
  const playback = media.paused ? i18n.t('paused') : i18n.t('playing');
  const sound = !media.muted && media.volume > 0 ? i18n.t('audible') : i18n.t('muted');
  const text = `${index + 1}. ${kind} · ${playback} · ${sound} · ${formatTime(media.currentTime)}`;
  return media.label ? `${text} · ${media.label}` : text;
}

export function mediaSnapshot(element: HTMLMediaElement, id: string, document: Document, amplifier?: Amplifier): MediaState {
  const ranges = element.seekable;
  const label = element.getAttribute('aria-label')?.trim() || element.getAttribute('title')?.trim() || '';
  return {
    id, label, title: label || document.title || i18n.t('unnamedMedia'),
    host: new URL(document.URL).hostname,
    kind: element.localName === 'video' ? 'video' : 'audio',
    paused: element.paused, muted: element.muted, volume: element.volume * (amplifier?.gain(element) ?? 1), maxVolume: maxVolume(element, amplifier), rate: element.playbackRate,
    currentTime: Number.isFinite(element.currentTime) ? element.currentTime : 0,
    duration: Number.isFinite(element.duration) ? element.duration : null,
    live: element.duration === Infinity,
    seekable: Array.from({ length: ranges.length }, (_, index) => ({ start: ranges.start(index), end: ranges.end(index) }))
  };
}

export function isMediaCommand(value: unknown): value is MediaCommand {
  if (!value || typeof value !== 'object') return false;
  const command = value as MediaCommand;
  if (['play', 'pause', 'mute'].includes(command.type)) return true;
  if (!('value' in command) || !Number.isFinite(command.value)) return false;
  if (command.type === 'volume') return command.value >= 0 && command.value <= maxGain;
  if (command.type === 'rate') return command.value >= minRate && command.value <= maxRate;
  return ['seek', 'skip'].includes(command.type);
}

export async function applyMediaCommand(element: HTMLMediaElement, command: MediaCommand, amplifier?: Amplifier) {
  if (!isMediaCommand(command)) throw new Error(i18n.t('invalidMediaCommand'));
  if (command.type === 'play') { await element.play(); return; }
  if (command.type === 'pause') { element.pause(); return; }
  if (command.type === 'mute') { element.muted = !element.muted; return; }
  if (command.type === 'volume') {
    if (command.value > maxVolume(element, amplifier)) throw new Error(i18n.t('cannotBoostCrossOrigin'));
    const { volume, gain } = splitVolume(command.value);
    await amplifier?.set(element, gain);
    element.volume = volume;
    if (command.value > 0) element.muted = false;
    return;
  }
  if (command.type === 'rate') { element.playbackRate = command.value; return; }
  if (!('value' in command)) throw new Error(i18n.t('invalidMediaCommand'));
  const ranges = element.seekable;
  if (!ranges.length) throw new Error(i18n.t('cannotSeek'));
  const target = command.type === 'skip' ? element.currentTime + command.value : command.value;
  let closest = ranges.start(0);
  let distance = Infinity;
  for (let index = 0; index < ranges.length; index++) {
    const candidate = Math.max(ranges.start(index), Math.min(target, ranges.end(index)));
    if (Math.abs(target - candidate) < distance) { closest = candidate; distance = Math.abs(target - candidate); }
  }
  element.currentTime = closest;
}

export function createMediaController(document: Document, onChange?: () => void) {
  let nextId = 0;
  const ids = new WeakMap<HTMLMediaElement, string>();
  let elements: HTMLMediaElement[] = [];
  let dirty = true;
  const amplifier = createAmplifier(document.defaultView!);
  const flashed = new WeakMap<HTMLMediaElement, { token: number; outline: string; offset: string }>();
  let flashToken = 0;
  const observers = new Map<Document | ShadowRoot, MutationObserver>();
  const observe = (root: Document | ShadowRoot) => {
    if (observers.has(root)) return;
    const observer = new document.defaultView!.MutationObserver(() => { dirty = true; onChange?.(); });
    observer.observe(root, { childList: true, subtree: true });
    observers.set(root, observer);
  };
  return {
    snapshot() {
      // shortcut: late Shadow Roots need an outer DOM mutation; add attachShadow tracking if target sites require it.
      if (dirty) {
        elements = discoverMedia(document, observe);
        dirty = false;
        for (const [root, observer] of observers) if ('host' in root && !root.host.isConnected) { observer.disconnect(); observers.delete(root); }
      }
      return elements.map(element => {
        if (!ids.has(element)) ids.set(element, String(++nextId));
        return mediaSnapshot(element, ids.get(element)!, document, amplifier);
      });
    },
    async command(id: string, command: MediaCommand) {
      const element = elements.find(media => ids.get(media) === id && media.isConnected);
      if (!element) throw new Error(i18n.t('mediaRemoved'));
      await applyMediaCommand(element, command, amplifier);
      if (command.type === 'rate') return readSettledRate(element);
    },
    flash(id: string) {
      this.snapshot();
      const element = elements.find(media => ids.get(media) === id && media.isConnected);
      const view = element?.ownerDocument.defaultView;
      if (!element || !view) return;
      let state = flashed.get(element);
      if (!state) {
        state = { token: 0, outline: element.style.outline, offset: element.style.outlineOffset };
        flashed.set(element, state);
      }
      const token = ++flashToken;
      state.token = token;
      element.style.outline = '3px solid #e4572e';
      element.style.outlineOffset = '4px';
      const origin = state;
      view.setTimeout(() => {
        if (flashed.get(element)?.token !== token) return;
        element.style.outline = origin.outline;
        element.style.outlineOffset = origin.offset;
        flashed.delete(element);
      }, 1200);
    },
    destroy() { for (const observer of observers.values()) observer.disconnect(); observers.clear(); }
  };
}
