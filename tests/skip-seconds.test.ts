import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { normalizeSettings } from '../lib/settings';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

test('步长只接受 5、10、15、30，缺省和非法值回到 10', () => {
  assert.equal(defaultSettings.skipSeconds, 10);
  assert.equal(normalizeSettings(null).skipSeconds, 10);
  assert.equal(normalizeSettings({}).skipSeconds, 10, '老用户没有这一项时仍是 10 秒');
  for (const seconds of [5, 10, 15, 30]) assert.equal(normalizeSettings({ skipSeconds: seconds }).skipSeconds, seconds);
  for (const seconds of [0, 1, 7, 12, 20, 60, -10, 10.5, '10', true, null]) {
    assert.equal(normalizeSettings({ skipSeconds: seconds }).skipSeconds, 10, String(seconds));
  }
});

test('导出和导入带着步长，非法导入回到 10', () => {
  const settings = normalizeSettings({ ...defaultSettings, skipSeconds: 15 });
  const text = serializeSettings(settings, '1.5.0');
  assert.match(text, /"skipSeconds": 15/);
  const parsed = parseSettingsBackup(text);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.settings.skipSeconds, 15);
  const dirty = JSON.parse(text) as { settings: { skipSeconds?: unknown } };
  dirty.settings.skipSeconds = 12;
  const cleaned = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(cleaned.ok && cleaned.settings.skipSeconds, 10);
  delete dirty.settings.skipSeconds;
  const legacy = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(legacy.ok && legacy.settings.skipSeconds, 10);
});

test('设置页播放分区用分段选择立即保存步长', async () => {
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
    assert.match(playback.textContent ?? '', /快进 \/ 快退步长/);
    assert.match(playback.textContent ?? '', /弹出面板、页面浮动入口、页内快捷键和浏览器快捷键都按这个步长跳转/);
    assert.equal(option('10 秒')?.getAttribute('aria-pressed'), 'true');
    await click(option('15 秒')!);
    assert.equal(value.skipSeconds, 15);
    assert.equal(value.lockRate, true);
    assert.equal(value.theme, 'light');
    assert.equal(option('15 秒')?.getAttribute('aria-pressed'), 'true');
    await click(option('30 秒')!);
    assert.equal(value.skipSeconds, 30);
    assert.match(host.textContent ?? '', /后退 30 秒/);
    assert.match(host.textContent ?? '', /前进 30 秒/);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
