import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { nextRate } from '../lib/rate';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { normalizeSettings } from '../lib/settings';
import { defaultSettings, type MediaClient, type MediaCommand, type MediaState, type Settings, type SettingsStore } from '../lib/types';

const times = '\u00d7';

describe('倍速增减步长', () => {
  test('只接受 0.1、0.25、0.5，缺省和非法值回到 0.25，并停在 0.25× 与 4×', () => {
    assert.equal(defaultSettings.rateStep, 0.25);
    assert.equal(normalizeSettings(null).rateStep, 0.25);
    assert.equal(normalizeSettings({}).rateStep, 0.25, '老用户没有这一项时仍是 0.25');
    for (const step of [0.1, 0.25, 0.5]) assert.equal(normalizeSettings({ rateStep: step }).rateStep, step);
    for (const step of [0, 0.2, 0.3, 1, 0.2500001, -0.25, '0.25', true, null]) {
      assert.equal(normalizeSettings({ rateStep: step }).rateStep, 0.25, String(step));
    }
    assert.equal(nextRate(1, 1), 1.25, '不传步长时仍按 0.25');
    assert.equal(nextRate(1, -1), 0.75);
    assert.equal(nextRate(1, 1, null, 0.1), 1.1);
    assert.equal(nextRate(1.1, -1, null, 0.1), 1);
    assert.equal(nextRate(1.25, 1, null, 0.1), 1.3, '不在 0.1 格子上时先对齐再走');
    assert.equal(nextRate(1.25, -1, null, 0.1), 1.2);
    assert.equal(nextRate(1, 1, null, 0.5), 1.5);
    assert.equal(nextRate(1.25, 1, null, 0.5), 1.5);
    assert.equal(nextRate(1.25, -1, null, 0.5), 1);
    assert.equal(nextRate(0.25, -1, null, 0.1), 0.25);
    assert.equal(nextRate(0.25, 1, null, 0.1), 0.3);
    assert.equal(nextRate(4, 1, null, 0.1), 4);
    assert.equal(nextRate(3.95, 1, null, 0.1), 4);
    assert.equal(nextRate(4, -1, null, 0.5), 3.5);
    assert.equal(nextRate(1, 1, null, 0.2), 1.25, '非法步长按 0.25');
    assert.equal(nextRate(1.5, 0, 2, 0.1), 1, '来回切换不吃步长');
  });

  test('导出和导入带着倍速步长，非法导入回到 0.25', () => {
    const settings = normalizeSettings({ ...defaultSettings, rateStep: 0.1 });
    const text = serializeSettings(settings, '1.7.0');
    assert.match(text, /"rateStep": 0.1/);
    const parsed = parseSettingsBackup(text);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.settings.rateStep, 0.1);
    const dirty = JSON.parse(text) as { settings: { rateStep?: unknown } };
    dirty.settings.rateStep = 0.2;
    const cleaned = parseSettingsBackup(JSON.stringify(dirty));
    assert.equal(cleaned.ok && cleaned.settings.rateStep, 0.25);
    delete dirty.settings.rateStep;
    const legacy = parseSettingsBackup(JSON.stringify(dirty));
    assert.equal(legacy.ok && legacy.settings.rateStep, 0.25);
  });

  test('设置页播放分区用分段选择立即保存倍速步长', async () => {
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
      assert.match(playback.textContent ?? '', /倍速增减步长/);
      assert.match(playback.textContent ?? '', /页内快捷键、弹出面板的加快和减慢，以及浏览器扩展命令都按这个步长调整倍速/);
      assert.equal(option(`0.25${times}`)?.getAttribute('aria-pressed'), 'true');
      assert.equal(option(`0.1${times}`)?.getAttribute('aria-pressed'), 'false');
      assert.match(host.textContent ?? '', new RegExp(`加快 0\\.25${times}`));
      await click(option(`0.1${times}`)!);
      assert.equal(value.rateStep, 0.1);
      assert.equal(value.skipSeconds, 10);
      assert.equal(value.volumeStep, 10);
      assert.equal(value.lockRate, true);
      assert.equal(option(`0.1${times}`)?.getAttribute('aria-pressed'), 'true');
      assert.match(host.textContent ?? '', new RegExp(`加快 0\\.1${times}`));
      assert.match(host.textContent ?? '', new RegExp(`减慢 0\\.1${times}`));
      await click(option(`0.5${times}`)!);
      assert.equal(value.rateStep, 0.5);
      assert.match(host.textContent ?? '', new RegExp(`加快 0\\.5${times}`));
    } finally {
      await act(async () => { root.unmount(); });
      await window.happyDOM.close();
    }
  });

  test('弹出面板加快和减慢使用同一倍速步长，并停在上下限', async () => {
    const window = new Window({ url: 'https://example.com' });
    for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
      Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
    }
    for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
    const { createRoot } = await import('react-dom/client');
    const { ThemeProvider } = await import('../components/theme');
    const { MediaPanel } = await import('../components/media-panel');
    const media: MediaState = { id: '1', host: 'example.com', label: '', title: '正片', kind: 'video', volume: .5, maxVolume: 1, muted: false, paused: true, rate: 1, currentTime: 10, duration: 120, live: false, seekable: [{ start: 0, end: 120 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };
    const sent: MediaCommand[] = [];
    const client: MediaClient = {
      async read() { return { enabled: true, host: 'example.com', selectedId: '1', media: [{ ...media }] }; },
      async command(_, command) {
        sent.push(command);
        if (command.type === 'rate') media.rate = command.value;
      },
      async select() {},
      async highlight() {}
    };
    let value: Settings = { ...defaultSettings, rateStep: 0.25 };
    const listeners = new Set<(settings: Settings) => void>();
    const store: SettingsStore = {
      async load() { return value; },
      async save(next) { value = next; listeners.forEach(listener => listener(next)); },
      watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
    };
    const host = window.document.createElement('div');
    window.document.body.append(host);
    const root = createRoot(host as unknown as HTMLElement);
    const button = (label: string) => host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
    const click = async (element: HTMLButtonElement) => { await act(async () => { element.click(); }); };
    let generation = 0;
    const show = () => act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { key: ++generation, client, openSettings() {} }) })); });
    try {
      await show();
      const faster = button(`加快 0.25${times}`);
      const slower = button(`减慢 0.25${times}`);
      assert.ok(faster);
      assert.ok(slower);
      assert.equal(faster.disabled, false);
      await click(faster);
      assert.deepEqual(sent.at(-1), { type: 'rate', value: 1.25 });
      value = { ...value, rateStep: 0.1 };
      await act(async () => { listeners.forEach(listener => listener(value)); });
      const finer = button(`加快 0.1${times}`);
      assert.ok(finer);
      assert.equal(button(`加快 0.25${times}`), null);
      await click(finer);
      assert.deepEqual(sent.at(-1), { type: 'rate', value: 1.3 });
      media.rate = 4;
      value = { ...value, rateStep: 0.1 };
      await act(async () => { listeners.forEach(listener => listener(value)); });
      await show();
      assert.equal(button(`加快 0.1${times}`)?.disabled, true);
      assert.equal(button(`减慢 0.1${times}`)?.disabled, false);
      await click(button(`减慢 0.1${times}`)!);
      assert.deepEqual(sent.at(-1), { type: 'rate', value: 3.9 });
      media.rate = 0.25;
      value = { ...value, rateStep: 0.5 };
      await act(async () => { listeners.forEach(listener => listener(value)); });
      await show();
      assert.equal(button(`减慢 0.5${times}`)?.disabled, true);
      await click(button(`加快 0.5${times}`)!);
      assert.deepEqual(sent.at(-1), { type: 'rate', value: 0.5 });
    } finally {
      await act(async () => { root.unmount(); });
      await window.happyDOM.close();
    }
  });
});
