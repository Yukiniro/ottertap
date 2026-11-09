import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { mergeSettingsChange, normalizeSettings } from '../lib/settings';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

test('自动静音其他默认关，坏值和旧备份保持关，导出带上打开', () => {
  assert.strictEqual(defaultSettings.autoMuteOthers, false);
  assert.strictEqual(normalizeSettings(null).autoMuteOthers, false);
  assert.strictEqual(normalizeSettings({}).autoMuteOthers, false);
  assert.strictEqual(normalizeSettings({ autoMuteOthers: true }).autoMuteOthers, true);
  for (const value of ['yes', 1, 0, null, false]) assert.strictEqual(normalizeSettings({ autoMuteOthers: value }).autoMuteOthers, value === true, String(value));
  const on = { ...defaultSettings, autoMuteOthers: true, theme: 'dark' as const };
  const text = serializeSettings(on, '1.9.0');
  assert.match(text, /"autoMuteOthers": true/);
  const restored = parseSettingsBackup(text);
  assert.strictEqual(restored.ok, true);
  if (!restored.ok) return;
  assert.strictEqual(restored.settings.autoMuteOthers, true);
  assert.strictEqual(restored.settings.theme, 'dark');
  const older = parseSettingsBackup(JSON.stringify({ format: 'ottertap-settings', version: 1, extensionVersion: '1.8.0', settings: { theme: 'dark', floating: false } }));
  assert.strictEqual(older.ok, true);
  if (!older.ok) return;
  assert.strictEqual(older.settings.autoMuteOthers, false, '旧备份没有这个键时保持默认关');
  assert.strictEqual(older.settings.floating, false, '旧备份的其他字段还在');
  const merged = mergeSettingsChange(defaultSettings, defaultSettings, { ...defaultSettings, autoMuteOthers: true });
  assert.strictEqual(merged.autoMuteOthers, true);
  assert.strictEqual(merged.followPlaying, true);
});

test('设置页播放区可以打开自动静音其他，并只改这一项', async () => {
  const window = new Window({ url: 'https://example.com/options' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'FocusEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { SettingsPage } = await import('../components/settings-page');
  let value: Settings = { ...defaultSettings };
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const click = async (element: { click(): void }) => { await act(async () => { element.click(); }); };
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
    const playback = host.querySelector('#playback');
    assert.ok(playback);
    const toggle = playback.querySelector('[role="switch"][aria-label="当前媒体开始播放时自动静音其他标签"]');
    assert.ok(toggle);
    assert.strictEqual(toggle.getAttribute('aria-checked'), 'false');
    const description = playback.querySelector(`#${toggle.getAttribute('aria-describedby')}`);
    assert.ok(description);
    assert.match(description.textContent ?? '', /其他正在出声的标签静音/);
    assert.match(description.textContent ?? '', /不改音量/);
    await click(toggle as unknown as { click(): void });
    assert.strictEqual(value.autoMuteOthers, true);
    assert.strictEqual(toggle.getAttribute('aria-checked'), 'true');
    assert.strictEqual(value.followPlaying, true, '打开自动静音不改跟随播放');
    assert.match(serializeSettings(value, '1.9.0'), /"autoMuteOthers": true/);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
