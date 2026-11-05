import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { createAutoPip } from '../lib/auto-pip';
import { createAutoPipExit } from '../lib/auto-pip-exit';
import { createScrollPip } from '../lib/auto-pip-scroll';
import { mergeSettingsChange, normalizeSettings } from '../lib/settings';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

const delayMs = 30;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function page() {
  const window = new Window({ url: 'https://example.com/watch', width: 1280, height: 720 });
  const document = window.document as unknown as Document;
  let current: Element | null = null;
  let visibility: DocumentVisibilityState = 'visible';
  const exits: Element[] = [];
  Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, get: () => current });
  Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, get: () => true });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  const leave = () => {
    const element = current;
    if (!element) return;
    current = null;
    element.dispatchEvent(new window.Event('leavepictureinpicture', { bubbles: true }) as unknown as Event);
  };
  Object.defineProperty(document, 'exitPictureInPicture', { configurable: true, value: async () => {
    if (!current) throw new DOMException('not in picture-in-picture', 'InvalidStateError');
    exits.push(current);
    leave();
  } });
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
  /** Reports `share` of the player as visible to every observer watching it, the way the browser would after a scroll. */
  const scroll = (element: Element, share: number) => {
    const size = { width: 640, height: 360 };
    const entry = { target: element, boundingClientRect: size, intersectionRect: { width: size.width, height: size.height * share }, intersectionRatio: share, isIntersecting: share > 0 } as unknown as IntersectionObserverEntry;
    const watching = observers.filter(observer => !observer.disconnected && observer.observed.has(element));
    for (const observer of watching) observer.callback([entry]);
    return watching.length;
  };
  const setVisibility = (next: DocumentVisibilityState) => {
    visibility = next;
    document.dispatchEvent(new window.Event('visibilitychange') as unknown as Event);
  };
  const video = () => {
    const element = document.createElement('video') as HTMLVideoElement;
    document.body.append(element);
    Object.defineProperty(element, 'paused', { configurable: true, get: () => false });
    Object.defineProperty(element, 'readyState', { configurable: true, value: 1 });
    Object.defineProperty(element, 'requestPictureInPicture', { configurable: true, value: async () => {
      if (current && current !== element) leave();
      current = element;
      return {} as PictureInPictureWindow;
    } });
    return element;
  };
  /** The user's own button, menu, or key: the same browser call, without telling the exit watcher. */
  const manualEnter = (element: HTMLVideoElement) => element.requestPictureInPicture();
  const press = () => window.dispatchEvent(new window.Event('pointerup'));
  return { window, document, observers, exits, scroll, setVisibility, video, manualEnter, leave, press, pip: () => current };
}

test('设置默认关，只认 true，导出导入和并发合并带上，且与两个自动进入开关互不牵连', () => {
  assert.equal(defaultSettings.autoPipExitOnReturn, false);
  assert.equal(normalizeSettings({}).autoPipExitOnReturn, false);
  assert.equal(normalizeSettings({ autoPipExitOnReturn: 'true' }).autoPipExitOnReturn, false);
  const on = normalizeSettings({ autoPipExitOnReturn: true });
  assert.equal(on.autoPipExitOnReturn, true);
  assert.equal(on.autoPipOnHide, false);
  assert.equal(on.autoPipOnScroll, false);
  assert.equal(normalizeSettings({ autoPipOnHide: true, autoPipOnScroll: true }).autoPipExitOnReturn, false);
  const parsed = parseSettingsBackup(serializeSettings(on, '1.8.0'));
  assert.equal(parsed.ok && parsed.settings.autoPipExitOnReturn, true);
  assert.equal(parsed.ok && parsed.settings.autoPipOnHide, false);
  const base = normalizeSettings({});
  const other = { ...base, autoPipOnHide: true, autoPipOnScroll: true };
  assert.deepEqual(mergeSettingsChange(other, base, { ...base, autoPipExitOnReturn: true }), { ...other, autoPipExitOnReturn: true });
});

