import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { autoPipCooldownMs, createAutoPip, createAutoPipQuiet } from '../lib/auto-pip';
import { createAutoPipExit } from '../lib/auto-pip-exit';
import { createScrollPip } from '../lib/auto-pip-scroll';
import { readFlatMessages } from '../lib/message-catalog';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

const read = (file: string) => readFlatMessages(readFileSync(new URL(`../locales/${file}`, import.meta.url), 'utf8'));

test('八种语言都写清自动画中画默认全关、只动播放中的选中视频，并且和手动进出并存', () => {
  const files = readdirSync(new URL('../locales/', import.meta.url)).filter(name => name.endsWith('.yml')).sort();
  assert.deepEqual(files, ['de.yml', 'en.yml', 'es.yml', 'fr.yml', 'ja.yml', 'ko.yml', 'zh_CN.yml', 'zh_TW.yml']);
  for (const file of files) {
    const intro = read(file).autoPipIntro ?? '';
    assert.ok(intro.length > 40, file);
    if (file !== 'en.yml') assert.notEqual(intro, read('en.yml').autoPipIntro, file);
  }
  const en = read('en.yml').autoPipIntro ?? '';
  assert.match(en, /off by default/i);
  assert.match(en, /selected video/);
  assert.match(en, /while it is playing/);
  assert.match(en, /yourself still works/);
  assert.match(en, /Picture-in-picture on/);
  assert.match(en, /Picture-in-picture off/);
  assert.match(en, /about 10 seconds/);
  const zh = read('zh_CN.yml');
  assert.match(zh.autoPipIntro ?? '', /默认都关闭/);
  assert.match(zh.autoPipIntro ?? '', /正在播放的选中视频/);
  assert.match(zh.autoPipIntro ?? '', /你自己打开或关掉画中画/);
  assert.match(zh.autoPipIntro ?? '', /画中画开/);
  assert.match(zh.autoPipIntro ?? '', /画中画关/);
  assert.match(zh.autoPipOnHideDescription ?? '', /原来的短说明/);
  assert.match(zh.autoPipOnScrollDescription ?? '', /原来的短说明/);
});

function hidePage() {
  const window = new Window({ url: 'https://example.com/watch' });
  const document = window.document as unknown as Document;
  let visibility: DocumentVisibilityState = 'visible';
  let current: Element | null = null;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, get: () => current });
  Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, get: () => true });
  const hide = () => { visibility = 'hidden'; document.dispatchEvent(new window.Event('visibilitychange') as unknown as Event); };
  const show = () => { visibility = 'visible'; document.dispatchEvent(new window.Event('visibilitychange') as unknown as Event); };
  const video = (options: { playing?: boolean; refuse?: boolean } = {}) => {
    const element = document.createElement('video');
    document.body.append(element);
    let paused = options.playing === false;
    Object.defineProperty(element, 'paused', { configurable: true, get: () => paused });
    Object.defineProperty(element, 'ended', { configurable: true, get: () => false });
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
  return { window, document, hide, show, video, settle, pip: () => current };
}

test('自动进入成功显示画中画开，暂停不提示，音频和站方禁用用原来的短说明且不连环提示', async () => {
  const { window, document, hide, video, settle, pip } = hidePage();
  try {
    let clock = 5_000;
    const hints: string[] = [];
    const playing = video();
    let target: HTMLMediaElement | undefined = playing.element;
    const auto = createAutoPip(document, { enabled: () => true, target: () => target, now: () => clock, onHint: key => hints.push(key) });
    hide();
    await settle();
    assert.equal(playing.requests.length, 1);
    assert.equal(pip() === playing.element, true);
    assert.deepEqual(hints, ['pipOnHint']);
    playing.leave();
    const paused = video({ playing: false });
    target = paused.element;
    clock += autoPipCooldownMs;
    hide();
    await settle();
    assert.equal(paused.requests.length, 0);
    assert.deepEqual(hints, ['pipOnHint']);

    const audio = document.createElement('audio');
    Object.defineProperty(audio, 'paused', { configurable: true, get: () => false });
    Object.defineProperty(audio, 'ended', { configurable: true, get: () => false });
    document.body.append(audio);
    target = audio;
    hide();
    await settle();
    hide();
    await settle();
    assert.deepEqual(hints, ['pipOnHint', 'pipUnavailableAudio']);
    clock += autoPipCooldownMs;
    playing.element.disablePictureInPicture = true;
    target = playing.element;
    hide();
    await settle();
    assert.equal(playing.requests.length, 1, '站方禁用不再请求');
    assert.deepEqual(hints, ['pipOnHint', 'pipUnavailableAudio', 'pipDisabledBySite']);
    hide();
    await settle();
    assert.deepEqual(hints, ['pipOnHint', 'pipUnavailableAudio', 'pipDisabledBySite']);
    auto.dispose();
  } finally { await window.happyDOM.close(); }
});

