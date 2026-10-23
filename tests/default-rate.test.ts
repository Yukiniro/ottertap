import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { createSitePrefSession, normalizeDefaultRate, normalizeSettings } from '../lib/settings';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

test('默认倍速缺省是跟随网页，合法数字吸到 0.25 网格，非法值回到 null', () => {
  assert.equal(defaultSettings.defaultRate, null);
  assert.equal(normalizeSettings(null).defaultRate, null);
  assert.equal(normalizeSettings({}).defaultRate, null, '老设置没有这一项时仍跟随网页');
  assert.equal(normalizeDefaultRate(undefined), null);
  assert.equal(normalizeDefaultRate(null), null);
  for (const rate of [0.25, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4]) assert.equal(normalizeSettings({ defaultRate: rate }).defaultRate, rate);
  assert.equal(normalizeSettings({ defaultRate: 1.1 }).defaultRate, 1, '1.1 吸到 1');
  assert.equal(normalizeSettings({ defaultRate: 1.2 }).defaultRate, 1.25, '1.2 吸到 1.25');
  assert.equal(normalizeSettings({ defaultRate: 1.125 }).defaultRate, 1.25);
  assert.equal(normalizeSettings({ defaultRate: 8 }).defaultRate, 4, '超过上限夹到 4');
  assert.equal(normalizeSettings({ defaultRate: 0.1 }).defaultRate, 0.25, '低于下限夹到 0.25');
  for (const value of ['1.5', true, false, Number.NaN, Number.POSITIVE_INFINITY, {}, []]) {
    assert.equal(normalizeSettings({ defaultRate: value }).defaultRate, null, String(value));
  }
});

test('导出和导入带着默认倍速，非法导入回到跟随网页', () => {
  const settings = normalizeSettings({ ...defaultSettings, defaultRate: 1.5, lockRate: true });
  const text = serializeSettings(settings, '1.7.0');
  assert.match(text, /"defaultRate": 1.5/);
  const parsed = parseSettingsBackup(text);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.settings.defaultRate, 1.5);
  assert.equal(parsed.settings.lockRate, true);
  const dirty = JSON.parse(text) as { settings: { defaultRate?: unknown } };
  dirty.settings.defaultRate = 'fast';
  const cleaned = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(cleaned.ok && cleaned.settings.defaultRate, null);
  delete dirty.settings.defaultRate;
  const legacy = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(legacy.ok && legacy.settings.defaultRate, null, '旧备份没有这一项时跟随网页');
});

test('没有站点倍速时全局默认只应用一次，站点倍速优先，null 什么都不做', () => {
  const session = createSitePrefSession();
  assert.deepEqual(session.plan('example.com', '0:1', {}, null), []);
  assert.deepEqual(session.plan('example.com', '0:1', {}, 1.5), [], '同一媒体已经看过，后改的默认值不再补上');
  const fresh = createSitePrefSession();
  assert.deepEqual(fresh.plan('example.com', '0:1', {}, 1.5), [{ type: 'rate', value: 1.5 }]);
  assert.deepEqual(fresh.plan('example.com', '0:1', { 'example.com': { rate: 2 } }, 1.5), []);
  assert.deepEqual(fresh.plan('example.com', '0:2', {}, 1.5), [{ type: 'rate', value: 1.5 }], '另一段媒体各自应用一次');
  assert.deepEqual(fresh.plan('example.com', '0:2', {}, 1.5), []);
  const remembered = createSitePrefSession();
  assert.deepEqual(remembered.plan('www.bilibili.com', '0:1', { 'bilibili.com': { rate: 2 } }, 1.5), [{ type: 'rate', value: 2 }]);
  assert.deepEqual(remembered.plan('www.bilibili.com', '0:3', { 'bilibili.com': { volume: .4, channel: 'left' } }, 1.5), [
    { type: 'volume', value: .4 },
    { type: 'rate', value: 1.5 },
    { type: 'channel', value: 'left' }
  ]);
  assert.deepEqual(createSitePrefSession().plan('example.com', '0:1', {}, null), []);
  fresh.reset();
  assert.deepEqual(fresh.plan('example.com', '0:1', {}, 1.5), [{ type: 'rate', value: 1.5 }]);
});

test('设置页播放分区可以选择跟随网页或默认倍速，并立刻保存', async () => {
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
    assert.match(playback.textContent ?? '', /默认倍速/);
    assert.match(playback.textContent ?? '', /打开还没有记住倍速的网站时，新媒体会应用一次这个倍速/);
    const defaultGroup = host.querySelector('#default-rate-label')!.parentElement!;
    const inDefault = (label: string) => [...defaultGroup.querySelectorAll('button')].find(item => item.textContent === label);
    assert.equal(option('跟随网页')?.getAttribute('aria-pressed'), 'true');
    assert.equal(inDefault('1.5×')?.getAttribute('aria-pressed'), 'false');
    await click(inDefault('1.5×')!);
    assert.equal(value.defaultRate, 1.5);
    assert.equal(value.lockRate, true);
    assert.equal(inDefault('1.5×')?.getAttribute('aria-pressed'), 'true');
    assert.equal(option('跟随网页')?.getAttribute('aria-pressed'), 'false');
    await click(option('跟随网页')!);
    assert.equal(value.defaultRate, null);
    assert.equal(value.lockRate, true);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
