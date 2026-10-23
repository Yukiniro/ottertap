import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { volumeGestureEvent } from '../lib/hotkey';
import { hoverWheelTarget, mediaPresenceEvent } from '../lib/media';
import { createFloatingWhilePlayingGate, floatingWhilePlayingHideMs, stepFloatingWhilePlaying } from '../lib/floating-play';
import { normalizeSettings } from '../lib/settings';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { defaultSettings, type MediaClient, type MediaState, type Settings, type SettingsStore } from '../lib/types';

test('仅在播放时显示默认关闭，暂停防抖，且不改悬停滚轮目标', () => {
  assert.equal(defaultSettings.floatingWhilePlaying, false);
  assert.equal(normalizeSettings(null).floatingWhilePlaying, false);
  assert.equal(normalizeSettings({}).floatingWhilePlaying, false, '老用户没有这一项时保持关闭');
  assert.equal(normalizeSettings({ floatingWhilePlaying: true }).floatingWhilePlaying, true);
  for (const value of ['true', 1, 0, null, false]) assert.equal(normalizeSettings({ floatingWhilePlaying: value }).floatingWhilePlaying, false, String(value));
  const settings = normalizeSettings({ ...defaultSettings, floatingWhilePlaying: true, hoverWheel: false });
  const text = serializeSettings(settings, '1.7.0');
  assert.match(text, /"floatingWhilePlaying": true/);
  const parsed = parseSettingsBackup(text);
  assert.equal(parsed.ok && parsed.settings.floatingWhilePlaying, true);
  assert.equal(parsed.ok && parsed.settings.hoverWheel, false);
  const dirty = JSON.parse(text) as { settings: { floatingWhilePlaying?: unknown } };
  delete dirty.settings.floatingWhilePlaying;
  const legacy = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(legacy.ok && legacy.settings.floatingWhilePlaying, false);
  assert.equal(legacy.ok && legacy.settings.hoverWheel, false);

  const paused = { id: 'main', paused: true, muted: false, volume: 1 };
  assert.equal(hoverWheelTarget('main', [paused], 'main'), 'main', '暂停的主播放区仍是悬停滚轮目标');

  let gate = createFloatingWhilePlayingGate();
  const step = (input: { whilePlaying: boolean; selected: boolean; playing: boolean; now: number }) => {
    const next = stepFloatingWhilePlaying(gate, input);
    gate = next.gate;
    return next.visible;
  };
  assert.equal(step({ whilePlaying: false, selected: true, playing: false, now: 0 }), true);
  assert.equal(step({ whilePlaying: true, selected: true, playing: false, now: 0 }), false, '开启后，还没播放过的暂停媒体不显示');
  assert.equal(step({ whilePlaying: true, selected: false, playing: false, now: 10 }), false);
  assert.equal(step({ whilePlaying: true, selected: true, playing: true, now: 100 }), true);
  assert.equal(step({ whilePlaying: true, selected: true, playing: false, now: 110 }), true);
  assert.equal(step({ whilePlaying: true, selected: true, playing: false, now: 110 + floatingWhilePlayingHideMs - 1 }), true);
  assert.equal(step({ whilePlaying: true, selected: true, playing: true, now: 110 + floatingWhilePlayingHideMs - 1 }), true, '延时内恢复播放则保持显示');
  assert.equal(step({ whilePlaying: true, selected: true, playing: false, now: 600 }), true);
  assert.equal(step({ whilePlaying: true, selected: true, playing: false, now: 600 + floatingWhilePlayingHideMs }), false);
  assert.equal(step({ whilePlaying: true, selected: false, playing: false, now: 1200 }), false, '没有选中时马上隐藏');
  assert.equal(step({ whilePlaying: true, selected: true, playing: false, now: 1210 }), false, '选中回来仍暂停时不再闪一下');
  assert.equal(step({ whilePlaying: true, selected: true, playing: true, now: 1300 }), true);
  assert.equal(step({ whilePlaying: false, selected: true, playing: false, now: 700 }), true);
  assert.equal(step({ whilePlaying: true, selected: true, playing: false, now: 800 }), false, '关掉再打开后，暂停页不沿用之前的播放记录');
});

