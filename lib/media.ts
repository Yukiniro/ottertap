import { i18n } from '#i18n';
import { canAmplify, createAmplifier, isChannelMode, maxGain, splitVolume, type Amplifier } from './amplifier';
import { armRateEcho, createRateLockState, noteDesiredRate, observePlaybackRate, rateLockEpsilon, type RateLockState } from './rate-lock';
import { maxRate, minRate, noteRecallRate, readSettledRate, recallableRate, sameRate } from './rate';
import type { ChannelMode, MediaCommand, MediaState } from './types';
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

const routable = (element: HTMLMediaElement, amplifier?: Amplifier) => !!amplifier && (amplifier.gain(element) > 1 || amplifier.channel(element) !== 'stereo' || canAmplify(element, element.ownerDocument));
const maxVolume = (element: HTMLMediaElement, amplifier?: Amplifier) => routable(element, amplifier) ? maxGain : 1;

export function pickMedia(media: MediaState[]) {
  return media.find(item => !item.paused && !item.muted && item.volume > 0) ?? media.find(item => !item.paused) ?? media[0];
}

export function lockedMedia(media: MediaState[], selectedId: string) {
  return media.find(item => item.id === selectedId) ?? pickMedia(media);
}

export function mediaAtPoint<T extends Element>(elements: readonly T[], x: number, y: number) {
  return elements.find(element => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  });
}

/** Players often focus a wrapper around the video, so a focused ancestor counts too. */
export function focusedMedia<T extends Element>(elements: readonly T[], document: Document) {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  const focused = active;
  if (!focused || focused === document.body || focused === document.documentElement) return undefined;
  return elements.find(element => focused === element || focused.contains(element));
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
    seekable: Array.from({ length: ranges.length }, (_, index) => ({ start: ranges.start(index), end: ranges.end(index) })),
    ...pipFields(element, document),
    channel: amplifier?.channel(element) ?? 'stereo',
    channelAvailable: routable(element, amplifier)
  };
}

export function pipFields(element: HTMLMediaElement, document: Document): Pick<MediaState, 'pip' | 'pipAvailable' | 'pipBlock'> {
  if (element.localName !== 'video') return { pip: false, pipAvailable: false, pipBlock: 'audio' };
  const video = element as HTMLVideoElement;
  const pip = document.pictureInPictureElement === video;
  const supported = typeof video.requestPictureInPicture === 'function' && document.pictureInPictureEnabled === true;
  if (!supported) return { pip, pipAvailable: pip, pipBlock: pip ? '' : 'unsupported' };
  if (video.disablePictureInPicture && !pip) return { pip: false, pipAvailable: false, pipBlock: 'disabled' };
  return { pip, pipAvailable: true, pipBlock: '' };
}

export function pipHint(media: Pick<MediaState, 'pip' | 'pipAvailable' | 'pipBlock'>) {
  if (media.pip || media.pipAvailable) return '';
  if (media.pipBlock === 'audio') return i18n.t('pipUnavailableAudio');
  if (media.pipBlock === 'disabled') return i18n.t('pipDisabledBySite');
  return i18n.t('pipUnsupported');
}

const channelMessages = { stereo: 'channelStereo', mono: 'channelMono', left: 'channelLeft', right: 'channelRight' } as const;
export const channelLabel = (mode: ChannelMode) => i18n.t(channelMessages[mode]);

function pictureInPictureError(error: DOMException, readyState: number) {
  if (error.name === 'NotAllowedError') return i18n.t('pipNeedsGesture');
  if (error.name === 'NotSupportedError') return i18n.t('pipUnsupported');
  if (error.name === 'SecurityError') return i18n.t('pipDisabledBySite');
  if (error.name === 'InvalidStateError') return readyState < 1 ? i18n.t('pipNotReady') : i18n.t('pipFailed');
  return i18n.t('pipFailed');
}

export async function togglePictureInPicture(element: HTMLMediaElement) {
  if (element.localName !== 'video') throw new Error(i18n.t('pipUnavailableAudio'));
  const video = element as HTMLVideoElement;
  const doc = video.ownerDocument;
  if (typeof video.requestPictureInPicture !== 'function' || doc.pictureInPictureEnabled !== true) throw new Error(i18n.t('pipUnsupported'));
  if (video.disablePictureInPicture && doc.pictureInPictureElement !== video) throw new Error(i18n.t('pipDisabledBySite'));
  if (video.readyState < 1) throw new Error(i18n.t('pipNotReady'));
  try {
    if (doc.pictureInPictureElement === video) { await doc.exitPictureInPicture(); return; }
    await video.requestPictureInPicture();
  } catch (error) {
    if (error instanceof DOMException) throw new Error(pictureInPictureError(error, video.readyState));
    throw error instanceof Error ? error : new Error(i18n.t('pipFailed'));
  }
}

