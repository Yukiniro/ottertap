import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { downloadSettingsBackup, parseSettingsBackup, readExtensionVersion, serializeSettings, settingsBackupErrors, settingsBackupFilename, settingsBackupFormat, settingsBackupVersion } from '../lib/settings-backup';
import { normalizeSettings } from '../lib/settings';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

const sample = (): Settings => normalizeSettings({
  theme: 'dark',
  floating: false,
  floatingPosition: { side: 'left', y: 0.25 },
  siteMode: 'allow',
  sites: ['bilibili.com', 'youtube.com'],
  sitePrefs: { 'bilibili.com': { volume: 1.5, rate: 1.25 }, 'youtube.com': { rate: 1.5 } },
  ratePresets: [1.25, 1.75, 2],
  lockRate: true
});

test('导出的设置可以原样导入回来', () => {
  const settings = sample();
  const text = serializeSettings(settings, '1.5.0');
  const file = JSON.parse(text) as { format: string; version: number; extensionVersion: string; settings: Settings };
  assert.equal(file.format, settingsBackupFormat);
  assert.equal(file.version, settingsBackupVersion);
  assert.equal(file.extensionVersion, '1.5.0');
  assert.equal(settingsBackupFilename(new Date(2026, 9, 20, 23, 30)), 'ottertap-settings-2026-10-20.json');
  const parsed = parseSettingsBackup(text);
  assert.deepEqual(parsed, { ok: true, settings });
  if (!parsed.ok) return;
  assert.deepEqual(parseSettingsBackup(serializeSettings(parsed.settings, '1.5.0')), parsed);
});

test('坏文件、旧版本、新版本和未知字段不会产生可写入的坏数据', () => {
  const settings = sample();
  const dirty = JSON.parse(serializeSettings(settings, '1.5.0')) as Record<string, unknown>;
  dirty.note = 'kept out of storage';
  const payload = dirty.settings as Record<string, unknown>;
  payload.theme = 'neon';
  payload.futureFlag = true;
  payload.sites = ['not a domain', 'https://www.YouTube.com/watch?v=1', 12, 'bilibili.com'];
  payload.sitePrefs = { 'bad host': { volume: 0.4 }, 'example.com': { volume: 9, rate: 1.5 }, 'v.qq.com': { volume: 0.8, boost: true } };
  const cleaned = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(cleaned.ok, true);
  if (!cleaned.ok) return;
  assert.equal(cleaned.settings.theme, 'system');
  assert.deepEqual(cleaned.settings.sites, ['www.youtube.com', 'bilibili.com']);
  assert.deepEqual(cleaned.settings.sitePrefs, { 'example.com': { rate: 1.5 }, 'v.qq.com': { volume: 0.8 } });
  assert.equal('futureFlag' in cleaned.settings, false);
  assert.equal(cleaned.settings.lockRate, true);
  assert.deepEqual(cleaned.settings.floatingPosition, settings.floatingPosition);

  assert.deepEqual(parseSettingsBackup('not json'), { ok: false, error: settingsBackupErrors.invalidJson });
  assert.deepEqual(parseSettingsBackup('[]'), { ok: false, error: settingsBackupErrors.notOttertap });
  assert.deepEqual(parseSettingsBackup(JSON.stringify({ format: 'other-app', version: 1, settings })), { ok: false, error: settingsBackupErrors.notOttertap });
  assert.deepEqual(parseSettingsBackup(JSON.stringify({ format: settingsBackupFormat, version: '1', settings })), { ok: false, error: settingsBackupErrors.notOttertap });
  assert.deepEqual(parseSettingsBackup(JSON.stringify({ format: settingsBackupFormat, version: 2, settings })), { ok: false, error: settingsBackupErrors.versionTooNew });
  assert.deepEqual(parseSettingsBackup(JSON.stringify({ format: settingsBackupFormat, version: 0, settings })), { ok: false, error: settingsBackupErrors.versionTooOld });
  assert.deepEqual(normalizeSettings(settings), settings);
});