test('设置页开关默认关闭，打开后只改这一项；浮动入口随播放防抖', async () => {
  const window = new Window({ url: 'https://example.com/watch' });
  const globals = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const;
  for (const name of globals) Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { SettingsPage } = await import('../components/settings-page');
  const { FloatingController } = await import('../components/floating');
  let value: Settings = { ...defaultSettings, theme: 'light', hoverWheel: true };
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const pageHost = window.document.createElement('div');
  window.document.body.append(pageHost);
  const pageRoot = createRoot(pageHost as unknown as HTMLElement);
  let media: MediaState = { id: '1', title: '测试媒体', label: '测试媒体', host: 'example.com', kind: 'video', paused: true, muted: false, volume: .5, maxVolume: 1, rate: 1, currentTime: 0, duration: 10, live: false, seekable: [{ start: 0, end: 10 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: '1', media: [{ ...media }] }; },
    async command() {},
    async select() {},
    async highlight() {}
  };
  const floatHost = window.document.createElement('div');
  window.document.body.append(floatHost);
  const floatRoot = createRoot(floatHost as unknown as HTMLElement);
  const aside = () => floatHost.querySelector('aside');
  const refresh = async () => {
    window.dispatchEvent(new window.Event(mediaPresenceEvent));
    await new Promise(resolve => setTimeout(resolve, 30));
  };
  try {
    await act(async () => { pageRoot.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
    const toggle = pageHost.querySelector('[role="switch"][aria-label="仅在选中媒体播放时显示"]');
    assert.ok(toggle);
    assert.equal(toggle.getAttribute('aria-checked'), 'false');
    assert.match(pageHost.textContent ?? '', /暂停一小会儿后才隐藏/);
    assert.match(pageHost.textContent ?? '', /不影响悬停在主播放区用滚轮调音量/);
    await act(async () => { (toggle as unknown as HTMLElement).click(); });
    assert.equal(value.floatingWhilePlaying, true);
    assert.equal(value.hoverWheel, true);
    assert.equal(value.floating, true);
    assert.equal(value.floatingNote, 'volume');
    await act(async () => { (toggle as unknown as HTMLElement).click(); });
    assert.equal(value.floatingWhilePlaying, false);

    await act(async () => { floatRoot.render(createElement(ThemeProvider, { store, children: createElement(FloatingController, { client }) })); });
    assert.ok(aside(), '开关关闭时，暂停的媒体仍显示浮动入口');
    value = { ...value, floatingWhilePlaying: true };
    await act(async () => { listeners.forEach(listener => listener(value)); await new Promise(resolve => setTimeout(resolve, 20)); });
    assert.equal(aside(), null, '开启后，尚未在此状态下播放过的暂停媒体马上隐藏');
    media = { ...media, paused: false };
    await act(refresh);
    assert.ok(aside(), '开始播放后入口出现');
    media = { ...media, paused: true };
    const pausedAt = Date.now();
    await act(refresh);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 150)); });
    assert.ok(aside(), '暂停后的短时间里入口还在');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, floatingWhilePlayingHideMs)); });
    assert.equal(aside(), null, '暂停超过防抖时间后入口隐藏');
    assert.ok(Date.now() - pausedAt >= floatingWhilePlayingHideMs);
    media = { ...media, paused: false };
    await act(refresh);
    assert.ok(aside(), '再次播放后入口出现');
    media = { ...media, paused: true };
    await act(refresh);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, floatingWhilePlayingHideMs)); });
    assert.equal(aside(), null);
    await act(async () => { window.dispatchEvent(new window.Event(volumeGestureEvent)); });
    media = { ...media, paused: false };
    await act(refresh);
    assert.ok(aside(), '隐藏期间的音量手势之后，再播放入口仍出现');
    assert.equal(floatHost.querySelector('[role="dialog"]'), null, '入口隐藏时的音量手势不会把药丸展开');
    media = { ...media, paused: true };
    await act(refresh);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 80)); });
    media = { ...media, paused: false };
    await act(refresh);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, floatingWhilePlayingHideMs)); });
    assert.ok(aside(), '快速暂停后再播放，入口不会闪掉');
  } finally {
    await act(async () => { pageRoot.unmount(); floatRoot.unmount(); });
    await window.happyDOM.close();
  }
});
