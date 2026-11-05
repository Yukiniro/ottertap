import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { maxGain } from '../lib/amplifier';
import { floatingEntryNote } from '../lib/floating-note';
import { mediaPresenceEvent } from '../lib/media';
import { mergeSettingsChange, normalizeSettings } from '../lib/settings';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { sleepRemainingSeconds } from '../lib/sleep-timer';
import { defaultSettings, type MediaClient, type MediaState, type Settings, type SettingsStore } from '../lib/types';
import { formatTime } from '../lib/utils';

const left = 12 * 60 + 4;

test('睡眠旁注默认关闭，导出导入带上，没有定时时仍按音量或倍速', () => {
  assert.equal(defaultSettings.floatingSleepNote, false);
  assert.equal(normalizeSettings({}).floatingSleepNote, false, '老设置没有这一项时保持关闭');
  assert.equal(normalizeSettings({ floatingSleepNote: true }).floatingSleepNote, true);
  for (const value of ['true', 1, 0, null, false, 'off']) assert.equal(normalizeSettings({ floatingSleepNote: value }).floatingSleepNote, false, String(value));
  assert.equal(sleepRemainingSeconds(undefined, 1_000), 0);
  assert.equal(sleepRemainingSeconds(1_000 + left * 1000, 1_000), left);
  assert.equal(sleepRemainingSeconds(500, 1_000), 0, '已经过去的截止时间不再显示');
  assert.equal(formatTime(left), '12:04');

  const off = floatingEntryNote('volume', 80, 1.25, { show: false, remainingSeconds: left });
  assert.deepEqual(off, { kind: 'volume', text: '80%', boost: false });
  assert.deepEqual(floatingEntryNote('volume', 100, 1, { show: true, remainingSeconds: 0 }), { kind: 'volume', text: '100%', boost: false }, '没有剩余时不改旁注');
  assert.equal(floatingEntryNote('off', 80, 2, { show: true, remainingSeconds: 0 }), null, '关掉旁注且没有定时时仍不显示');
  assert.deepEqual(floatingEntryNote('rate', 40, 2, { show: false, remainingSeconds: left }), { kind: 'rate', text: '2×', boost: false });

  const sleep = floatingEntryNote('volume', 150, 2, { show: true, remainingSeconds: left });
  assert.deepEqual(sleep, { kind: 'sleep', text: '睡 12:04', time: '12:04', boost: false });
  assert.equal(sleep && sleep.kind === 'sleep' && sleep.boost, false, '倒计时不用超过 100% 的强调色');
  assert.deepEqual(floatingEntryNote('off', 150, 2, { show: true, remainingSeconds: left }), { kind: 'sleep', text: '睡 12:04', time: '12:04', boost: false }, '进行中优先于关闭');
  assert.deepEqual(floatingEntryNote('rate', 40, 2, { show: true, remainingSeconds: left }), { kind: 'sleep', text: '睡 12:04', time: '12:04', boost: false });
  assert.deepEqual(floatingEntryNote('volume', 80, 2, { show: true, remainingSeconds: 0 }), { kind: 'volume', text: '80%', boost: false }, '取消后回到原来的音量规则');
  assert.equal(floatingEntryNote('off', 80, 2, { show: true, remainingSeconds: 0 }), null, '取消后关闭仍然不显示');
  assert.deepEqual(floatingEntryNote('rate', 40, 1, { show: true, remainingSeconds: 0 }), { kind: 'rate', text: '1×', boost: false });

  const on = { ...defaultSettings, floatingSleepNote: true, theme: 'dark' as const, floatingNote: 'rate' as const };
  const text = serializeSettings(on, '1.8.0');
  assert.match(text, /"floatingSleepNote": true/);
  const parsed = parseSettingsBackup(text);
  assert.equal(parsed.ok && parsed.settings.floatingSleepNote, true);
  assert.equal(parsed.ok && parsed.settings.floatingNote, 'rate', '导入不改旁注偏好');
  assert.equal(parsed.ok && parsed.settings.theme, 'dark');
  const dirty = JSON.parse(text) as { settings: { floatingSleepNote?: unknown } };
  delete dirty.settings.floatingSleepNote;
  const older = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(older.ok && older.settings.floatingSleepNote, false, '旧备份没有这个键时保持关闭');
  assert.equal(older.ok && older.settings.floatingNote, 'rate');
  const merged = mergeSettingsChange(defaultSettings, defaultSettings, { ...defaultSettings, floatingSleepNote: true });
  assert.equal(merged.floatingSleepNote, true);
  assert.equal(merged.floatingNote, 'volume');
  assert.equal(merged.sleepSoonHint, true, '这一项不改临近提示');
});

