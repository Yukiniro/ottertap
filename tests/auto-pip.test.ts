import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { autoPipCooldownMs, createAutoPip, shouldAutoPip } from '../lib/auto-pip';
import { createMediaController } from '../lib/media';
import { mergeSettingsChange, normalizeSettings } from '../lib/settings';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

function page() {
  const window = new Window({ url: 'https://example.com/watch' });
  const document = window.document as unknown as Document;
  let visibility: DocumentVisibilityState = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  let current: Element | null = null;
  Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, get: () => current });
  Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, get: () => true });
  const hide = () => { visibility = 'hidden'; document.dispatchEvent(new window.Event('visibilitychange') as unknown as Event); };
  const show = () => { visibility = 'visible'; document.dispatchEvent(new window.Event('visibilitychange') as unknown as Event); };
  const video = (options: { playing?: boolean; refuse?: boolean } = {}) => {
    const element = document.createElement('video');
    document.body.append(element);
    let paused = options.playing === false;
    Object.defineProperty(element, 'paused', { configurable: true, get: () => paused });
    Object.defineProperty(element, 'readyState', { configurable: true, value: 1 });
    const requests: number[] = [];
    Object.defineProperty(element, 'requestPictureInPicture', { configurable: true, value: async () => {
      requests.push(requests.length);
      if (options.refuse) throw new DOMException('needs a gesture', 'NotAllowedError');
      current = element;
      return {} as PictureInPictureWindow;
    } });
    const leave = () => { current = null; element.dispatchEvent(new window.Event('leavepictureinpicture', { bubbles: true }) as unknown as Event); };
    return { element, requests, leave, pause() { paused = true; } };
  };
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  return { window, document, hide, show, video, settle, get pip() { return current; } };
}

test('设置默认关，只认 true，并跟着导出导入和并发合并走', () => {
  assert.equal(defaultSettings.autoPipOnHide, false);
  assert.equal(normalizeSettings({}).autoPipOnHide, false);
  assert.equal(normalizeSettings({ autoPipOnHide: 'true' }).autoPipOnHide, false);
  assert.equal(normalizeSettings({ autoPipOnHide: true }).autoPipOnHide, true);
  const on = normalizeSettings({ autoPipOnHide: true, followPlaying: false });
  const parsed = parseSettingsBackup(serializeSettings(on, '1.8.0'));
  assert.equal(parsed.ok && parsed.settings.autoPipOnHide, true);
  const base = normalizeSettings({});
  const other = { ...base, lockRate: true };
  assert.deepEqual(mergeSettingsChange(other, base, { ...base, autoPipOnHide: true }), { ...other, autoPipOnHide: true });
});

test('只放行正在播放、可进画中画的视频', async () => {
  const { window, document, video } = page();
  try {
    const playing = video();
    const base = { enabled: true, element: playing.element, lastExitAt: null, now: 50_000 };
    assert.equal(shouldAutoPip(base), true);
    assert.equal(shouldAutoPip({ ...base, enabled: false }), false);
    assert.equal(shouldAutoPip({ ...base, element: undefined }), false);
    assert.equal(shouldAutoPip({ ...base, lastExitAt: 50_000 - autoPipCooldownMs + 1 }), false);
    assert.equal(shouldAutoPip({ ...base, lastExitAt: 50_000 - autoPipCooldownMs }), true);
    const paused = video({ playing: false });
    assert.equal(shouldAutoPip({ ...base, element: paused.element }), false);
    const audio = document.createElement('audio');
    Object.defineProperty(audio, 'paused', { value: false });
    document.body.append(audio);
    assert.equal(shouldAutoPip({ ...base, element: audio }), false);
    playing.element.disablePictureInPicture = true;
    assert.equal(shouldAutoPip(base), false);
    playing.element.disablePictureInPicture = false;
    Object.defineProperty(playing.element, 'readyState', { configurable: true, value: 0 });
    assert.equal(shouldAutoPip(base), false);
    Object.defineProperty(playing.element, 'readyState', { configurable: true, value: 1 });
    Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, get: () => paused.element });
    assert.equal(shouldAutoPip(base), false);
  } finally { await window.happyDOM.close(); }
});

test('开关关闭时切走标签什么都不做', async () => {
  const { window, document, hide, video, settle } = page();
  try {
    const playing = video();
    const auto = createAutoPip(document, { enabled: () => false, target: () => playing.element });
    auto.sync();
    hide();
    await settle();
    assert.equal(playing.requests.length, 0);
    auto.dispose();
  } finally { await window.happyDOM.close(); }
});

test('打开后，选中的播放中视频在标签隐藏时进入画中画；暂停时不进', async () => {
  const { window, document, hide, show, video, settle } = page();
  try {
    const playing = video();
    let target: HTMLMediaElement | undefined = playing.element;
    const auto = createAutoPip(document, { enabled: () => true, target: () => target });
    show();
    assert.equal(playing.requests.length, 0);
    hide();
    await settle();
    assert.equal(playing.requests.length, 1);
    assert.equal(document.pictureInPictureElement, playing.element);
    const paused = video({ playing: false });
    target = paused.element;
    playing.leave();
    hide();
    await settle();
    assert.equal(paused.requests.length, 0);
    target = undefined;
    hide();
    await settle();
    assert.equal(playing.requests.length, 1);
    auto.dispose();
  } finally { await window.happyDOM.close(); }
});

