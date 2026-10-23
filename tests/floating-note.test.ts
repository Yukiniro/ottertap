import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { maxGain } from '../lib/amplifier';
import { floatingEntryNote } from '../lib/floating-note';
import { isFloatingNote, normalizeSettings } from '../lib/settings';
import { defaultSettings, type MediaClient, type MediaState, type Settings, type SettingsStore } from '../lib/types';

test('入口旁注默认优先音量，100% 且倍速不是 1× 时改显倍速，设置可改为优先倍速或关闭', () => {
  assert.equal(defaultSettings.floatingNote, 'volume');
  assert.equal(normalizeSettings({}).floatingNote, 'volume', '老设置没有这一项时仍优先音量');
  assert.equal(normalizeSettings({ floatingNote: 'rate' }).floatingNote, 'rate');
  assert.equal(normalizeSettings({ floatingNote: 'off' }).floatingNote, 'off');
  assert.equal(normalizeSettings({ floatingNote: 'badge' }).floatingNote, 'volume');
  assert.equal(isFloatingNote('volume'), true);
  assert.equal(isFloatingNote('toolbar'), false);
  assert.deepEqual(floatingEntryNote('volume', 80, 1), { kind: 'volume', text: '80%', boost: false });
  assert.deepEqual(floatingEntryNote('volume', 100, 1), { kind: 'volume', text: '100%', boost: false });
  assert.deepEqual(floatingEntryNote('volume', 100, 1.25), { kind: 'rate', text: '1.25×', boost: false });
  assert.deepEqual(floatingEntryNote('volume', 80, 2), { kind: 'volume', text: '80%', boost: false });
  assert.deepEqual(floatingEntryNote('volume', 0, 2), { kind: 'volume', text: '0%', boost: false });
  assert.deepEqual(floatingEntryNote('volume', 150, 1), { kind: 'volume', text: '150%', boost: true });
  assert.deepEqual(floatingEntryNote('volume', 110.2, 1.5), { kind: 'volume', text: '110%', boost: true });
  assert.deepEqual(floatingEntryNote('rate', 40, 1), { kind: 'rate', text: '1×', boost: false });
  assert.deepEqual(floatingEntryNote('rate', 180, 2), { kind: 'rate', text: '2×', boost: false });
  assert.equal(floatingEntryNote('off', 180, 2), null);
});

