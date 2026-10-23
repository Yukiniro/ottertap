import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, mock, test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { readFlatMessages } from '../lib/message-catalog';
import { defaultSettings, type MediaClient, type MediaCommand, type MediaState, type Settings, type SettingsStore } from '../lib/types';

const messages = readFlatMessages(readFileSync(new URL('../locales/zh_CN.yml', import.meta.url), 'utf8'));
// `@wxt-dev/browser` snapshots globalThis the first time i18n loads. Install the fake browser before that import.
fakeBrowser.i18n.getMessage = (name: string) => messages[name] ?? '';
Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });

const media = { id: '1', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 2 } as MediaState;

describe('步长随倍速放大', { concurrency: false }, () => {
  test('页内快捷键和扩展命令按当前倍速跳，提示是实际秒数', async () => {
    const listeners: Array<(command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void> = [];
    const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void): void } };
    const original = commands.onCommand;
    commands.onCommand = { addListener(callback) { listeners.push(callback); } };
    await fakeBrowser.windows.create({ focused: true });
    const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
    const applied: MediaCommand[] = [];
    const hints: Array<{ key?: string; seconds?: number }> = [];
    let rate = 2;
    const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string; command?: MediaCommand; key?: string; seconds?: number }) => {
      if (message.type === 'snapshot') return { media: [{ id: '1', paused: false, muted: false, volume: 1, maxVolume: 1, rate }] };
      if (message.type === 'actionHint') hints.push({ key: message.key, seconds: message.seconds });
      if (message.type === 'command' && message.command) applied.push(message.command);
      return { ok: true };
    });
    try {
      const background = await import('../entrypoints/background');
      background.default.main();
      const fire = (name: string) => Promise.all(listeners.map(listener => listener(name)));
      const sender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
      const hotkey = (delta: number) => new Promise<unknown>(resolve => {
        void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', type: 'hotkey', action: { type: 'skip', delta } }, sender, resolve);
      });

      await fire('skip-forward');
      assert.deepEqual(applied.at(-1), { type: 'skip', value: 10 }, '关闭时 2× 仍跳 10 秒');
      assert.deepEqual(hints.at(-1), { key: 'skipForward', seconds: 10 });
      await hotkey(-10);
      assert.deepEqual(applied.at(-1), { type: 'skip', value: -10 });
      assert.deepEqual(hints.at(-1), { key: 'skipBack', seconds: 10 });

      await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, skipWithRate: true } });
      await fire('skip-forward');
      assert.deepEqual(applied.at(-1), { type: 'skip', value: 20 });
      assert.deepEqual(hints.at(-1), { key: 'skipForward', seconds: 20 });
      await hotkey(-10);
      assert.deepEqual(applied.at(-1), { type: 'skip', value: -20 });
      assert.deepEqual(hints.at(-1), { key: 'skipBack', seconds: 20 });

      rate = 4;
      await hotkey(10);
      assert.deepEqual(applied.at(-1), { type: 'skip', value: 30 });
      assert.deepEqual(hints.at(-1), { key: 'skipForward', seconds: 30 });
      rate = 0.25;
      await fire('skip-back');
      assert.deepEqual(applied.at(-1), { type: 'skip', value: -5 });
      assert.deepEqual(hints.at(-1), { key: 'skipBack', seconds: 5 });

      rate = 1.25;
      await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, skipWithRate: true, skipSeconds: 10 } });
      await hotkey(10);
      assert.deepEqual(applied.at(-1), { type: 'skip', value: 13 });
      assert.deepEqual(hints.at(-1), { key: 'skipForward', seconds: 13 });

      const before = applied.length;
      const rejected = await hotkey(20) as { error?: string };
      assert.equal(applied.length, before, '页内消息仍只接受配置步长，放大在后台做');
      assert.match(rejected.error ?? '', /./);

      rate = 2;
      await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, skipWithRate: 'yes', skipSeconds: 10 } });
      await fire('skip-forward');
      assert.deepEqual(applied.at(-1), { type: 'skip', value: 10 }, '非法开关回到关闭');
      const legacy = { ...defaultSettings } as Partial<typeof defaultSettings>;
      delete legacy.skipWithRate;
      await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': legacy });
      await hotkey(10);
      assert.deepEqual(applied.at(-1), { type: 'skip', value: 10 }, '没有这一项的旧设置不放大');
    } finally {
      commands.onCommand = original;
      sendMessage.mock.restore();
      fakeBrowser.reset();
      fakeBrowser.i18n.getMessage = (name: string) => messages[name] ?? '';
      delete (globalThis as { browser?: unknown }).browser;
    }
  });

  test('关闭时仍是配置步长，开启后按倍速放大并夹在 0.5× 到 3×', async () => {
    const { actionHintText, applySkipStep, commandForHotkey, planHotkey } = await import('../lib/hotkey');
    const { actualSkipSeconds, hintSkipSeconds, maxSkipRate, minSkipRate } = await import('../lib/skip');
    assert.equal(defaultSettings.skipWithRate, false);
    assert.equal(minSkipRate, 0.5);
    assert.equal(maxSkipRate, 3);
    assert.equal(actualSkipSeconds(10, 2, false), 10);
    assert.equal(actualSkipSeconds(30, 4, false), 30);
    assert.equal(actualSkipSeconds(10, 2, true), 20);
    assert.equal(actualSkipSeconds(10, 1, true), 10);
    assert.equal(actualSkipSeconds(10, 1.5, true), 15);
    assert.equal(actualSkipSeconds(10, 1.25, true), 13);
    assert.equal(actualSkipSeconds(15, 1.5, true), 23);
    assert.equal(actualSkipSeconds(10, 0.25, true), 5);
    assert.equal(actualSkipSeconds(5, 0.5, true), 3);
    assert.equal(actualSkipSeconds(10, 4, true), 30);
    assert.equal(actualSkipSeconds(30, 4, true), 90);
    assert.equal(actualSkipSeconds(10, -2, true), 20);
    assert.equal(actualSkipSeconds(10, 0, true), 10);
    assert.equal(actualSkipSeconds(10, Number.NaN, true), 10);
    assert.equal(actualSkipSeconds(8, 2, true), 20, '非法步长先回到 10 再乘倍速');
    assert.equal(hintSkipSeconds(20), 20);
    assert.equal(hintSkipSeconds(13), 13);
    assert.equal(hintSkipSeconds(3), 3);
    assert.equal(hintSkipSeconds(90), 90);
    assert.equal(hintSkipSeconds(2), 10);
    assert.equal(hintSkipSeconds(91), 10);
    assert.equal(hintSkipSeconds(12.5), 10);
    assert.equal(actionHintText('skipForward', 20), '前进 20 秒');
    assert.equal(actionHintText('skipBack', 5), '后退 5 秒');
    assert.equal(actionHintText('skipBack', 200), '后退 10 秒');

    assert.deepEqual(commandForHotkey({ type: 'skip', delta: 10 }, media), { type: 'skip', value: 10 });
    assert.deepEqual(commandForHotkey({ type: 'skip', delta: -10 }, media, null, undefined, true), { type: 'skip', value: -20 });
    assert.deepEqual(commandForHotkey(applySkipStep({ type: 'skip', delta: 1 }, 10), { ...media, rate: 4 }, null, undefined, true), { type: 'skip', value: 30 });
    const page = { host: 'example.com', enabled: true, selectedId: '1', media: [media] };
    assert.deepEqual(planHotkey(page, { type: 'skip', delta: 10 }, null, undefined, true)?.command, { type: 'skip', value: 20 });
    assert.deepEqual(planHotkey(page, { type: 'skip', delta: 10 })?.command, { type: 'skip', value: 10 });
  });

  test('导出和导入带着开关，缺省和非法值回到关闭', async () => {
    const { normalizeSettings } = await import('../lib/settings');
    const { parseSettingsBackup, serializeSettings } = await import('../lib/settings-backup');
    assert.equal(normalizeSettings(null).skipWithRate, false);
    assert.equal(normalizeSettings({}).skipWithRate, false);
    assert.equal(normalizeSettings({ skipWithRate: true }).skipWithRate, true);
    for (const value of ['true', 1, 0, null, false]) assert.equal(normalizeSettings({ skipWithRate: value }).skipWithRate, false, String(value));
    const settings = normalizeSettings({ ...defaultSettings, skipWithRate: true, skipSeconds: 15 });
    const text = serializeSettings(settings, '1.7.0');
    assert.match(text, /"skipWithRate": true/);
    assert.match(text, /"skipSeconds": 15/);
    const parsed = parseSettingsBackup(text);
    assert.equal(parsed.ok && parsed.settings.skipWithRate, true);
    assert.equal(parsed.ok && parsed.settings.skipSeconds, 15);
    const dirty = JSON.parse(text) as { settings: { skipWithRate?: unknown } };
    dirty.settings.skipWithRate = 'yes';
    const cleaned = parseSettingsBackup(JSON.stringify(dirty));
    assert.equal(cleaned.ok && cleaned.settings.skipWithRate, false);
    assert.equal(cleaned.ok && cleaned.settings.skipSeconds, 15);
    delete dirty.settings.skipWithRate;
    const legacy = parseSettingsBackup(JSON.stringify(dirty));
    assert.equal(legacy.ok && legacy.settings.skipWithRate, false);
  });

  test('设置页开关默认关闭，打开后只改这一项', async () => {
    const window = new Window({ url: 'https://example.com/options' });
    for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
      Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
    }
    for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
    const { createRoot } = await import('react-dom/client');
    const { ThemeProvider } = await import('../components/theme');
    const { SettingsPage } = await import('../components/settings-page');
    let value: Settings = { ...defaultSettings, theme: 'light', skipSeconds: 15 };
    const listeners = new Set<(settings: Settings) => void>();
    const store: SettingsStore = {
      async load() { return value; },
      async save(next) { value = next; listeners.forEach(listener => listener(next)); },
      watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
    };
    const host = window.document.createElement('div');
    window.document.body.append(host);
    const root = createRoot(host as unknown as HTMLElement);
    const click = async (element: Element) => { await act(async () => { (element as HTMLElement).click(); }); };
    try {
      await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
      const toggle = host.querySelector('[role="switch"][aria-label="步长随倍速放大"]');
      assert.ok(toggle);
      assert.equal(toggle.getAttribute('aria-checked'), 'false');
      assert.match(host.querySelector('#playback')?.textContent ?? '', /10 秒在 2 倍速下大约跳 20 秒/);
      await click(toggle as unknown as Element);
      assert.equal(value.skipWithRate, true);
      assert.equal(value.skipSeconds, 15);
      assert.equal(value.theme, 'light');
      assert.equal(toggle.getAttribute('aria-checked'), 'true');
    } finally {
      await act(async () => { root.unmount(); });
      await window.happyDOM.close();
    }
  });

  test('弹出面板的角标、名称和跳转秒数跟着实际秒数变', async () => {
    const window = new Window({ url: 'https://example.com' });
    for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
      Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
    }
    for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
    const { createRoot } = await import('react-dom/client');
    const { ThemeProvider } = await import('../components/theme');
    const { MediaPanel } = await import('../components/media-panel');
    const clip: MediaState = { id: '1', host: 'example.com', label: '', title: '正片', kind: 'video', volume: .5, maxVolume: 1, muted: false, paused: true, rate: 2, currentTime: 40, duration: 120, live: false, seekable: [{ start: 0, end: 120 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };
    const sent: MediaCommand[] = [];
    const client: MediaClient = {
      async read() { return { enabled: true, host: 'example.com', selectedId: '1', media: [clip] }; },
      async command(_, command) { sent.push(command); },
      async select() {},
      async highlight() {}
    };
    let value: Settings = { ...defaultSettings, skipSeconds: 10 };
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
    try {
      await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { client, openSettings() {} }) })); });
      assert.equal(button('前进 10 秒')?.querySelector('span')?.textContent, '10');
      await click(button('前进 10 秒')!);
      assert.deepEqual(sent.at(-1), { type: 'skip', value: 10 });
      value = { ...value, skipWithRate: true };
      await act(async () => { listeners.forEach(listener => listener(value)); });
      assert.equal(button('前进 20 秒')?.querySelector('span')?.textContent, '20');
      assert.equal(button('后退 20 秒')?.querySelector('span')?.textContent, '20');
      assert.equal(button('前进 10 秒'), null);
      await click(button('后退 20 秒')!);
      assert.deepEqual(sent.at(-1), { type: 'skip', value: -20 });
      clip.rate = 4;
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 900)); });
      assert.equal(button('前进 30 秒')?.querySelector('span')?.textContent, '30');
      await click(button('前进 30 秒')!);
      assert.deepEqual(sent.at(-1), { type: 'skip', value: 30 });
    } finally {
      await act(async () => { root.unmount(); });
      await window.happyDOM.close();
    }
  });
});
