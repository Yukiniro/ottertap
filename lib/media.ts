import { i18n } from '#i18n';
import { canAmplify, createAmplifier, isChannelMode, maxGain, splitVolume, type Amplifier } from './amplifier';
import { armRateEcho, createRateLockState, noteDesiredRate, observePlaybackRate, rateLockEpsilon, type RateLockState } from './rate-lock';
import { assignedRateAttribute, assignedRateEvent, installAssignedRateHook } from './assigned-rate';
import { clampRate, maxRate, minRate, noteRecallRate, readSettledRate, recallableRate, sameRate } from './rate';
import type { ChannelMode, MediaCommand, MediaState } from './types';
import { adjacentFrameTime, frameStepSeconds, stopAllPresentedFrames, stopPresentedFrames, watchPresentedFrames } from './frame';
import { isHorizontallyMirrored, setHorizontalMirror } from './mirror';
import { clearSelectionRings, showSelectionRing } from './selection-ring';

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

/**
 * The neighbor in the list's current order, wrapping around.
 * The list is the live page order. An id that is not in it is not a place to stand, and one item cannot move.
 */
export function cycleMediaId(media: readonly { id: string }[], selectedId: string, direction: 1 | -1): string | null {
  if (media.length < 2) return null;
  const index = media.findIndex(item => item.id === selectedId);
  if (index < 0) return null;
  const next = (index + direction + media.length) % media.length;
  const id = media[next]?.id;
  return id && id !== selectedId ? id : null;
}

type HoverMedia = Pick<MediaState, 'id' | 'paused' | 'muted' | 'volume'>;

const audiblePlayback = (item: HoverMedia) => !item.paused && !item.muted && item.volume > 0;

/**
 * Bare hover-wheel follows this id.
 * An audible lock wins. Otherwise the audible player (`!paused && !muted && volume > 0`).
 * One player on the page still qualifies when it is not a muted playback, so a paused watch page keeps the wheel.
 * A muted preview does not, even when it is playing or was auto-selected.
 */
export function hoverPrimaryId(media: readonly HoverMedia[], selectedId = '') {
  const locked = selectedId ? media.find(item => item.id === selectedId) : undefined;
  if (locked && audiblePlayback(locked)) return locked.id;
  const audible = media.find(audiblePlayback);
  if (audible) return audible.id;
  if (media.length !== 1) return undefined;
  const only = media[0];
  if (!only || (!only.paused && only.muted)) return undefined;
  return only.id;
}

/** Pointed id when it is the hover primary. */
export function hoverWheelTarget(pointedId: string | undefined, media: readonly HoverMedia[], selectedId = '') {
  if (!pointedId) return undefined;
  return hoverPrimaryId(media, selectedId) === pointedId ? pointedId : undefined;
}

/**
 * Bare hover-wheel needs a main stage: both sides at least a third of the viewport.
 * A feed card is about a fifth, so the page keeps scrolling there.
 */
export function isMainStageSize(rect: { width: number; height: number }, viewport: { width: number; height: number }) {
  if (!(viewport.width > 0) || !(viewport.height > 0)) return false;
  return rect.width * 3 >= viewport.width && rect.height * 3 >= viewport.height;
}

type StageView = { innerWidth: number; innerHeight: number; top: StageView | null };