test('浏览器拒绝显示原来的手势说明，切走和滚出共用冷却，边界来回不连着提示', async () => {
  const window = new Window({ url: 'https://example.com/watch', width: 1280, height: 720 });
  const document = window.document as unknown as Document;
  let visibility: DocumentVisibilityState = 'visible';
  let current: Element | null = null;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, get: () => current });
  Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, get: () => true });
  const observers: Array<{ callback: (entries: IntersectionObserverEntry[]) => void; observed: Set<Element>; disconnected: boolean }> = [];
  class FakeObserver {
    observed = new Set<Element>();
    disconnected = false;
    constructor(readonly callback: (entries: IntersectionObserverEntry[]) => void) { observers.push(this); }
    observe(element: Element) { this.observed.add(element); }
    unobserve(element: Element) { this.observed.delete(element); }
    disconnect() { this.observed.clear(); this.disconnected = true; }
  }
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: FakeObserver });
  const scroll = (element: Element, share: number) => {
    const size = { width: 640, height: 360 };
    const entry = { target: element, boundingClientRect: size, intersectionRect: { width: size.width, height: size.height * share }, intersectionRatio: share, isIntersecting: share > 0 } as unknown as IntersectionObserverEntry;
    for (const observer of observers) if (!observer.disconnected && observer.observed.has(element)) observer.callback([entry]);
  };
  const element = document.createElement('video');
  document.body.append(element);
  Object.defineProperty(element, 'paused', { configurable: true, get: () => false });
  Object.defineProperty(element, 'ended', { configurable: true, get: () => false });
  Object.defineProperty(element, 'readyState', { configurable: true, value: 1 });
  let refuse = true;
  const requests: number[] = [];
  Object.defineProperty(element, 'requestPictureInPicture', { configurable: true, value: async () => {
    requests.push(requests.length);
    if (refuse) throw new DOMException('needs a gesture', 'NotAllowedError');
    current = element;
    return {} as PictureInPictureWindow;
  } });
  const hide = () => { visibility = 'hidden'; document.dispatchEvent(new window.Event('visibilitychange') as unknown as Event); };
  const press = () => window.dispatchEvent(new window.Event('pointerup'));
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  try {
    let clock = 8_000;
    const hints: string[] = [];
    const quiet = createAutoPipQuiet(() => clock);
    const onHint = (key: string) => hints.push(key);
    const auto = createAutoPip(document, { enabled: () => true, target: () => element, now: () => clock, quiet, onHint });
    const scrolled = createScrollPip(document, { enabled: () => true, target: () => element, now: () => clock, quiet, onHint });
    scrolled.sync();
    hide();
    await settle();
    assert.deepEqual(hints, ['pipNeedsGesture']);
    assert.equal(requests.length, 1);
    scroll(element, 1);
    scroll(element, 0);
    press();
    await settle();
    assert.equal(requests.length, 1, '失败冷却挡住另一条自动进入');
    assert.deepEqual(hints, ['pipNeedsGesture']);
    clock += autoPipCooldownMs;
    refuse = false;
    scroll(element, 0.08);
    scroll(element, 0.2);
    scroll(element, 0.05);
    await settle();
    assert.equal(requests.length, 2);
    assert.ok(current === element);
    assert.deepEqual(hints, ['pipNeedsGesture', 'pipOnHint']);
    auto.dispose();
    scrolled.dispose();
  } finally { await window.happyDOM.close(); }
});

