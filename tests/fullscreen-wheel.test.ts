import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { normalizeSettings } from '../lib/settings';
import { bareHoverStage, hoverFullscreenActive } from '../lib/fullscreen-wheel';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

test('全屏开关默认关，关着时不读全屏，开着才看当前状态', () => {
  assert.equal(defaultSettings.fullscreenWheel, false);
  assert.equal(defaultSettings.hoverWheel, true);
  assert.equal(normalizeSettings(null).fullscreenWheel, false);
  assert.equal(normalizeSettings({}).fullscreenWheel, false, '没有这一项时保持现在的悬停滚轮');
  assert.equal(normalizeSettings({ fullscreenWheel: true }).fullscreenWheel, true);
  assert.equal(normalizeSettings({ fullscreenWheel: false }).fullscreenWheel, false);
  assert.equal(normalizeSettings({ fullscreenWheel: 'yes' }).fullscreenWheel, false);
  assert.equal(normalizeSettings({ fullscreenWheel: 1 }).fullscreenWheel, false);
  let reads = 0;
  const active = () => { reads += 1; return false; };
  assert.equal(bareHoverStage(true, false, active), true, '开关关闭时主播放区仍拦截');
  assert.equal(bareHoverStage(false, false, active), false, '开关关闭时不够大的播放区仍放行');
  assert.equal(reads, 0, '开关关闭时不读取全屏');
  assert.equal(bareHoverStage(false, true, active), false);
  assert.equal(reads, 0, '指针不在主播放区时也不读取全屏');
  assert.equal(bareHoverStage(true, true, active), false, '开启后非全屏放行页面');
  assert.equal(reads, 1);
  assert.equal(bareHoverStage(true, true, () => true), true, '开启后全屏仍可悬停调音');
});

test('导出和导入带着全屏滚轮开关，缺省仍是关闭', () => {
  const settings = normalizeSettings({ ...defaultSettings, fullscreenWheel: true, hoverWheel: true });
  const text = serializeSettings(settings, '1.7.0');
  assert.match(text, /"fullscreenWheel": true/);
  const parsed = parseSettingsBackup(text);
  assert.equal(parsed.ok && parsed.settings.fullscreenWheel, true);
  assert.equal(parsed.ok && parsed.settings.hoverWheel, true);
  const dirty = JSON.parse(text) as { settings: { fullscreenWheel?: unknown } };
  delete dirty.settings.fullscreenWheel;
  const legacy = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(legacy.ok && legacy.settings.fullscreenWheel, false);
  assert.equal(legacy.ok && legacy.settings.hoverWheel, true);
});

function view() {
  return new Window({ url: 'https://example.com/watch', width: 1280, height: 720 });
}

function active(target: object, point?: { x: number; y: number }) {
  return hoverFullscreenActive(target as never, point);
}

function box(width: number, height: number, top = 0, left = 0) {
  return { x: left, y: top, top, left, right: left + width, bottom: top + height, width, height, toJSON() { return {}; } };
}

test('全屏 API、浏览器全屏和视频原生全屏算全屏，普通窗口不算', () => {
  const window = view();
  const { document } = window;
  const video = document.createElement('video');
  document.body.append(video);
  assert.equal(active(window), false, '普通页面不是全屏');

  let fullscreen: object | null = video;
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreen });
  assert.equal(active(window), true, 'Fullscreen API 元素算全屏');
  fullscreen = null;
  Object.defineProperty(document, 'webkitFullscreenElement', { configurable: true, get: () => video });
  assert.equal(active(window), true, 'webkit 前缀也算');
  Object.defineProperty(document, 'webkitFullscreenElement', { configurable: true, get: () => null });
  Object.defineProperty(document, 'mozFullScreenElement', { configurable: true, get: () => document.documentElement });
  assert.equal(active(window), true, '页面本身进了全屏也算');
  Object.defineProperty(document, 'mozFullScreenElement', { configurable: true, get: () => null });

  Object.defineProperty(video, 'webkitDisplayingFullscreen', { configurable: true, value: true });
  assert.equal(active(window), true, '视频自己的原生全屏算');
  Object.defineProperty(video, 'webkitDisplayingFullscreen', { configurable: true, value: false });
  assert.equal(active(window), false);

  Object.defineProperty(window, 'fullScreen', { configurable: true, value: true });
  assert.equal(active(window), true, 'Firefox 的窗口全屏算');
  Object.defineProperty(window, 'fullScreen', { configurable: true, value: false });

  window.matchMedia = ((query: string) => ({ matches: query === '(display-mode: fullscreen)', media: query })) as typeof window.matchMedia;
  assert.equal(active(window), true, 'display-mode fullscreen 算浏览器全屏');
  window.happyDOM.close();
});

test('铺满屏幕且没有工具栏才算浏览器全屏，普通大窗口不算', () => {
  const window = view();
  const define = (name: string, value: number) => Object.defineProperty(window, name, { configurable: true, value });
  define('innerWidth', 1920);
  define('innerHeight', 1080);
  define('outerWidth', 1920);
  define('outerHeight', 1160);
  Object.defineProperty(window.screen, 'width', { configurable: true, value: 1920 });
  Object.defineProperty(window.screen, 'height', { configurable: true, value: 1080 });
  assert.equal(active(window), false, '工具栏还在，只是窗口很大');
  define('outerHeight', 1080);
  Object.defineProperty(window.navigator, 'webdriver', { configurable: true, value: false });
  assert.equal(active(window), true, '视口铺满屏幕且没有工具栏');
  Object.defineProperty(window.navigator, 'webdriver', { configurable: true, value: true });
  assert.equal(active(window), false, '自动化浏览器的无边框窗口不是用户进入的全屏');
  Object.defineProperty(window.navigator, 'webdriver', { configurable: true, value: false });
  define('innerWidth', 1280);
  define('innerHeight', 720);
  define('outerWidth', 1280);
  define('outerHeight', 720);
  assert.equal(active(window), false, '视口比屏幕小，即使没有工具栏也不算');
  window.happyDOM.close();
});