export function isMediaCommand(value: unknown): value is MediaCommand {
  if (!value || typeof value !== 'object') return false;
  const command = value as MediaCommand;
  if (command.type === 'play' || command.type === 'pause' || command.type === 'mute' || command.type === 'pip') return true;
  if (command.type === 'channel') return isChannelMode(command.value);
  if (!('value' in command) || !Number.isFinite(command.value)) return false;
  if (command.type === 'volume') return command.value >= 0 && command.value <= maxGain;
  if (command.type === 'rate') return command.value >= minRate && command.value <= maxRate;
  return ['seek', 'skip'].includes(command.type);
}

export async function applyMediaCommand(element: HTMLMediaElement, command: MediaCommand, amplifier?: Amplifier) {
  if (!isMediaCommand(command)) throw new Error(i18n.t('invalidMediaCommand'));
  if (command.type === 'play') { await element.play(); return; }
  if (command.type === 'pip') { await togglePictureInPicture(element); return; }
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
  if (command.type === 'channel') {
    if (command.value !== 'stereo' && !routable(element, amplifier)) throw new Error(i18n.t('channelCrossOrigin'));
    await amplifier?.setChannel(element, command.value);
    return;
  }
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

interface RateSlot { state: RateLockState; timer: number; listening: boolean; onEvent: () => void }

export function createMediaController(document: Document, onChange?: () => void, onRateLockGiveUp?: () => void) {
  let nextId = 0;
  const ids = new WeakMap<HTMLMediaElement, string>();
  let elements: HTMLMediaElement[] = [];
  let dirty = true;
  let lockOn = false;
  // Last non-1× speed for this document. Reset toggles back to it. Not written to storage.
  let recall: number | null = null;
  const seenRates = new WeakMap<HTMLMediaElement, number>();
  const slots = new Map<HTMLMediaElement, RateSlot>();
  const amplifier = createAmplifier(document.defaultView!);
  const flashed = new WeakMap<HTMLMediaElement, { token: number; outline: string; offset: string }>();
  let flashToken = 0;
  const onPip = () => onChange?.();
  document.addEventListener('enterpictureinpicture', onPip, true);
  document.addEventListener('leavepictureinpicture', onPip, true);
  const observers = new Map<Document | ShadowRoot, MutationObserver>();
  const observe = (root: Document | ShadowRoot) => {
    if (observers.has(root)) return;
    const observer = new document.defaultView!.MutationObserver(() => { dirty = true; onChange?.(); });
    observer.observe(root, { childList: true, subtree: true });
    observers.set(root, observer);
  };
  const clearTimer = (element: HTMLMediaElement, slot: RateSlot) => {
    if (!slot.timer) return;
    element.ownerDocument.defaultView?.clearTimeout(slot.timer);
    slot.timer = 0;
  };
  const noteSeen = (element: HTMLMediaElement, rate: number) => {
    const previous = seenRates.get(element);
    seenRates.set(element, rate);
    if (previous !== undefined && sameRate(previous, rate)) return;
    // A second element's first look must not replace a speed this page already remembered.
    if (previous === undefined && recall != null && recallableRate(rate) != null) return;
    recall = noteRecallRate(recall, rate);
  };
  const rateWatchers = new Set<HTMLMediaElement>();
  // Lock's listener only exists while lock is on, and it rewrites instead of remembering.
  // This one stays attached so a site can move off 1× and back between snapshots.
  const lockOwnsRate = (element: HTMLMediaElement) => {
    if (!lockOn) return false;
    const slot = slots.get(element);
    return !!slot && slot.state.desired != null && !slot.state.givenUp;
  };
  const onRateChange = (event: Event) => {
    const element = event.currentTarget as HTMLMediaElement;
    if (lockOwnsRate(element)) return;
    noteSeen(element, element.playbackRate);
  };
  const unwatchRate = (element: HTMLMediaElement) => {
    if (!rateWatchers.delete(element)) return;
    element.removeEventListener('ratechange', onRateChange);
  };
  const watchRate = (element: HTMLMediaElement) => {
    if (rateWatchers.has(element)) return;
    rateWatchers.add(element);
    element.addEventListener('ratechange', onRateChange);
  };
  const release = (element: HTMLMediaElement) => {
    const slot = slots.get(element);
    unwatchRate(element);
    if (!slot) return;
    clearTimer(element, slot);
    if (slot.listening) {
      element.removeEventListener('ratechange', slot.onEvent);
      element.removeEventListener('play', slot.onEvent);
      element.removeEventListener('seeked', slot.onEvent);
    }
    slots.delete(element);
  };
  const consider = (element: HTMLMediaElement) => {
    const slot = slots.get(element);
    if (!slot || !lockOn || !element.isConnected) return;
    const result = observePlaybackRate(slot.state, element.playbackRate, Date.now(), true);
    slot.state = result.state;
    if (result.decision.type === 'give-up') { onRateLockGiveUp?.(); return; }
    if (result.decision.type !== 'rewrite') return;
    const view = element.ownerDocument.defaultView;
    if (!view) { slot.state = { ...slot.state, pending: false }; return; }
    clearTimer(element, slot);
    const rate = result.decision.rate;
    slot.timer = view.setTimeout(() => {
      const current = slots.get(element);
      if (!current) return;
      current.timer = 0;
      if (!lockOn || !element.isConnected || current.state.givenUp || current.state.desired == null) return;
      if (Math.abs(element.playbackRate - rate) <= rateLockEpsilon) { current.state = { ...current.state, pending: false }; return; }
      current.state = armRateEcho(current.state);
      void applyMediaCommand(element, { type: 'rate', value: rate });
    }, result.decision.delayMs);
  };
  const listen = (element: HTMLMediaElement) => {
    let slot = slots.get(element);
    if (!slot) {
      slot = { state: createRateLockState(), timer: 0, listening: false, onEvent: () => consider(element) };
      slots.set(element, slot);
    }
    if (slot.listening) return;
    slot.listening = true;
    element.addEventListener('ratechange', slot.onEvent);
    element.addEventListener('play', slot.onEvent);
    element.addEventListener('seeked', slot.onEvent);
  };
  const unlisten = (element: HTMLMediaElement) => {
    const slot = slots.get(element);
    if (!slot?.listening) return;
    clearTimer(element, slot);
    slot.listening = false;
    slot.state = { ...slot.state, pending: false };
    element.removeEventListener('ratechange', slot.onEvent);
    element.removeEventListener('play', slot.onEvent);
    element.removeEventListener('seeked', slot.onEvent);
  };
  const rememberRate = (element: HTMLMediaElement, rate: number) => {
    let slot = slots.get(element);
    if (!slot) {
      slot = { state: createRateLockState(), timer: 0, listening: false, onEvent: () => consider(element) };
      slots.set(element, slot);
    }
    clearTimer(element, slot);
    slot.state = noteDesiredRate(slot.state, rate);
    if (lockOn) listen(element);
  };
  const refresh = () => {
    // shortcut: late Shadow Roots need an outer DOM mutation; add attachShadow tracking if target sites require it.
    if (!dirty) return;
    elements = discoverMedia(document, observe);
    dirty = false;
    for (const element of elements) watchRate(element);
    for (const [root, observer] of observers) if ('host' in root && !root.host.isConnected) { observer.disconnect(); observers.delete(root); }
    for (const element of slots.keys()) if (!element.isConnected) release(element);
    for (const element of [...rateWatchers]) if (!element.isConnected) unwatchRate(element);
  };
  const idOf = (element: HTMLMediaElement) => {
    if (!ids.has(element)) ids.set(element, String(++nextId));
    return ids.get(element)!;
  };
  return {
    snapshot() {
      refresh();
      if (lockOn) for (const element of elements) listen(element);
      return elements.map(element => {
        noteSeen(element, element.playbackRate);
        const snap = mediaSnapshot(element, idOf(element), document, amplifier);
        return slots.get(element)?.state.givenUp ? { ...snap, rateLock: 'given-up' as const } : snap;
      });
    },
    recallRate() { return recall; },
    /** Id of the media under the point, else of the focused media when `focus` is set. */
    pointed(point: { x: number; y: number } | null, focus: boolean) {
      refresh();
      const live = elements.filter(element => element.isConnected);
      const element = (point ? mediaAtPoint(live, point.x, point.y) : undefined) ?? (focus ? focusedMedia(live, document) : undefined);
      return element ? idOf(element) : undefined;
    },
    setLockRate(enabled: boolean) {
      if (lockOn === enabled) return;
      lockOn = enabled;
      if (!enabled) { for (const element of slots.keys()) unlisten(element); return; }
      for (const slot of slots.values()) slot.state = { ...slot.state, fights: 0, lastFightAt: 0, pending: false, givenUp: false };
      this.snapshot();
      for (const element of slots.keys()) if (element.isConnected) consider(element);
    },
    async command(id: string, command: MediaCommand) {
      const element = elements.find(media => ids.get(media) === id && media.isConnected);
      if (!element) throw new Error(i18n.t('mediaRemoved'));
      if (command.type === 'rate') {
        const leaving = recallableRate(element.playbackRate);
        if (leaving != null) recall = leaving;
        seenRates.set(element, element.playbackRate);
        rememberRate(element, command.value);
      }
      await applyMediaCommand(element, command, amplifier);
      if (command.type === 'rate') {
        const settled = await readSettledRate(element);
        noteSeen(element, settled);
        return settled;
      }
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
    destroy() {
      document.removeEventListener('enterpictureinpicture', onPip, true);
      document.removeEventListener('leavepictureinpicture', onPip, true);
      for (const observer of observers.values()) observer.disconnect();
      observers.clear();
      for (const element of [...slots.keys()]) release(element);
      for (const element of [...rateWatchers]) unwatchRate(element);
      amplifier.dispose();
    }
  };
}
