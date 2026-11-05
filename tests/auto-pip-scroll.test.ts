import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { autoPipCooldownMs } from '../lib/auto-pip';
import { createScrollPip, scrollInShare, scrollOutShare, visibleShare } from '../lib/auto-pip-scroll';
import { mergeSettingsChange, normalizeSettings } from '../lib/settings';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

type Size = { width: number; height: number };

function page() {
  const window = new Window({ url: 'https://example.com/watch', width: 1280, height: 720 });
  const document = window.document as unknown as Document;
  let current: Element | null = null;
  Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, get: () => current });
  Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, get: () => true });
  const observers: FakeObserver[] = [];
  class FakeObserver {
    observed = new Set<Element>();
    disconnected = false;
    constructor(readonly callback: (entries: IntersectionObserverEntry[]) => void) { observers.push(this); }
    observe(element: Element) { this.observed.add(element); }
    unobserve(element: Element) { this.observed.delete(element); }
    disconnect() { this.observed.clear(); this.disconnected = true; }
  }
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: FakeObserver });
  const live = () => observers.find(observer => !observer.disconnected);
  /** Reports `share` of `size` as visible, the way the browser would after a scroll. */
  const scroll = (element: Element, share: number, size: Size = { width: 640, height: 360 }) => {
    const observer = live();
    if (!observer?.observed.has(element)) return false;
    observer.callback([{ target: element, boundingClientRect: size, intersectionRect: { width: size.width, height: size.height * share }, intersectionRatio: share, isIntersecting: share > 0 } as unknown as IntersectionObserverEntry]);
    return true;
  };
  const video = (options: { playing?: boolean; refuse?: () => boolean } = {}) => {
    const element = document.createElement('video');
    document.body.append(element);
    let paused = options.playing === false;
    Object.defineProperty(element, 'paused', { configurable: true, get: () => paused });
    Object.defineProperty(element, 'readyState', { configurable: true, value: 1 });
    const requests: number[] = [];
    Object.defineProperty(element, 'requestPictureInPicture', { configurable: true, value: async () => {
      requests.push(requests.length);
      if (options.refuse?.()) throw new DOMException('needs a gesture', 'NotAllowedError');
      current = element;
      return {} as PictureInPictureWindow;
    } });
    const leave = () => { current = null; element.dispatchEvent(new window.Event('leavepictureinpicture', { bubbles: true }) as unknown as Event); };
    const play = () => { paused = false; element.dispatchEvent(new window.Event('play') as unknown as Event); };
    return { element, requests, leave, play, pause() { paused = true; } };
  };
  const press = () => window.dispatchEvent(new window.Event('pointerup'));
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  return { window, document, observers, live, scroll, video, press, settle };
}

test('设置默认关，只认 true，导出导入和并发合并带上，且与切走开关互不牵连', () => {
  assert.equal(defaultSettings.autoPipOnScroll, false);
  assert.equal(normalizeSettings({}).autoPipOnScroll, false);
  assert.equal(normalizeSettings({ autoPipOnScroll: 'true' }).autoPipOnScroll, false);
  assert.equal(normalizeSettings({ autoPipOnScroll: true }).autoPipOnScroll, true);
  assert.equal(normalizeSettings({ autoPipOnScroll: true }).autoPipOnHide, false);
  assert.equal(normalizeSettings({ autoPipOnHide: true }).autoPipOnScroll, false);
  const on = normalizeSettings({ autoPipOnScroll: true });
  const parsed = parseSettingsBackup(serializeSettings(on, '1.8.0'));
  assert.equal(parsed.ok && parsed.settings.autoPipOnScroll, true);
  assert.equal(parsed.ok && parsed.settings.autoPipOnHide, false);
  const base = normalizeSettings({});
  const other = { ...base, autoPipOnHide: true };
  assert.deepEqual(mergeSettingsChange(other, base, { ...base, autoPipOnScroll: true }), { ...other, autoPipOnScroll: true });
});