test('切走自动进入的画中画，回到标签且视频在视口里时退出', async () => {
  const { window, document, exits, scroll, setVisibility, video, pip } = page();
  try {
    const main = video();
    const exit = createAutoPipExit(document, { enabled: () => true, delayMs });
    const hide = createAutoPip(document, { enabled: () => true, target: () => main, onEntered: exit.mark });
    setVisibility('hidden');
    await wait(0);
    assert.equal(pip(), main);
    assert.equal(scroll(main, 1), 1, '自动进入后开始观察这一条');
    await wait(delayMs * 2);
    assert.equal(exits.length, 0, '标签还隐藏着时不退');
    setVisibility('visible');
    await wait(delayMs * 2);
    assert.deepEqual(exits, [main]);
    assert.equal(pip(), null);
    hide.dispose();
    exit.dispose();
  } finally { await window.happyDOM.close(); }
});

test('滚出自动进入的画中画，视频重新露出一半以上时退出，只露出一点不退', async () => {
  const { window, document, exits, scroll, video, press, pip } = page();
  try {
    const main = video();
    const exit = createAutoPipExit(document, { enabled: () => true, delayMs });
    const scrolled = createScrollPip(document, { enabled: () => true, target: () => main, onEntered: exit.mark });
    scrolled.sync();
    scroll(main, 1);
    scroll(main, 0);
    await wait(0);
    assert.equal(pip(), main);
    scroll(main, 0.3);
    press();
    await wait(delayMs * 2);
    assert.equal(exits.length, 0, '只露出三成不算回来');
    scroll(main, 0.6);
    await wait(delayMs * 2);
    assert.deepEqual(exits, [main]);
    scrolled.dispose();
    exit.dispose();
  } finally { await window.happyDOM.close(); }
});

test('手动进入的画中画不打标记，回来也不退', async () => {
  const { window, document, observers, exits, scroll, setVisibility, video, manualEnter, pip } = page();
  try {
    const main = video();
    const exit = createAutoPipExit(document, { enabled: () => true, delayMs });
    exit.sync();
    await manualEnter(main);
    setVisibility('hidden');
    setVisibility('visible');
    scroll(main, 1);
    await wait(delayMs * 2);
    assert.equal(pip(), main);
    assert.equal(exits.length, 0);
    assert.equal(observers.length, 0, '没有自动会话时不建观察器');
    exit.dispose();
  } finally { await window.happyDOM.close(); }
});

test('自动会话被手动退出或被另一条手动画中画顶掉后清掉标记', async () => {
  const { window, document, exits, scroll, setVisibility, video, manualEnter, leave, pip } = page();
  try {
    const main = video();
    const other = video();
    const exit = createAutoPipExit(document, { enabled: () => true, delayMs });
    const hide = createAutoPip(document, { enabled: () => true, target: () => main, onEntered: exit.mark });
    setVisibility('hidden');
    await wait(0);
    assert.equal(pip(), main);
    leave();
    await manualEnter(main);
    setVisibility('visible');
    scroll(main, 1);
    await wait(delayMs * 2);
    assert.equal(pip(), main, '手动退出后再手动进入，不算自动会话');
    assert.equal(exits.length, 0);

    leave();
    hide.dispose();
    const later = createAutoPip(document, { enabled: () => true, target: () => main, onEntered: exit.mark });
    setVisibility('hidden');
    await wait(0);
    assert.equal(pip(), main);
    await manualEnter(other);
    setVisibility('visible');
    scroll(main, 1);
    scroll(other, 1);
    await wait(delayMs * 2);
    assert.equal(pip(), other, '另一条手动画中画不被关');
    assert.equal(exits.length, 0);
    later.dispose();
    exit.dispose();
  } finally { await window.happyDOM.close(); }
});