test('常见网页全屏标记算，剧场模式和普通铺满层不算', () => {
  const window = view();
  const { document } = window;
  const shell = document.createElement('div');
  const video = document.createElement('video');
  shell.append(video);
  document.body.append(shell);
  shell.className = 'ytp-size-large';
  assert.equal(active(window), false, '剧场模式不是全屏');
  for (const name of ['bpx-state-web-fullscreen', 'bilibili-player-video-web-fullscreen', 'xgplayer-is-cssfullscreen', 'dplayer-web-fullscreen', 'art-fullscreen-web', 'plyr--fullscreen-fallback']) {
    shell.className = name;
    assert.equal(active(window), true, name);
  }
  shell.className = '';
  document.body.className = 'bpx-state-web-fullscreen';
  assert.equal(active(window), true, '标记在 body 上也能认');
  document.body.className = '';
  assert.equal(active(window), false);
  window.happyDOM.close();
});

test('指针下固定铺满且层级够高算网页全屏，body 锁滚动和低层级不算', () => {
  const window = view();
  const { document } = window;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  const shell = document.createElement('div');
  const video = document.createElement('video');
  const banner = document.createElement('div');
  shell.append(video);
  document.body.append(shell, banner);
  const full = box(1000, 800);
  shell.getBoundingClientRect = () => full as never;
  banner.getBoundingClientRect = () => full as never;
  document.body.getBoundingClientRect = () => full as never;
  shell.style.position = 'fixed';
  shell.style.zIndex = '10000';
  banner.style.position = 'fixed';
  banner.style.zIndex = '10000';
  document.body.style.position = 'fixed';
  document.body.style.zIndex = '10000';
  document.elementFromPoint = () => video;
  assert.equal(active(window, { x: 10, y: 10 }), true, '播放器固定铺满窗口');
  assert.equal(active(window), false, '没有指针时不靠几何猜测');
  shell.style.zIndex = '999';
  assert.equal(active(window, { x: 10, y: 10 }), false, '层级不够高，避免把普通浮层当全屏');
  shell.style.zIndex = '10000';
  shell.getBoundingClientRect = () => box(900, 800) as never;
  assert.equal(active(window, { x: 10, y: 10 }), false, '没有铺满宽度');
  shell.getBoundingClientRect = () => full as never;
  document.elementFromPoint = () => banner;
  assert.equal(active(window, { x: 10, y: 10 }), false, '铺满层不是指针下的播放器');
  document.elementFromPoint = () => video;
  shell.style.position = 'static';
  document.body.className = '';
  assert.equal(active(window, { x: 10, y: 10 }), false, 'body 本身固定铺满只是锁滚动');
  window.happyDOM.close();
});

test('开放 shadow 里的网页全屏标记和原生全屏也能认', () => {
  const window = view();
  const { document } = window;
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  const shell = document.createElement('div');
  const video = document.createElement('video');
  shell.className = 'xgplayer-is-cssfullscreen';
  shell.append(video);
  shadow.append(shell);
  document.body.append(host);
  assert.equal(active(window), false, '标记在 shadow 里时，页面查询碰不到');
  document.elementFromPoint = () => video;
  assert.equal(active(window, { x: 4, y: 4 }), true, '指针下能穿过 shadow 看到标记');
  shell.className = '';
  Object.defineProperty(video, 'webkitDisplayingFullscreen', { configurable: true, value: true });
  assert.equal(active(window, { x: 4, y: 4 }), true, 'shadow 里的视频原生全屏');
  window.happyDOM.close();
});

test('跨源顶层窗口读不到时，仍用当前文档的全屏', () => {
  const window = view();
  const { document } = window;
  Object.defineProperty(window, 'top', { configurable: true, get() { throw new DOMException('blocked'); } });
  let fullscreen: object | null = document.documentElement;
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreen });
  assert.equal(active(window), true);
  window.happyDOM.close();
});

test('设置页悬停滚轮下面的全屏开关默认关，并且单独保存', async () => {
  const window = new Window({ url: 'https://example.com/options' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { SettingsPage } = await import('../components/settings-page');
  let value: Settings = { ...defaultSettings, theme: 'light', hoverWheel: true };
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
    const shortcuts = host.querySelector('#shortcuts');
    assert.match(shortcuts?.textContent ?? '', /仅在全屏时用悬停滚轮调音量/);
    assert.match(shortcuts?.textContent ?? '', /非全屏时 Alt\+滚轮仍然可以调音量/);
    const toggle = host.querySelector('[role="switch"][aria-label="仅在全屏时用悬停滚轮调音量"]');
    const hover = host.querySelector('[role="switch"][aria-label="悬停在主播放区直接用滚轮调音量"]');
    assert.ok(host.querySelector('#settings-fullscreen-wheel'));
    assert.ok(toggle);
    assert.equal(toggle.getAttribute('aria-checked'), 'false');
    assert.equal(hover?.getAttribute('aria-checked'), 'true');
    await act(async () => { (toggle as unknown as { click(): void }).click(); });
    assert.equal(value.fullscreenWheel, true);
    assert.equal(value.hoverWheel, true);
    assert.equal(toggle?.getAttribute('aria-checked'), 'true');
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