test('扩展版本只从本地运行时读取', () => {
  const scope = globalThis as { chrome?: { i18n?: unknown; runtime?: { getManifest?: () => { version?: string } } } };
  const previous = scope.chrome;
  scope.chrome = { ...previous, runtime: { getManifest: () => ({ version: '1.5.0' }) } };
  try { assert.equal(readExtensionVersion(), '1.5.0'); }
  finally { scope.chrome = previous; }
});

test('导入前确认才会覆盖设置，坏文件保持原样', async () => {
  const window = new Window({ url: 'https://example.com/options' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver', 'File', 'Blob', 'URL'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { SettingsPage } = await import('../components/settings-page');
  let value: Settings = { ...defaultSettings, theme: 'light', sites: ['bilibili.com'], lockRate: true };
  const seen: Settings[] = [];
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; seen.push(next); listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const button = (label: string) => [...host.querySelectorAll('button')].find(item => item.textContent === label);
  const click = async (element: { click(): void }) => { await act(async () => { element.click(); }); };
  const choose = async (contents: string) => {
    const input = host.querySelector('input[type="file"]') as unknown as { files: unknown; dispatchEvent(event: Event): void };
    const file = new File([contents], 'ottertap-settings.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { configurable: true, value: { 0: file, length: 1, item: () => file } });
    await act(async () => { input.dispatchEvent(new window.Event('change', { bubbles: true }) as unknown as Event); });
  };
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
    assert.ok(host.querySelector('#backup'));
    assert.equal(host.querySelector('a[href="#backup"]')!.textContent, '备份与恢复');
    const downloads: string[] = [];
    const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = (blob: Blob) => { downloads.push('blob'); return createObjectURL.call(URL, blob); };
    await click(button('导出设置')!);
    assert.equal(downloads.length, 1);
    const exported = serializeSettings(value, readExtensionVersion());
    assert.match(exported, /"theme": "light"/);
    const imported = normalizeSettings({ ...sample(), theme: 'dark', sites: ['youtube.com'] });
    await choose(serializeSettings(imported, '9.9.9'));
    assert.equal(value.theme, 'light');
    assert.deepEqual(value.sites, ['bilibili.com']);
    assert.ok(button('确认导入'));
    await click(button('取消')!);
    assert.equal(value.theme, 'light');
    assert.equal(value.lockRate, true);
    assert.equal(button('确认导入'), undefined);
    await choose(serializeSettings(imported, '9.9.9'));
    await click(button('确认导入')!);
    assert.equal(value.theme, 'dark');
    assert.equal(value.floating, false);
    assert.deepEqual(value.sites, ['youtube.com']);
    assert.equal(value.lockRate, true);
    assert.equal(seen.at(-1)?.theme, 'dark');
    assert.doesNotMatch(host.textContent!, /确认导入/);
    const beforeBad = JSON.stringify(value);
    await choose('{');
    assert.equal(JSON.stringify(value), beforeBad);
    assert.match(host.textContent!, /不是有效的 JSON/);
    assert.equal(button('确认导入'), undefined);
    await choose(JSON.stringify({ format: 'other', version: 1, settings: imported }));
    assert.match(host.textContent!, /不是小獭导出的设置/);
    assert.equal(JSON.stringify(value), beforeBad);
    await choose(JSON.stringify({ format: settingsBackupFormat, version: 2, settings: imported }));
    assert.match(host.textContent!, /更新版本/);
    await choose(JSON.stringify({ format: settingsBackupFormat, version: 0, settings: imported }));
    assert.match(host.textContent!, /旧版导出格式/);
    assert.equal(JSON.stringify(value), beforeBad);
    const filename = downloadSettingsBackup(value, '1.5.0', new Date(2026, 9, 20));
    assert.equal(filename, 'ottertap-settings-2026-10-20.json');
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