test('自动退出成功显示画中画关，阈值附近抖动不连闪，失败不假装成功也不马上再试', async () => {
  const window = new Window({ url: 'https://example.com/watch', width: 1280, height: 720 });
  const document = window.document as unknown as Document;
  let visibility: DocumentVisibilityState = 'visible';
  let current: Element | null = null;
  const exits: number[] = [];
  let fail = false;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, get: () => current });
  Object.defineProperty(document, 'pictureInPictureEnabled', { configurable: true, get: () => true });
  const leave = () => {
    const element = current;
    if (!element) return;
    current = null;
    element.dispatchEvent(new window.Event('leavepictureinpicture', { bubbles: true }) as unknown as Event);
  };
  Object.defineProperty(document, 'exitPictureInPicture', { configurable: true, value: async () => {
    exits.push(exits.length);
    if (fail) throw new DOMException('no', 'InvalidStateError');
    leave();
  } });
  const observers: Array<{ callback: (entries: IntersectionObserverEntry[]) => void; observed: Set<Element>; disconnected: boolean }> = [];
  class FakeObserver {
    observed = new Set<Element>();
    disconnected = false;
    constructor(readonly callback: (entries: IntersectionObserverEntry[]) => void) { observers.push(this); }
    observe(element: Element) { this.observed.add(element); }
    unobserve(element: Element) { this.observed.delete(element); }
    disconnect() { this.observed.clear(); this.disconnected = true; }
  }
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: FakeObserver });
  const scroll = (element: Element, share: number) => {
    const size = { width: 640, height: 360 };
    const entry = { target: element, boundingClientRect: size, intersectionRect: { width: size.width, height: size.height * share }, intersectionRatio: share, isIntersecting: share > 0 } as unknown as IntersectionObserverEntry;
    for (const observer of observers) if (!observer.disconnected && observer.observed.has(element)) observer.callback([entry]);
  };
  const element = document.createElement('video') as HTMLVideoElement;
  document.body.append(element);
  Object.defineProperty(element, 'paused', { configurable: true, get: () => false });
  Object.defineProperty(element, 'readyState', { configurable: true, value: 1 });
  Object.defineProperty(element, 'requestPictureInPicture', { configurable: true, value: async () => { current = element; return {} as PictureInPictureWindow; } });
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  try {
    const hints: string[] = [];
    const quiet = createAutoPipQuiet();
    const exit = createAutoPipExit(document, { enabled: () => true, delayMs: 40, quiet, onHint: key => hints.push(key) });
    const hide = createAutoPip(document, { enabled: () => true, target: () => element, quiet, onEntered: exit.mark, onHint: key => hints.push(key) });
    visibility = 'hidden';
    document.dispatchEvent(new window.Event('visibilitychange') as unknown as Event);
    await wait(0);
    assert.ok(current === element);
    assert.deepEqual(hints, ['pipOnHint']);
    scroll(element, 1);
    for (const share of [0.55, 0.45, 0.6, 0.4]) { scroll(element, share); await wait(15); }
    assert.equal(exits.length, 0, '一半附近抖动不退');
    assert.deepEqual(hints, ['pipOnHint']);
    visibility = 'visible';
    document.dispatchEvent(new window.Event('visibilitychange') as unknown as Event);
    scroll(element, 0.8);
    await wait(80);
    assert.equal(exits.length, 1);
    assert.ok(current == null);
    assert.deepEqual(hints, ['pipOnHint', 'pipOffHint']);
    visibility = 'hidden';
    document.dispatchEvent(new window.Event('visibilitychange') as unknown as Event);
    await wait(0);
    assert.ok(current == null, '退出后冷却期内不又进');
    assert.deepEqual(hints, ['pipOnHint', 'pipOffHint']);
    hide.dispose();
    exit.dispose();

    fail = true;
    const again = createAutoPipQuiet();
    const failedHints: string[] = [];
    const exitAgain = createAutoPipExit(document, { enabled: () => true, delayMs: 40, quiet: again, onHint: key => failedHints.push(key) });
    const hideAgain = createAutoPip(document, { enabled: () => true, target: () => element, quiet: again, onEntered: exitAgain.mark, onHint: key => failedHints.push(key) });
    visibility = 'hidden';
    document.dispatchEvent(new window.Event('visibilitychange') as unknown as Event);
    await wait(0);
    visibility = 'visible';
    document.dispatchEvent(new window.Event('visibilitychange') as unknown as Event);
    scroll(element, 1);
    await wait(80);
    assert.equal(exits.length, 2);
    assert.ok(current === element, '失败后退不出');
    assert.deepEqual(failedHints, ['pipOnHint', 'pipFailed']);
    scroll(element, 0.4);
    scroll(element, 0.9);
    await wait(80);
    assert.equal(exits.length, 2, '失败冷却内抖动不再请求退出');
    hideAgain.dispose();
    exitAgain.dispose();
  } finally { await window.happyDOM.close(); }
});

test('手动进入不打自动提示，设置页播放区能看见这段说明', async () => {
  const { window, document, video, settle } = hidePage();
  const hints: string[] = [];
  try {
    const playing = video();
    const auto = createAutoPip(document, { enabled: () => true, target: () => playing.element, onHint: key => hints.push(key) });
    await playing.element.requestPictureInPicture();
    await settle();
    assert.deepEqual(hints, []);
    auto.dispose();
  } finally { await window.happyDOM.close(); }

  const settingsWindow = new Window({ url: 'https://example.com/options' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? settingsWindow : settingsWindow[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: settingsWindow[name].bind(settingsWindow), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { SettingsPage } = await import('../components/settings-page');
  const value: Settings = { ...defaultSettings, theme: 'light' };
  const store: SettingsStore = {
    async load() { return value; },
    async save() { return; },
    watch() { return () => {}; }
  };
  const host = settingsWindow.document.createElement('div');
  settingsWindow.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
    const playback = host.querySelector('#playback')?.textContent ?? '';
    assert.match(playback, /这三项默认都关闭/);
    assert.match(playback, /正在播放的选中视频/);
    assert.match(playback, /你自己打开或关掉画中画/);
  } finally {
    await act(async () => { root.unmount(); });
    await settingsWindow.happyDOM.close();
  }
});