test('浏览器拒绝时不抛错，下次切走还会再试', async () => {
  const { window, document, hide, video, settle } = page();
  try {
    const refused = video({ refuse: true });
    const auto = createAutoPip(document, { enabled: () => true, target: () => refused.element });
    hide();
    await settle();
    hide();
    await settle();
    assert.equal(refused.requests.length, 2);
    assert.equal(document.pictureInPictureElement, null);
    auto.dispose();
  } finally { await window.happyDOM.close(); }
});

test('退出画中画后冷却期内不再自动进入，过了冷却期才进', async () => {
  const { window, document, hide, video, settle } = page();
  try {
    const playing = video();
    let clock = 1_000;
    const auto = createAutoPip(document, { enabled: () => true, target: () => playing.element, now: () => clock });
    hide();
    await settle();
    assert.equal(playing.requests.length, 1);
    playing.leave();
    clock += autoPipCooldownMs - 1;
    hide();
    await settle();
    assert.equal(playing.requests.length, 1);
    clock += 1;
    hide();
    await settle();
    assert.equal(playing.requests.length, 2);
    auto.dispose();
  } finally { await window.happyDOM.close(); }
});

test('Media Session 钩子跟着开关挂上和卸下，回调走同一道门槛', async () => {
  const { window, document, video, settle } = page();
  try {
    const handlers = new Map<string, (() => void) | null>();
    const calls: string[] = [];
    Object.defineProperty(window.navigator, 'mediaSession', { configurable: true, value: {
      setActionHandler(action: string, handler: (() => void) | null) { calls.push(`${action}:${handler ? 'on' : 'off'}`); handlers.set(action, handler); }
    } });
    const playing = video();
    let on = false;
    const auto = createAutoPip(document, { enabled: () => on, target: () => playing.element, mediaSession: true });
    auto.sync();
    assert.deepEqual(calls, []);
    on = true;
    auto.sync();
    auto.sync();
    assert.deepEqual(calls, ['enterpictureinpicture:on']);
    handlers.get('enterpictureinpicture')?.();
    await settle();
    assert.equal(playing.requests.length, 1);
    playing.leave();
    handlers.get('enterpictureinpicture')?.();
    await settle();
    assert.equal(playing.requests.length, 1);
    on = false;
    auto.sync();
    assert.deepEqual(calls, ['enterpictureinpicture:on', 'enterpictureinpicture:off']);
    on = true;
    auto.sync();
    auto.dispose();
    assert.deepEqual(calls.slice(-2), ['enterpictureinpicture:on', 'enterpictureinpicture:off']);
  } finally { await window.happyDOM.close(); }
});

test('不认识 enterpictureinpicture 的浏览器里挂钩失败也不影响隐藏标签这条路', async () => {
  const { window, document, hide, video, settle } = page();
  try {
    Object.defineProperty(window.navigator, 'mediaSession', { configurable: true, value: {
      setActionHandler() { throw new TypeError('unknown action'); }
    } });
    const playing = video();
    const auto = createAutoPip(document, { enabled: () => true, target: () => playing.element, mediaSession: true });
    assert.doesNotThrow(() => auto.sync());
    hide();
    await settle();
    assert.equal(playing.requests.length, 1);
    assert.doesNotThrow(() => auto.dispose());
  } finally { await window.happyDOM.close(); }
});

test('控制器按本帧 id 取回选中的媒体元素', async () => {
  const { window, document } = page();
  try {
    const first = document.createElement('video');
    const second = document.createElement('video');
    document.body.append(first, second);
    const controller = createMediaController(document);
    const [a, b] = controller.snapshot();
    assert.equal(controller.element(a!.id), first);
    assert.equal(controller.element(b!.id), second);
    second.remove();
    assert.equal(controller.element(b!.id), undefined);
    assert.equal(controller.element('999'), undefined);
    controller.destroy();
  } finally { await window.happyDOM.close(); }
});

test('设置页「播放」里的自动画中画开关默认关，并且单独保存', async () => {
  const window = new Window({ url: 'https://example.com/options' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { SettingsPage } = await import('../components/settings-page');
  let value: Settings = { ...defaultSettings, theme: 'light' };
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
    const playback = host.querySelector('#playback');
    assert.match(playback?.textContent ?? '', /切到其他标签时自动进入画中画/);
    assert.match(playback?.textContent ?? '', /默认关闭/);
    const toggle = playback?.querySelector('[role="switch"][aria-label="切到其他标签时自动进入画中画"]');
    assert.ok(toggle);
    assert.equal(toggle.getAttribute('aria-checked'), 'false');
    await act(async () => { (toggle as unknown as { click(): void }).click(); });
    assert.equal(value.autoPipOnHide, true);
    assert.equal(value.followPlaying, true);
    assert.equal(toggle.getAttribute('aria-checked'), 'true');
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