test('设置页开关默认关闭，打开后旁注在定时进行中显示倒计时，取消后回到原规则', async () => {
  const window = new Window({ url: 'https://example.com/watch', width: 1280, height: 720 });
  const globals = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'CustomEvent', 'MutationObserver', 'ResizeObserver'] as const;
  for (const name of globals) Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { SettingsPage } = await import('../components/settings-page');
  const { FloatingController } = await import('../components/floating');
  let sleepAt: number | undefined = Date.now() + left * 1000;
  let media: MediaState = { id: '1', title: '测试媒体', label: '测试媒体', host: 'example.com', kind: 'video', paused: false, muted: false, volume: .8, maxVolume: maxGain, rate: 1.25, currentTime: 10, duration: 100, live: false, seekable: [{ start: 0, end: 100 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: '1', media: [{ ...media }], ...(sleepAt == null ? {} : { sleepAt }) }; },
    async command() {},
    async select() {},
    async highlight() {}
  };
  let value: Settings = { ...defaultSettings, theme: 'light' };
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const pageHost = window.document.createElement('div');
  window.document.body.append(pageHost);
  const pageRoot = createRoot(pageHost as unknown as HTMLElement);
  const floatHost = window.document.createElement('div');
  window.document.body.append(floatHost);
  const floatRoot = createRoot(floatHost as unknown as HTMLElement);
  const note = () => floatHost.querySelector('[data-slot="entry-note"]');
  const dock = () => floatHost.querySelector('aside');
  const refresh = async () => {
    window.dispatchEvent(new window.Event(mediaPresenceEvent));
    await new Promise(resolve => setTimeout(resolve, 30));
  };
  const publish = async (next: Settings) => {
    value = next;
    await act(async () => { listeners.forEach(listener => listener(next)); });
  };
  try {
    await act(async () => { pageRoot.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
    const toggle = pageHost.querySelector('[role="switch"][aria-label="睡眠时显示倒计时"]');
    assert.ok(toggle);
    assert.equal(toggle.getAttribute('aria-checked'), 'false');
    assert.match(pageHost.textContent ?? '', /例如「睡 12:04」/);
    assert.match(pageHost.textContent ?? '', /默认关闭/);
    assert.match(pageHost.textContent ?? '', /角标不是一回事/);
    await act(async () => { (toggle as unknown as HTMLElement).click(); });
    assert.equal(value.floatingSleepNote, true);
    assert.equal(value.floatingNote, 'volume');
    assert.equal(value.floating, true);
    assert.deepEqual(value.floatingPosition, { side: 'right', y: .8 }, '开关不改贴边和位置');
    await act(async () => { (toggle as unknown as HTMLElement).click(); });
    assert.equal(value.floatingSleepNote, false);

    await act(async () => { floatRoot.render(createElement(ThemeProvider, { store, children: createElement(FloatingController, { client }) })); });
    await act(refresh);
    assert.equal(dock()?.getAttribute('data-side'), 'right');
    assert.equal(dock()?.getAttribute('data-revealed'), 'false');
    assert.equal(note()?.textContent, '80%');
    assert.equal(note()?.getAttribute('data-kind'), 'volume');
    assert.equal(note()?.getAttribute('aria-label'), '页内音量 80%');

    await publish({ ...value, floatingSleepNote: true });
    assert.equal(note()?.getAttribute('data-kind'), 'sleep');
    assert.match(note()?.textContent ?? '', /^睡 \d{2}:\d{2}$/);
    assert.match(note()?.getAttribute('aria-label') ?? '', /^睡眠还剩 \d{2}:\d{2}$/);
    assert.equal(note()?.getAttribute('data-boost'), 'false');
    assert.equal(dock()?.getAttribute('data-side'), 'right');
    assert.equal(dock()?.getAttribute('data-revealed'), 'false');

    sleepAt = undefined;
    await act(refresh);
    assert.equal(note()?.textContent, '80%');
    assert.equal(note()?.getAttribute('data-kind'), 'volume', '取消后回到优先音量');

    await publish({ ...value, floatingNote: 'off' });
    sleepAt = Date.now() + 90_000;
    await act(refresh);
    assert.match(note()?.textContent ?? '', /^睡 \d{2}:\d{2}$/, '旁注设为关闭时，进行中仍显示倒计时');
    sleepAt = undefined;
    await act(refresh);
    assert.equal(note(), null, '取消后关闭仍然不显示');

    await publish({ ...value, floatingSleepNote: false, floatingNote: 'volume' });
    sleepAt = Date.now() + left * 1000;
    await act(refresh);
    assert.equal(note()?.textContent, '80%', '开关关闭时，定时进行中仍是原来的旁注');
  } finally {
    await act(async () => { pageRoot.unmount(); floatRoot.unmount(); });
    await window.happyDOM.close();
  }
});
