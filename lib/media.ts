import type { MediaCommand, MediaState } from './types';

export function discoverMedia(root: Document | ShadowRoot, onRoot?: (root: Document | ShadowRoot) => void): HTMLMediaElement[] {
  onRoot?.(root);
  const media = [...root.querySelectorAll<HTMLMediaElement>('audio,video')].filter(element => element.namespaceURI === 'http://www.w3.org/1999/xhtml');
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot && element.localName !== 'suibo-controller') media.push(...discoverMedia(element.shadowRoot, onRoot));
  }
  return media;
}

export function mediaSnapshot(element: HTMLMediaElement, id: string, document: Document): MediaState {
  const ranges = element.seekable;
  return {
    id, title: element.getAttribute('aria-label') || element.getAttribute('title') || document.title || '未命名媒体',
    host: new URL(document.URL).hostname,
    kind: element.localName === 'video' ? 'video' : 'audio',
    paused: element.paused, muted: element.muted, volume: element.volume, rate: element.playbackRate,
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
  if (command.type === 'volume') return command.value >= 0 && command.value <= 1;
  if (command.type === 'rate') return command.value >= 0.25 && command.value <= 4;
  return ['seek', 'skip'].includes(command.type);
}

export async function applyMediaCommand(element: HTMLMediaElement, command: MediaCommand) {
  if (!isMediaCommand(command)) throw new Error('无效的媒体控制指令。');
  if (command.type === 'play') { await element.play(); return; }
  if (command.type === 'pause') { element.pause(); return; }
  if (command.type === 'mute') { element.muted = !element.muted; return; }
  if (command.type === 'volume') { element.volume = command.value; if (command.value > 0) element.muted = false; return; }
  if (command.type === 'rate') { element.playbackRate = command.value; return; }
  if (!('value' in command)) throw new Error('无效的媒体控制指令。');
  const ranges = element.seekable;
  if (!ranges.length) throw new Error('当前媒体尚不可跳转，请等待加载。');
  const target = command.type === 'skip' ? element.currentTime + command.value : command.value;
  let closest = ranges.start(0);
  let distance = Infinity;
  for (let index = 0; index < ranges.length; index++) {
    const candidate = Math.max(ranges.start(index), Math.min(target, ranges.end(index)));
    if (Math.abs(target - candidate) < distance) { closest = candidate; distance = Math.abs(target - candidate); }
  }
  element.currentTime = closest;
}

export function createMediaController(document: Document) {
  let nextId = 0;
  const ids = new WeakMap<HTMLMediaElement, string>();
  let elements: HTMLMediaElement[] = [];
  let dirty = true;
  const observers = new Map<Document | ShadowRoot, MutationObserver>();
  const observe = (root: Document | ShadowRoot) => {
    if (observers.has(root)) return;
    const observer = new document.defaultView!.MutationObserver(() => { dirty = true; });
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
        return mediaSnapshot(element, ids.get(element)!, document);
      });
    },
    async command(id: string, command: MediaCommand) {
      const element = elements.find(media => ids.get(media) === id && media.isConnected);
      if (!element) throw new Error('媒体已移除，请重新选择。');
      await applyMediaCommand(element, command);
    },
    destroy() { for (const observer of observers.values()) observer.disconnect(); observers.clear(); }
  };
}