/** Top viewport when it is readable. A same-origin embed is judged against the page, not the frame. */
export function stageViewport(view: StageView | null | undefined) {
  if (!view) return { width: 0, height: 0 };
  try {
    const top = view.top;
    if (top) return { width: top.innerWidth, height: top.innerHeight };
  } catch { /* A cross-origin frame cannot read the top viewport. */ }
  return { width: view.innerWidth, height: view.innerHeight };
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

/** Filename stem only. Signed query strings and blob or data addresses stay out of the panel. */
export function mediaFileName(src: string) {
  const trimmed = src.trim();
  if (!trimmed || /^(?:blob|data):/i.test(trimmed)) return '';
  let segment = '';
  try { segment = new URL(trimmed, 'https://media.invalid').pathname.split('/').filter(Boolean).pop() ?? ''; }
  catch { return ''; }
  try { segment = decodeURIComponent(segment); }
  catch { /* keep the encoded segment */ }
  const stem = segment.replace(/\.[a-z0-9]{1,8}$/i, '');
  const text = (stem || segment).trim();
  if (!text || text === '.' || text === '..') return '';
  return text.length > 48 ? `${text.slice(0, 47)}…` : text;
}

/** Short list name: the element's own name, else the filename, else "Video 2". Not the page title. */
export function mediaListLabel(media: Pick<MediaState, 'kind' | 'label'> & { file?: string }, index: number) {
  const named = media.label.trim();
  if (named) return named;
  const file = media.file?.trim() ?? '';
  if (file) return file;
  const kind = media.kind === 'video' ? i18n.t('video') : i18n.t('audio');
  return i18n.t('mediaListFallback', { kind, n: index + 1 });
}

/** A blob or data currentSrc hides a filename that is still on the attribute. */
function mediaAddress(element: HTMLMediaElement) {
  const current = element.currentSrc || '';
  if (current && !/^(?:blob|data):/i.test(current)) return current;
  return element.getAttribute('src')?.trim() || '';
}

export function mediaSnapshot(element: HTMLMediaElement, id: string, document: Document, amplifier?: Amplifier): MediaState {
  const ranges = element.seekable;
  const label = element.getAttribute('aria-label')?.trim() || element.getAttribute('title')?.trim() || '';
  return {
    id, label, file: mediaFileName(mediaAddress(element)), title: label || document.title || i18n.t('unnamedMedia'),
    host: new URL(document.URL).hostname,
    kind: element.localName === 'video' ? 'video' : 'audio',
    paused: element.paused, muted: element.muted, volume: element.volume * (amplifier?.gain(element) ?? 1), maxVolume: maxVolume(element, amplifier), rate: element.playbackRate,
    currentTime: Number.isFinite(element.currentTime) ? element.currentTime : 0,
    duration: Number.isFinite(element.duration) ? element.duration : null,
    live: element.duration === Infinity,
    seekable: Array.from({ length: ranges.length }, (_, index) => ({ start: ranges.start(index), end: ranges.end(index) })),
    ...pipFields(element, document),
    channel: amplifier?.channel(element) ?? 'stereo',
    channelAvailable: routable(element, amplifier),
    mirrored: isHorizontallyMirrored(element),
    ...progressMarkField(element)
  };
}

/** One timestamp per element for this document. It leaves with the element, and it is not settings. */
const progressMarks = new WeakMap<HTMLMediaElement, number>();

function progressMarkField(element: HTMLMediaElement): { mark: number } | Record<string, never> {
  const mark = progressMarks.get(element);
  return typeof mark === 'number' && Number.isFinite(mark) ? { mark } : {};
}

export function pipFields(element: HTMLMediaElement, document: Document): Pick<MediaState, 'pip' | 'pipAvailable' | 'pipBlock'> {
  if (element.localName !== 'video') return { pip: false, pipAvailable: false, pipBlock: 'audio' };
  const video = element as HTMLVideoElement;
  const pip = (video.getRootNode() as Document | ShadowRoot).pictureInPictureElement === video;
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

const pipFailureKeys = ['pipUnavailableAudio', 'pipDisabledBySite', 'pipUnsupported', 'pipNeedsGesture', 'pipNotReady', 'pipFailed'] as const;
export type PipFailureKey = (typeof pipFailureKeys)[number];

export function isPipFailureKey(key: string): key is PipFailureKey {
  return (pipFailureKeys as readonly string[]).includes(key);
}

export function pipFailureKey(message: string): PipFailureKey | '' {
  for (const key of pipFailureKeys) if (i18n.t(key) === message) return key;
  return '';
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
  const pip = (video.getRootNode() as Document | ShadowRoot).pictureInPictureElement === video;
  if (video.disablePictureInPicture && !pip) throw new Error(i18n.t('pipDisabledBySite'));
  if (video.readyState < 1) throw new Error(i18n.t('pipNotReady'));
  try {
    if (pip) { await doc.exitPictureInPicture(); return; }
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
  if (command.type === 'mirror') return typeof command.value === 'boolean';
  if (command.type === 'frame') return command.direction === 1 || command.direction === -1;
  if (command.type === 'mark') return command.action === 'set' || command.action === 'jump' || command.action === 'clear';
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
  if (command.type === 'mirror') { setHorizontalMirror(element, command.value); return; }
  if (command.type === 'mark') {
    if (!elementCanStepFrames(element)) throw new Error(i18n.t('markUnavailable'));
    if (command.action === 'clear') { progressMarks.delete(element); return; }
    if (command.action === 'set') {
      progressMarks.set(element, Number.isFinite(element.currentTime) ? element.currentTime : 0);
      return;
    }
    const saved = progressMarks.get(element);
    if (typeof saved !== 'number' || !Number.isFinite(saved)) throw new Error(i18n.t('markMissing'));
    seekWithin(element, saved);
    return;
  }
  if (command.type === 'frame') {
    if (!elementCanStepFrames(element)) throw new Error(i18n.t('frameStepUnavailable'));
    if (!element.paused) element.pause();
    const current = Number.isFinite(element.currentTime) ? element.currentTime : 0;
    seekWithin(element, adjacentFrameTime(current, command.direction, frameStepSeconds(element)));
    return;
  }
  if (!('value' in command)) throw new Error(i18n.t('invalidMediaCommand'));
  seekWithin(element, command.type === 'skip' ? element.currentTime + command.value : command.value);
}

function elementCanStepFrames(element: HTMLMediaElement) {
  if (element.duration === Infinity) return false;
  const ranges = element.seekable;
  if (!ranges.length) return false;
  const start = ranges.start(0);
  const end = ranges.end(ranges.length - 1);
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

function seekWithin(element: HTMLMediaElement, target: number) {
  const ranges = element.seekable;
  if (!ranges.length) throw new Error(i18n.t('cannotSeek'));
  let closest = ranges.start(0);
  let distance = Infinity;
  for (let index = 0; index < ranges.length; index++) {
    const candidate = Math.max(ranges.start(index), Math.min(target, ranges.end(index)));
    const gap = Math.abs(target - candidate);
    if (gap < distance) { closest = candidate; distance = gap; }
  }
  element.currentTime = closest;
}

export function frameFailureKey(message: string): 'frameStepUnavailable' | '' {
  return message === i18n.t('frameStepUnavailable') ? 'frameStepUnavailable' : '';
}

const mirrorMarkFailureKeys = ['mirrorUnavailableAudio', 'markUnavailable', 'markMissing', 'cannotSeek'] as const;
export type MirrorMarkFailureKey = (typeof mirrorMarkFailureKeys)[number];

/** Map a rejected mirror or mark command back to the existing short explanation. */
export function mirrorMarkFailureKey(message: string): MirrorMarkFailureKey | '' {
  for (const key of mirrorMarkFailureKeys) if (message === i18n.t(key)) return key;
  return '';
}

interface RateSlot { state: RateLockState; timer: number; listening: boolean; onEvent: () => void }

export function createMediaController(document: Document, onChange?: () => void, onRateLockGiveUp?: () => void, onPlaying?: (localId: string) => void) {
  let nextId = 0;
  const ids = new WeakMap<HTMLMediaElement, string>();
  let elements: HTMLMediaElement[] = [];
  let dirty = true;
  let lockOn = false;
  // Last non-1× speed for this document. Reset toggles back to it. Not written to storage.
  let recall: number | null = null;
  const seenRates = new WeakMap<HTMLMediaElement, number>();
  const slots = new Map<HTMLMediaElement, RateSlot>();
  const holds = new Map<HTMLMediaElement, { target: number; lock: RateLockState | null }>();
  const view = document.defaultView!;
  installAssignedRateHook(view);
  const amplifier = createAmplifier(view);
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
  // The setter publishes the value it just wrote. ratechange is queued, so a
  // burst is already back at the final rate by the time that event runs.
  const onAssigned = (event: Event) => {
    const element = event.currentTarget as HTMLMediaElement;
    if (holds.has(element) || lockOwnsRate(element)) return;
    const raw = element.getAttribute(assignedRateAttribute);
    if (raw == null) return;
    const rate = Number(raw);
    if (!Number.isFinite(rate)) return;
    noteSeen(element, rate);
  };
  const onRateChange = (event: Event) => {
    const element = event.currentTarget as HTMLMediaElement;
    if (holds.has(element) || lockOwnsRate(element)) return;
    noteSeen(element, element.playbackRate);
  };
  const unwatchRate = (element: HTMLMediaElement) => {
    if (!rateWatchers.delete(element)) return;
    element.removeEventListener('ratechange', onRateChange);
    element.removeEventListener(assignedRateEvent, onAssigned);
  };
  const watchRate = (element: HTMLMediaElement) => {
    if (rateWatchers.has(element)) return;
    rateWatchers.add(element);
    element.addEventListener('ratechange', onRateChange);
    element.addEventListener(assignedRateEvent, onAssigned);
  };
  const release = (element: HTMLMediaElement) => {
    const slot = slots.get(element);
    unwatchRate(element);
    holds.delete(element);
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
  const idOf = (element: HTMLMediaElement) => {
    if (!ids.has(element)) ids.set(element, String(++nextId));
    return ids.get(element)!;
  };
  const playWatchers = new Set<HTMLMediaElement>();
  const onElementPlay = (event: Event) => {
    const element = event.currentTarget as HTMLMediaElement | null;
    if (!element?.isConnected) return;
    onPlaying?.(idOf(element));
  };
  const unwatchPlay = (element: HTMLMediaElement) => {
    if (!playWatchers.delete(element)) return;
    element.removeEventListener('play', onElementPlay);
  };
  const watchPlay = (element: HTMLMediaElement) => {
    if (!onPlaying || playWatchers.has(element)) return;
    playWatchers.add(element);
    element.addEventListener('play', onElementPlay);
  };
  const refresh = () => {
    // shortcut: late Shadow Roots need an outer DOM mutation; add attachShadow tracking if target sites require it.
    if (!dirty) return;
    elements = discoverMedia(document, observe);
    dirty = false;
    for (const element of elements) { watchRate(element); watchPlay(element); }
    for (const [root, observer] of observers) if ('host' in root && !root.host.isConnected) { observer.disconnect(); observers.delete(root); }
    for (const element of slots.keys()) if (!element.isConnected) release(element);
    for (const element of [...rateWatchers]) if (!element.isConnected) unwatchRate(element);
    for (const element of [...playWatchers]) if (!element.isConnected) unwatchPlay(element);
  };
  return {
    snapshot() {
      refresh();
      if (lockOn) for (const element of elements) listen(element);
      for (const element of elements) {
        if (element.paused) stopPresentedFrames(element);
        else watchPresentedFrames(element);
      }
      return elements.filter(element => element.isConnected).map(element => {
        if (!holds.has(element)) noteSeen(element, element.playbackRate);
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
    /** Primary under the point, and whether that element is large enough for a bare hover-wheel. */
    hoverAt(point: { x: number; y: number }, selectedLocalId = '') {
      refresh();
      const live = elements.filter(element => element.isConnected);
      const hit = mediaAtPoint(live, point.x, point.y);
      if (!hit) return undefined;
      const states = live.map(element => ({
        id: idOf(element),
        paused: element.paused,
        muted: element.muted,
        volume: element.volume * amplifier.gain(element),
      }));
      const id = hoverWheelTarget(idOf(hit), states, selectedLocalId);
      if (!id) return undefined;
      return { id, stage: isMainStageSize(hit.getBoundingClientRect(), stageViewport(document.defaultView)) };
    },
    /** Hover-wheel target: the element under the point, and only when it is the primary media. */
    hoverTarget(point: { x: number; y: number }, selectedLocalId = '') {
      return this.hoverAt(point, selectedLocalId)?.id;
    },
    /** Bare hover-wheel: the primary under the point, and only when it covers the main stage. */
    bareHoverTarget(point: { x: number; y: number }, selectedLocalId = '') {
      const hit = this.hoverAt(point, selectedLocalId);
      return hit?.stage ? hit.id : undefined;
    },
    /** Apply a temporary speed without changing recall or the lock's saved target. */
    beginHold(id: string, rate: number) {
      if (!Number.isFinite(rate)) return false;
      const element = elements.find(media => ids.get(media) === id && media.isConnected);
      if (!element) return false;
      if (holds.has(element)) return true;
      const next = clampRate(rate);
      const slot = slots.get(element);
      const defending = !!(lockOn && slot && slot.state.desired != null && !slot.state.givenUp);
      const target = defending ? slot!.state.desired! : element.playbackRate;
      holds.set(element, { target, lock: defending ? slot!.state : null });
      if (defending && slot) {
        clearTimer(element, slot);
        slot.state = noteDesiredRate(slot.state, next);
        listen(element);
      }
      element.playbackRate = next;
      return true;
    },
    /** Restore the speed from before the hold. With lock on, that is the lock target. */
    endHold(id: string) {
      const element = elements.find(media => ids.get(media) === id && media.isConnected);
      if (!element) return false;
      const held = holds.get(element);
      if (!held) return false;
      holds.delete(element);
      const slot = slots.get(element);
      if (held.lock && slot) {
        clearTimer(element, slot);
        slot.state = noteDesiredRate(slot.state, held.target);
      }
      element.playbackRate = held.target;
      return true;
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
    /** Brief ring on a video. Audio has no picture, so it only clears any ring in this frame. */
    flash(id: string) {
      this.snapshot();
      const element = elements.find(media => ids.get(media) === id && media.isConnected);
      if (!element) return '';
      if (element.localName !== 'video') {
        clearSelectionRings();
        return 'audio' as const;
      }
      showSelectionRing(element);
      return 'video' as const;
    },
    clearSelectionRing() { clearSelectionRings(); },
    destroy() {
      document.removeEventListener('enterpictureinpicture', onPip, true);
      document.removeEventListener('leavepictureinpicture', onPip, true);
      for (const observer of observers.values()) observer.disconnect();
      observers.clear();
      for (const element of [...slots.keys()]) release(element);
      for (const element of [...rateWatchers]) unwatchRate(element);
      for (const element of [...playWatchers]) unwatchPlay(element);
      clearSelectionRings();
      stopAllPresentedFrames();
      amplifier.dispose();
    }
  };
}