test('可见比例按视口能显示的部分算，比视口还高的播放器也能算满', () => {
  const viewport = { width: 1280, height: 720 };
  assert.equal(visibleShare({ width: 640, height: 360 }, { width: 640, height: 360 }, viewport), 1);
  assert.equal(visibleShare({ width: 640, height: 360 }, { width: 640, height: 36 }, viewport), 0.1);
  assert.equal(visibleShare({ width: 1280, height: 1440 }, { width: 1280, height: 720 }, viewport), 1);
  assert.equal(visibleShare({ width: 0, height: 0 }, { width: 0, height: 0 }, viewport), 0);
  assert.ok(scrollOutShare < scrollInShare);
});

test('开关关闭时不建观察器，也不进画中画', async () => {
  const { window, document, observers, video, press, settle } = page();
  try {
    const main = video();
    const auto = createScrollPip(document, { enabled: () => false, target: () => main.element });
    auto.sync();
    press();
    await settle();
    assert.equal(observers.length, 0);
    assert.equal(main.requests.length, 0);
    auto.dispose();
  } finally { await window.happyDOM.close(); }
});

test('主视频在播放中滚到几乎看不见时进入一次，微小抖动不反复进', async () => {
  const { window, document, scroll, video, settle } = page();
  try {
    const main = video();
    const auto = createScrollPip(document, { enabled: () => true, target: () => main.element });
    auto.sync();
    assert.ok(scroll(main.element, 1));
    scroll(main.element, 0.3);
    await settle();
    assert.equal(main.requests.length, 0, '评论区往下滚一点不算滚出');
    scroll(main.element, 0.05);
    await settle();
    assert.equal(main.requests.length, 1);
    assert.equal(document.pictureInPictureElement, main.element);
    scroll(main.element, 0.15);
    scroll(main.element, 0.05);
    scroll(main.element, 0.4);
    scroll(main.element, 0);
    await settle();
    assert.equal(main.requests.length, 1, '没滚回视口前不再请求');
    auto.dispose();
  } finally { await window.happyDOM.close(); }
});

test('信息流小卡片、开局就在视口外的视频、音频和未选中的媒体都不触发', async () => {
  const { window, document, live, scroll, video, settle } = page();
  try {
    const card = video();
    const main = video();
    let target: HTMLMediaElement = card.element;
    const auto = createScrollPip(document, { enabled: () => true, target: () => target });
    auto.sync();
    scroll(card.element, 1, { width: 240, height: 135 });
    scroll(card.element, 0, { width: 240, height: 135 });
    await settle();
    assert.equal(card.requests.length, 0, '小卡片不算主画面');
    assert.equal(scroll(main.element, 0), false, '未选中的媒体不被观察');

    target = main.element;
    auto.sync();
    assert.deepEqual([...live()!.observed], [main.element]);
    scroll(main.element, 0);
    await settle();
    assert.equal(main.requests.length, 0, '没在视口里见过的视频不算滚出');
    scroll(main.element, 0.8);
    scroll(main.element, 0.1);
    await settle();
    assert.equal(main.requests.length, 1);

    const audio = document.createElement('audio');
    document.body.append(audio);
    target = audio;
    auto.sync();
    assert.equal(live(), undefined, '音频不建观察器');
    auto.dispose();
  } finally { await window.happyDOM.close(); }
});

test('暂停时滚出不进，滚出后开始播放再进', async () => {
  const { window, document, scroll, video, settle } = page();
  try {
    const main = video({ playing: false });
    const auto = createScrollPip(document, { enabled: () => true, target: () => main.element });
    auto.sync();
    scroll(main.element, 1);
    scroll(main.element, 0);
    await settle();
    assert.equal(main.requests.length, 0);
    main.play();
    await settle();
    assert.equal(main.requests.length, 1);
    auto.dispose();
  } finally { await window.happyDOM.close(); }
});

test('浏览器拒绝后进入失败冷却，冷却期内点击不再试', async () => {
  const { window, document, scroll, video, press, settle } = page();
  try {
    let clock = 1_000;
    let refuse = true;
    const main = video({ refuse: () => refuse });
    const auto = createScrollPip(document, { enabled: () => true, target: () => main.element, now: () => clock });
    auto.sync();
    scroll(main.element, 1);
    scroll(main.element, 0);
    await settle();
    assert.equal(main.requests.length, 1);
    assert.equal(document.pictureInPictureElement, null);
    refuse = false;
    press();
    await settle();
    assert.equal(main.requests.length, 1, '失败冷却期内点击不再请求');
    clock += autoPipCooldownMs;
    press();
    await settle();
    assert.equal(main.requests.length, 2);
    assert.equal(document.pictureInPictureElement, main.element);
    auto.dispose();
  } finally { await window.happyDOM.close(); }
});

