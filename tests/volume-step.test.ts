import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { normalizeSettings } from '../lib/settings';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

test('音量步长只接受 5、10、20，缺省和非法值回到 10', () => {
  assert.equal(defaultSettings.volumeStep, 10);
  assert.equal(normalizeSettings(null).volumeStep, 10);
  assert.equal(normalizeSettings({}).volumeStep, 10, '老用户没有这一项时仍是 10%');
  for (const step of [5, 10, 20]) assert.equal(normalizeSettings({ volumeStep: step }).volumeStep, step);
  for (const step of [0, 1, 7, 15, 25, 30, 100, -5, 10.5, '10', true, null]) {
    assert.equal(normalizeSettings({ volumeStep: step }).volumeStep, 10, String(step));
  }
});

test('导出和导入带着音量步长，非法导入回到 10', () => {
  const settings = normalizeSettings({ ...defaultSettings, volumeStep: 20 });
  const text = serializeSettings(settings, '1.7.0');
  assert.match(text, /"volumeStep": 20/);
  const parsed = parseSettingsBackup(text);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.settings.volumeStep, 20);
  const dirty = JSON.parse(text) as { settings: { volumeStep?: unknown } };
  dirty.settings.volumeStep = 15;
  const cleaned = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(cleaned.ok && cleaned.settings.volumeStep, 10);
  delete dirty.settings.volumeStep;
  const legacy = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(legacy.ok && legacy.settings.volumeStep, 10);
});

test('设置页播放分区用分段选择立即保存音量步长', async () => {
  const window = new Window({ url: 'https://example.com/options' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { SettingsPage } = await import('../components/settings-page');
  let value: Settings = { ...defaultSettings, theme: 'light', lockRate: true };
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const option = (label: string) => [...host.querySelectorAll('button')].find(item => item.textContent === label);
  const click = async (element: { click(): void }) => { await act(async () => { element.click(); }); };
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
    const playback = host.querySelector('#playback');
    assert.ok(playback);
    assert.match(playback.textContent ?? '', /音量调节步长/);
    assert.match(playback.textContent ?? '', /滚轮、单键模式方向键和浏览器扩展命令的音量增减都按这个步长/);
    assert.equal(option('10%')?.getAttribute('aria-pressed'), 'true');
    assert.equal(option('5%')?.getAttribute('aria-pressed'), 'false');
    await click(option('5%')!);
    assert.equal(value.volumeStep, 5);
    assert.equal(value.skipSeconds, 10);
    assert.equal(value.lockRate, true);
    assert.equal(option('5%')?.getAttribute('aria-pressed'), 'true');
    assert.match(host.textContent ?? '', /提高音量 5 个百分点/);
    assert.match(host.textContent ?? '', /降低音量 5 个百分点/);
    await click(option('20%')!);
    assert.equal(value.volumeStep, 20);
    assert.match(host.textContent ?? '', /提高音量 20 个百分点/);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