test('抖动不触发：回来的状态要保持一小段时间，路过标签或在阈值附近抖动都不退', async () => {
  const { window, document, exits, scroll, setVisibility, video, pip } = page();
  try {
    const main = video();
    const exit = createAutoPipExit(document, { enabled: () => true, delayMs: 80 });
    const hide = createAutoPip(document, { enabled: () => true, target: () => main, onEntered: exit.mark });
    setVisibility('hidden');
    await wait(0);
    scroll(main, 1);
    setVisibility('visible');
    await wait(20);
    setVisibility('hidden');
    await wait(120);
    assert.equal(exits.length, 0, '路过标签不退');

    scroll(main, 0.05);
    setVisibility('visible');
    for (const share of [0.55, 0.45, 0.6, 0.2]) { scroll(main, share); await wait(20); }
    await wait(120);
    assert.equal(exits.length, 0, '在一半附近来回抖不退');
    assert.equal(pip(), main);
    scroll(main, 0.7);
    await wait(120);
    assert.deepEqual(exits, [main]);
    hide.dispose();
    exit.dispose();
  } finally { await window.happyDOM.close(); }
});

test('自动退出后冷却期内再切走不会马上又进，避免进出闪烁', async () => {
  const { window, document, exits, scroll, setVisibility, video, pip } = page();
  try {
    const main = video();
    const exit = createAutoPipExit(document, { enabled: () => true, delayMs });
    const hide = createAutoPip(document, { enabled: () => true, target: () => main, onEntered: exit.mark });
    setVisibility('hidden');
    await wait(0);
    scroll(main, 1);
    setVisibility('visible');
    await wait(delayMs * 2);
    assert.equal(exits.length, 1);
    setVisibility('hidden');
    await wait(0);
    assert.equal(pip(), null);
    hide.dispose();
    exit.dispose();
  } finally { await window.happyDOM.close(); }
});

test('开关关闭时不退也不观察；同一会话里再打开会按规则退', async () => {
  const { window, document, observers, exits, scroll, setVisibility, video, pip } = page();
  try {
    const main = video();
    let on = false;
    const exit = createAutoPipExit(document, { enabled: () => on, delayMs });
    const hide = createAutoPip(document, { enabled: () => true, target: () => main, onEntered: exit.mark });
    setVisibility('hidden');
    await wait(0);
    assert.equal(pip(), main);
    assert.equal(scroll(main, 1), 0, '开关关着时不观察');
    setVisibility('visible');
    await wait(delayMs * 2);
    assert.equal(exits.length, 0);

    on = true;
    exit.sync();
    scroll(main, 1);
    await wait(delayMs * 2);
    assert.deepEqual(exits, [main]);

    setVisibility('hidden');
    await wait(0);
    assert.equal(pip(), null, '冷却期内不再进');
    hide.dispose();
    exit.dispose();
    assert.ok(observers.every(observer => observer.disconnected));
  } finally { await window.happyDOM.close(); }
});

test('等待退出时关掉开关就取消，不再自动退', async () => {
  const { window, document, observers, exits, scroll, setVisibility, video, pip } = page();
  try {
    const main = video();
    let on = true;
    const exit = createAutoPipExit(document, { enabled: () => on, delayMs: 60 });
    const hide = createAutoPip(document, { enabled: () => true, target: () => main, onEntered: exit.mark });
    setVisibility('hidden');
    await wait(0);
    scroll(main, 1);
    setVisibility('visible');
    await wait(10);
    on = false;
    exit.sync();
    await wait(120);
    assert.equal(exits.length, 0);
    assert.equal(pip(), main);
    assert.ok(observers.every(observer => observer.disconnected));
    hide.dispose();
    exit.dispose();
  } finally { await window.happyDOM.close(); }
});

test('设置页「播放」里的自动退出开关默认关，并且单独保存', async () => {
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
    const label = '回到原标签或视频回到视口时自动退出画中画';
    assert.match(playback?.textContent ?? '', new RegExp(label));
    const toggle = playback?.querySelector(`[role="switch"][aria-label="${label}"]`);
    assert.ok(toggle);
    assert.equal(toggle.getAttribute('aria-checked'), 'false');
    await act(async () => { (toggle as unknown as { click(): void }).click(); });
    assert.equal(value.autoPipExitOnReturn, true);
    assert.equal(value.autoPipOnHide, false);
    assert.equal(value.autoPipOnScroll, false);
    assert.equal(toggle.getAttribute('aria-checked'), 'true');
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