test('滚出时关掉画中画，要滚回来再滚出才会再进，且仍守冷却', async () => {
  const { window, document, scroll, video, press, settle } = page();
  try {
    const main = video();
    let clock = 1_000;
    const auto = createScrollPip(document, { enabled: () => true, target: () => main.element, now: () => clock });
    auto.sync();
    scroll(main.element, 1);
    scroll(main.element, 0);
    await settle();
    assert.equal(main.requests.length, 1);
    main.leave();
    clock += autoPipCooldownMs + 1;
    press();
    scroll(main.element, 0.05);
    await settle();
    assert.equal(main.requests.length, 1, '关掉后还在视口外，不再进');

    scroll(main.element, 0.6);
    scroll(main.element, 0);
    await settle();
    assert.equal(main.requests.length, 2, '滚回来再滚出又会进');
    scroll(main.element, 0.6);
    main.leave();
    scroll(main.element, 0);
    await settle();
    assert.equal(main.requests.length, 2, '在视口里关掉后马上滚出，冷却期内不进');
    clock += autoPipCooldownMs;
    press();
    await settle();
    assert.equal(main.requests.length, 3, '冷却过后仍在视口外，点一下就进');
    auto.dispose();
  } finally { await window.happyDOM.close(); }
});

test('全屏（含网页全屏）时不进，退出全屏后再按规则进', async () => {
  const { window, document, scroll, video, settle } = page();
  try {
    const main = video();
    const other = document.createElement('div');
    document.body.append(other);
    let fullscreen: Element | null = other;
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreen });
    const auto = createScrollPip(document, { enabled: () => true, target: () => main.element });
    auto.sync();
    scroll(main.element, 1);
    scroll(main.element, 0);
    await settle();
    assert.equal(main.requests.length, 0);
    fullscreen = null;
    other.className = 'bpx-state-web-fullscreen';
    document.dispatchEvent(new window.Event('fullscreenchange') as unknown as Event);
    await settle();
    assert.equal(main.requests.length, 0, '可靠识别的网页全屏也不进');
    other.className = '';
    document.dispatchEvent(new window.Event('fullscreenchange') as unknown as Event);
    await settle();
    assert.equal(main.requests.length, 1);
    auto.dispose();
  } finally { await window.happyDOM.close(); }
});

test('关掉开关或释放后撤下观察器和监听', async () => {
  const { window, document, observers, scroll, video, press, settle } = page();
  try {
    const main = video({ refuse: () => true });
    let on = true;
    const auto = createScrollPip(document, { enabled: () => on, target: () => main.element });
    auto.sync();
    scroll(main.element, 1);
    scroll(main.element, 0);
    await settle();
    assert.equal(main.requests.length, 1);
    on = false;
    auto.sync();
    assert.equal(observers[0]!.disconnected, true);
    press();
    await settle();
    assert.equal(main.requests.length, 1, '关掉后点击不再请求');
    on = true;
    auto.sync();
    assert.equal(observers.length, 2);
    auto.dispose();
    assert.equal(observers[1]!.disconnected, true);
  } finally { await window.happyDOM.close(); }
});

test('设置页「播放」里的滚出自动画中画开关默认关，并且单独保存', async () => {
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
    assert.match(playback?.textContent ?? '', /主视频滚出视口时自动进入画中画/);
    const toggle = playback?.querySelector('[role="switch"][aria-label="主视频滚出视口时自动进入画中画"]');
    assert.ok(toggle);
    assert.equal(toggle.getAttribute('aria-checked'), 'false');
    await act(async () => { (toggle as unknown as { click(): void }).click(); });
    assert.equal(value.autoPipOnScroll, true);
    assert.equal(value.autoPipOnHide, false);
    assert.equal(toggle.getAttribute('aria-checked'), 'true');
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
