import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { normalizeSettings } from '../lib/settings';
import { commandForHotkey } from '../lib/hotkey';
import { fineWheelStep, fineWheelThreshold, volumeStepForWheel } from '../lib/volume';
import { defaultSettings, type MediaState, type Settings, type SettingsStore } from '../lib/types';

const media = { id: '1', paused: false, muted: false, volume: .1, maxVolume: 2, rate: 1 } as MediaState;

test('低音量滚轮默认用 1%，25% 起回到音量步长', () => {
  assert.equal(defaultSettings.fineWheel, true);
  assert.equal(fineWheelThreshold, 25);
  assert.equal(fineWheelStep, 1);
  assert.equal(normalizeSettings(null).fineWheel, true);
  assert.equal(normalizeSettings({}).fineWheel, true, '没有这一项时默认开启');
  assert.equal(normalizeSettings({ fineWheel: false }).fineWheel, false);
  assert.equal(normalizeSettings({ fineWheel: 0 }).fineWheel, true);
  assert.equal(normalizeSettings({ fineWheel: 'yes' }).fineWheel, true);
  for (const [percent, step, fine, expected] of [
    [0, 10, true, 1],
    [10, 10, true, 1],
    [24.4, 20, true, 1],
    [24.6, 20, true, 20],
    [25, 5, true, 5],
    [40, 10, true, 10],
    [110, 10, true, 10],
    [10, 20, false, 20],
    [10, 7, true, 1]
  ] as const) {
    assert.equal(volumeStepForWheel(percent, step, fine), expected, `${percent}% step ${step} fine ${fine}`);
  }
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1 }, media), { type: 'volume', value: .11 });
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: -2 }, media), { type: 'volume', value: .08 });
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1 }, { ...media, volume: .24 }), { type: 'volume', value: .25 });
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1 }, { ...media, volume: .25 }), { type: 'volume', value: .35 });
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1 }, { ...media, volume: .4 }, null, undefined, false, 5, true), { type: 'volume', value: .45 });
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1 }, media, null, undefined, false, 20, false), { type: 'volume', value: .3 });
  assert.deepEqual(commandForHotkey({ type: 'volume', delta: 10 }, media), { type: 'volume', value: .2 }, '方向键带来的百分点不改成细档');
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1 }, { ...media, muted: true, volume: .5 }), { type: 'volume', value: .01 }, '静音时显示 0%，按细档');
});

test('导出和导入带着低音量细档，缺省仍是开启', () => {
  const settings = normalizeSettings({ ...defaultSettings, fineWheel: false, volumeStep: 20 });
  const text = serializeSettings(settings, '1.7.0');
  assert.match(text, /"fineWheel": false/);
  const parsed = parseSettingsBackup(text);
  assert.equal(parsed.ok && parsed.settings.fineWheel, false);
  assert.equal(parsed.ok && parsed.settings.volumeStep, 20);
  const dirty = JSON.parse(text) as { settings: { fineWheel?: unknown } };
  delete dirty.settings.fineWheel;
  const legacy = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(legacy.ok && legacy.settings.fineWheel, true);
});

test('设置页音量步长下面的细档开关默认开，并且单独保存', async () => {
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
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
    const playback = host.querySelector('#playback');
    assert.match(playback?.textContent ?? '', /音量低于 25% 时滚轮更细/);
    assert.match(playback?.textContent ?? '', /悬停滚轮和 Alt\+滚轮按 1% 调整/);
    const toggle = host.querySelector('[role="switch"][aria-label="音量低于 25% 时滚轮更细"]');
    assert.ok(toggle);
    assert.equal(toggle.getAttribute('aria-checked'), 'true');
    await act(async () => { (toggle as unknown as { click(): void }).click(); });
    assert.equal(value.fineWheel, false);
    assert.equal(value.volumeStep, 20);
    assert.equal(toggle?.getAttribute('aria-checked'), 'false');
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
