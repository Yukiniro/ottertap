import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { mergeSettingsChange, normalizeSettings } from '../lib/settings';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

test('临近提示默认开，坏值回到开，导出导入带上关闭', () => {
  assert.equal(defaultSettings.sleepSoonHint, true);
  assert.equal(normalizeSettings({}).sleepSoonHint, true);
  assert.equal(normalizeSettings({ sleepSoonHint: false }).sleepSoonHint, false);
  assert.equal(normalizeSettings({ sleepSoonHint: 'off' }).sleepSoonHint, true);
  assert.equal(normalizeSettings({ sleepSoonHint: 0 }).sleepSoonHint, true);
  const off = { ...defaultSettings, sleepSoonHint: false, theme: 'dark' as const };
  const text = serializeSettings(off, '1.9.0');
  assert.match(text, /"sleepSoonHint": false/);
  const restored = parseSettingsBackup(text);
  assert.equal(restored.ok, true);
  if (!restored.ok) return;
  assert.equal(restored.settings.sleepSoonHint, false);
  assert.equal(restored.settings.theme, 'dark');
  const older = parseSettingsBackup(JSON.stringify({ format: 'ottertap-settings', version: 1, extensionVersion: '1.8.0', settings: { theme: 'dark', floating: false } }));
  assert.equal(older.ok, true);
  if (!older.ok) return;
  assert.equal(older.settings.sleepSoonHint, true, '旧备份没有这个键时保持默认开');
  assert.equal(older.settings.floating, false, '旧备份的其他字段还在');
  const merged = mergeSettingsChange(defaultSettings, defaultSettings, { ...defaultSettings, sleepSoonHint: false });
  assert.equal(merged.sleepSoonHint, false);
  assert.equal(merged.followPlaying, true);
});

test('设置页播放区可以关掉临近提示，并写进设置', async () => {
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
    const toggle = () => host.querySelector('[role="switch"][aria-label="临近结束前提示"]');
    assert.ok(toggle(), '播放区应有临近提示开关');
    assert.equal(toggle()!.getAttribute('aria-checked'), 'true');
    assert.match(host.textContent ?? '', /到期前大约 1 分钟/);
    await click(toggle() as unknown as { click(): void });
    assert.equal(value.sleepSoonHint, false);
    assert.equal(toggle()!.getAttribute('aria-checked'), 'false');
    assert.equal(value.followPlaying, true, '关掉临近提示不改别的播放设置');
    const exported = serializeSettings(value, '1.9.0');
    assert.match(exported, /"sleepSoonHint": false/);
    await click(toggle() as unknown as { click(): void });
    assert.equal(value.sleepSoonHint, true);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
