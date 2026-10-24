import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { normalizeSettings } from '../lib/settings';
import { commandForHotkey } from '../lib/hotkey';
import { wheelVolumePoints } from '../lib/volume';
import { defaultSettings, type MediaState, type Settings, type SettingsStore } from '../lib/types';

const media = { id: '1', paused: false, muted: false, volume: .1, maxVolume: 2, rate: 1 } as MediaState;

test('滚轮方向默认向上增大，只翻转滚轮刻度的符号', () => {
  assert.equal(defaultSettings.wheelDirection, 'up');
  assert.equal(normalizeSettings(null).wheelDirection, 'up');
  assert.equal(normalizeSettings({}).wheelDirection, 'up', '没有这一项时仍是向上增大');
  assert.equal(normalizeSettings({ wheelDirection: 'down' }).wheelDirection, 'down');
  assert.equal(normalizeSettings({ wheelDirection: 'up' }).wheelDirection, 'up');
  assert.equal(normalizeSettings({ wheelDirection: 'invert' }).wheelDirection, 'up');
  assert.equal(normalizeSettings({ wheelDirection: false }).wheelDirection, 'up');
  assert.equal(wheelVolumePoints(1, 50, 10, true, 'up'), 10);
  assert.equal(wheelVolumePoints(-1, 50, 10, true, 'up'), -10);
  assert.equal(wheelVolumePoints(1, 50, 10, true, 'down'), -10);
  assert.equal(wheelVolumePoints(-1, 50, 10, true, 'down'), 10);
  assert.equal(wheelVolumePoints(1, 10, 10, true, 'down'), -1, '反向时低音量仍是 1%');
  assert.equal(wheelVolumePoints(-1, 10, 20, false, 'down'), 20, '关掉细档后反向用音量步长');
  assert.equal(wheelVolumePoints(-1, 24.4, 20, true, 'down'), 1);
  assert.equal(wheelVolumePoints(-1, 25, 5, true, 'down'), 5);
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1 }, media), { type: 'volume', value: .11 }, '缺省方向仍向上增大，低音量仍是 1%');
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1 }, media, null, undefined, false, 10, true, 'down'), { type: 'volume', value: .09 });
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: -1 }, media, null, undefined, false, 10, true, 'down'), { type: 'volume', value: .11 });
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1 }, { ...media, volume: .4 }, null, undefined, false, 10, true, 'down'), { type: 'volume', value: .3 });
  assert.deepEqual(commandForHotkey({ type: 'volume', delta: 10 }, media, null, undefined, false, 10, true, 'down'), { type: 'volume', value: .2 }, '方向键的百分点不跟着反向');
});

test('导出和导入带着滚轮方向，缺省仍是向上增大', () => {
  const settings = normalizeSettings({ ...defaultSettings, wheelDirection: 'down', fineWheel: true, volumeStep: 5 });
  const text = serializeSettings(settings, '1.7.0');
  assert.match(text, /"wheelDirection": "down"/);
  const parsed = parseSettingsBackup(text);
  assert.equal(parsed.ok && parsed.settings.wheelDirection, 'down');
  assert.equal(parsed.ok && parsed.settings.fineWheel, true);
  assert.equal(parsed.ok && parsed.settings.volumeStep, 5);
  const dirty = JSON.parse(text) as { settings: { wheelDirection?: unknown } };
  delete dirty.settings.wheelDirection;
  const legacy = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(legacy.ok && legacy.settings.wheelDirection, 'up');
  dirty.settings.wheelDirection = 'sideways';
  const invalid = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(invalid.ok && invalid.settings.wheelDirection, 'up');
});

test('设置页音量步长下面可以选择滚轮方向，默认向上增大', async () => {
  const window = new Window({ url: 'https://example.com/options' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { SettingsPage } = await import('../components/settings-page');
  let value: Settings = { ...defaultSettings, theme: 'light', volumeStep: 20 };
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const button = (label: string) => [...host.querySelectorAll('button')].find(item => item.textContent === label);
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
    const playback = host.querySelector('#playback');
    assert.match(playback?.textContent ?? '', /滚轮方向/);
    assert.match(playback?.textContent ?? '', /只影响悬停在主播放区时的滚轮和 Alt\+滚轮/);
    assert.match(playback?.textContent ?? '', /页面本身的滚动方向不变/);
    const up = button('向上滚动增大音量');
    const down = button('向下滚动增大音量');
    assert.ok(up);
    assert.ok(down);
    assert.equal(up.getAttribute('aria-pressed'), 'true');
    assert.equal(down.getAttribute('aria-pressed'), 'false');
    await act(async () => { down.click(); });
    assert.equal(value.wheelDirection, 'down');
    assert.equal(value.volumeStep, 20);
    assert.equal(value.fineWheel, true);
    assert.equal(down.getAttribute('aria-pressed'), 'true');
    assert.equal(up.getAttribute('aria-pressed'), 'false');
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