test('收起的浮动入口显示旁注，调音量或倍速后更新，半隐藏时仍在，展开时让开药丸', async () => {
  const window = new Window({ url: 'https://example.com', width: 1280, height: 720 });
  const globals = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'CustomEvent', 'MutationObserver', 'ResizeObserver'] as const;
  for (const name of globals) Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { FloatingController } = await import('../components/floating');
  const times = '×';
  let media: MediaState = { id: '1', title: '测试媒体', label: '测试媒体', host: 'example.com', kind: 'video', paused: false, muted: false, volume: .8, maxVolume: maxGain, rate: 1, currentTime: 10, duration: 100, live: false, seekable: [{ start: 0, end: 100 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: '1', media: [{ ...media }] }; },
    async command(_, value) {
      if (value.type === 'mute') media = { ...media, muted: !media.muted };
      else if (value.type === 'volume') media = { ...media, volume: value.value, muted: false };
      else if (value.type === 'rate') media = { ...media, rate: value.value };
    },
    async select() {},
    async highlight() {}
  };
  let settings: Settings = { ...defaultSettings };
  const listeners = new Set<(value: Settings) => void>();
  const store: SettingsStore = {
    async load() { return settings; },
    async save(next) { settings = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const note = () => host.querySelector('[data-slot="entry-note"]');
  const dock = () => host.querySelector('aside')!;
  const trigger = () => host.querySelector('[data-slot="popover-trigger"]')!;
  const publish = async (next: Settings) => {
    settings = next;
    await act(async () => { listeners.forEach(listener => listener(next)); });
  };
  const volumeEvent = async (percent: number) => {
    await act(async () => { window.dispatchEvent(new window.CustomEvent('ottertap-volume', { detail: percent as unknown as object })); });
  };
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(FloatingController, { client }) })); });
    assert.equal(dock().dataset.revealed, 'false');
    assert.equal(dock().dataset.side, 'right');
    assert.equal(!!host.querySelector('[role="dialog"]'), false);
    assert.equal(note()?.textContent, '80%');
    assert.equal(note()?.getAttribute('aria-label'), '页内音量 80%');
    assert.equal(note()?.getAttribute('data-kind'), 'volume');
    assert.equal(note()?.getAttribute('data-boost'), 'false');
    assert.match(note()?.className ?? '', /right-\[calc\(100%\+6px\)\]/);
    assert.equal(trigger().getAttribute('aria-label'), '打开音量药丸，方向键可移动浮动入口');

    await act(async () => { trigger().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); });
    assert.equal(dock().dataset.side, 'left');
    assert.equal(dock().dataset.revealed, 'false');
    assert.match(note()?.className ?? '', /left-\[calc\(100%\+6px\)\]/);
    assert.equal(note()?.textContent, '80%');

    await volumeEvent(150);
    assert.equal(note()?.textContent, '150%');
    assert.equal(note()?.getAttribute('aria-label'), '页内音量 150%');
    assert.equal(note()?.getAttribute('data-boost'), 'true');
    assert.equal(note()?.getAttribute('aria-label')?.includes('已放大'), false);

    await volumeEvent(100);
    assert.equal(note()?.textContent, '100%');
    assert.equal(note()?.getAttribute('data-boost'), 'false');

    await act(async () => { trigger().dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    assert.equal(trigger().getAttribute('aria-expanded'), 'true');
    assert.equal(note(), null, '展开后旁注让开音量药丸');
    const faster = host.querySelector(`button[aria-label="加快 0.25${times}"]`) as HTMLButtonElement | null;
    assert.ok(faster);
    await act(async () => { faster.click(); });
    assert.equal(media.rate, 1.25);
    await act(async () => { host.querySelector('input[type="range"]')!.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true })); });
    assert.equal(!!host.querySelector('[role="dialog"]'), false);
    assert.equal(note()?.textContent, `1.25${times}`);
    assert.equal(note()?.getAttribute('aria-label'), `页内倍速 1.25${times}`);
    assert.equal(note()?.getAttribute('data-kind'), 'rate');
    assert.equal(note()?.getAttribute('data-boost'), 'false');

    await volumeEvent(40);
    assert.equal(note()?.textContent, '40%', '音量离开 100% 后优先音量仍显示百分比');
    await act(async () => { (trigger() as unknown as HTMLElement).blur(); });
    assert.equal(dock().dataset.revealed, 'false', '失焦后回到半隐藏，旁注仍在');
    assert.equal(note()?.textContent, '40%');
    await publish({ ...settings, floatingNote: 'rate' });
    assert.equal(note()?.textContent, `1.25${times}`);
    assert.equal(note()?.getAttribute('data-boost'), 'false', '优先倍速时不借用超过 100% 的强调色');
    await publish({ ...settings, floatingNote: 'off' });
    assert.equal(note(), null);
    assert.equal(dock().dataset.revealed, 'false');
    await publish({ ...settings, floatingNote: 'volume' });
    assert.equal(note()?.textContent, '40%');
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});

test('设置页可在优先音量、优先倍速和关闭之间切换，并写进 floatingNote', async () => {
  const window = new Window({ url: 'https://example.com' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
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
  const named = (label: string) => {
    const found = [...host.querySelectorAll('#floating button')].find(item => item.textContent === label);
    assert.ok(found, label);
    return found as unknown as HTMLButtonElement;
  };
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
    const group = host.querySelector('#floating [aria-labelledby="floating-note-label"]')!;
    assert.equal(group.getAttribute('aria-labelledby'), 'floating-note-label');
    assert.match(host.querySelector('#floating-note-label')!.textContent ?? '', /入口旁注/);
    assert.match(host.textContent ?? '', /工具栏上超过 100%/);
    assert.equal(named('优先音量').getAttribute('aria-pressed'), 'true');
    assert.equal(named('优先倍速').getAttribute('aria-pressed'), 'false');
    assert.equal(named('关闭').getAttribute('aria-pressed'), 'false');
    await act(async () => { named('优先倍速').click(); });
    assert.equal(value.floatingNote, 'rate');
    assert.equal(value.floating, true);
    await act(async () => { named('关闭').click(); });
    assert.equal(value.floatingNote, 'off');
    await act(async () => { named('优先音量').click(); });
    assert.equal(value.floatingNote, 'volume');
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
