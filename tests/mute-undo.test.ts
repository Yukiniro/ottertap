import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { attributedTo, canRestore, parseMuteBatch, recordableWrite, tabMuteFact, withoutEntry, type TabMuteFact } from '../lib/mute-batch';
import type { SoundingTab, SoundingTabsClient, UndoMuteOthersStatus } from '../lib/tabs';
import { defaultSettings, type MediaClient, type MediaCommand, type MediaState, type Settings, type SettingsStore } from '../lib/types';

const ours = (id: number, muted = true): TabMuteFact => ({ id, muted, reason: 'extension', extensionId: 'ext' });

test('只记录实际从有声改成静音、且结果仍归属本扩展的标签', () => {
  const before = { id: 2, muted: false };
  const entry = recordableWrite(before, true, ours(2), 'ext');
  assert.deepEqual(entry, { tabId: 2, previousMuted: false, writtenMuted: true });
  assert.strictEqual(recordableWrite({ id: 3, muted: true, reason: 'user' }, true, ours(3), 'ext'), null);
  assert.strictEqual(recordableWrite(before, true, { id: 2, muted: true }, 'ext'), null);
  assert.strictEqual(recordableWrite(before, true, { ...ours(2), extensionId: 'other' }, 'ext'), null);
  assert.strictEqual(recordableWrite(before, true, { ...ours(2), reason: 'user', extensionId: undefined }, 'ext'), null);
  assert.strictEqual(recordableWrite(before, true, ours(2), ''), null);
  assert.strictEqual(attributedTo(ours(2), 'ext', true), true);
});

test('同值重复后归属字段不变则仍算本扩展，字段缺失或变化则不恢复', () => {
  const entry = recordableWrite({ id: 2, muted: false }, true, ours(2), 'ext');
  assert.ok(entry);
  assert.strictEqual(canRestore(entry, ours(2), 'ext'), true);
  assert.strictEqual(canRestore(entry, { id: 2, muted: true, reason: 'user' }, 'ext'), false);
  assert.strictEqual(canRestore(entry, { id: 2, muted: true, reason: 'extension', extensionId: 'other' }, 'ext'), false);
  assert.strictEqual(canRestore(entry, { id: 2, muted: true, reason: 'capture', extensionId: 'ext' }, 'ext'), false);
  assert.strictEqual(canRestore(entry, { id: 2, muted: true }, 'ext'), false);
  assert.strictEqual(canRestore(entry, { id: 2, muted: false, reason: 'extension', extensionId: 'ext' }, 'ext'), false);
  assert.strictEqual(canRestore(entry, null, 'ext'), false);
  assert.strictEqual(canRestore({ tabId: 4, previousMuted: true, writtenMuted: false }, { id: 4, muted: false, reason: 'extension', extensionId: 'ext' }, 'ext'), true);
});

test('坏掉的批次不能解析，关掉的标签从批次里去掉', () => {
  const raw = { entries: [{ tabId: 8, previousMuted: false, writtenMuted: true }, { tabId: 10, previousMuted: false, writtenMuted: true }] };
  const parsed = parseMuteBatch(raw);
  assert.deepEqual(parsed?.entries.map(entry => entry.tabId), [8, 10]);
  assert.strictEqual(parseMuteBatch({ entries: [] }), null);
  assert.strictEqual(parseMuteBatch({ entries: [{ tabId: 1, previousMuted: true, writtenMuted: true }] }), null);
  assert.strictEqual(parseMuteBatch({ entries: [{ tabId: 1, previousMuted: false, writtenMuted: true }, { tabId: 1, previousMuted: false, writtenMuted: true }] }), null);
  assert.strictEqual(parseMuteBatch(null), null);
  assert.deepEqual(withoutEntry(parsed, 8), { entries: [{ tabId: 10, previousMuted: false, writtenMuted: true }] });
  assert.strictEqual(withoutEntry(parsed, 8) && withoutEntry(withoutEntry(parsed, 8), 10), null);
  const fact = tabMuteFact({ id: 8, mutedInfo: { muted: true, reason: 'extension', extensionId: 'ext' } });
  assert.deepEqual(fact, ours(8));
  assert.strictEqual(tabMuteFact({ id: -1, mutedInfo: { muted: true } }), null);
});

function browser(window: Window) {
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
}

const media: MediaState = { id: '1', host: 'example.com', label: '', title: '正片', kind: 'video', volume: .4, maxVolume: 1, muted: false, paused: false, rate: 1, currentTime: 4, duration: 120, live: false, seekable: [{ start: 0, end: 120 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };
const music: SoundingTab = { id: 2, windowId: 1, title: '音乐', favIconUrl: '', muted: false };
const meeting: SoundingTab = { id: 3, windowId: 1, title: '会议', favIconUrl: '', muted: false };

async function settle() {
  await act(async () => {
    for (let step = 0; step < 8; step += 1) await Promise.resolve();
  });
}

async function render(initial: SoundingTab[], behavior: { undo?: UndoMuteOthersStatus; hang?: boolean; restore?: number[] } = {}) {
  const window = new Window({ url: 'https://example.com' });
  browser(window);
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  const tabs = initial.map(tab => ({ ...tab }));
  const muteCalls: Array<{ id: number; muted: boolean }> = [];
  const sent: MediaCommand[] = [];
  let muteOthersCalls = 0;
  let undoCalls = 0;
  let undo = false;
  let release: (() => void) | undefined;
  const sounding: SoundingTabsClient = {
    async list() { return { tabs: tabs.map(tab => ({ ...tab })), undo, currentMuted: false }; },
    async focus() {},
    async mute(id, muted) {
      muteCalls.push({ id, muted });
      const tab = tabs.find(item => item.id === id);
      if (tab) tab.muted = muted;
    },
    async listenCurrent() { return { failed: false, undo: false, unavailable: true }; },
    async muteOthers() {
      muteOthersCalls += 1;
      if (behavior.hang) await new Promise<void>(resolve => { release = resolve; });
      let changed = false;
      for (const tab of tabs) {
        if (!tab.muted) changed = true;
        tab.muted = true;
      }
      if (changed) undo = true;
      return { failed: false, undo };
    },
    async undoMuteOthers() {
      undoCalls += 1;
      const status = behavior.undo ?? 'restored';
      if (status === 'restored') {
        for (const id of behavior.restore ?? tabs.map(tab => tab.id)) {
          const tab = tabs.find(item => item.id === id);
          if (tab) tab.muted = false;
        }
      }
      if (status !== 'failed') undo = false;
      return status;
    },
    watch() { return () => {}; },
  };
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: media.id, media: [{ ...media }] }; },
    async command(_target, command) { sent.push(command); },
    async select() {},
    async highlight() {},
  };
  const value: Settings = { ...defaultSettings, sitePrefs: { 'example.com': { volume: .4, rate: 1 } } };
  const store: SettingsStore = { async load() { return value; }, async save() { throw new Error('saved'); }, watch() { return () => {}; } };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { client, sounding, openSettings() {} }) })); });
  const button = (label: string) => host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
  const rowMute = (title: string) => [...host.querySelectorAll('[role="listitem"]')].find(item => item.textContent?.includes(title))?.querySelector('button[aria-pressed]') as HTMLButtonElement | null;
  const click = async (element: HTMLElement | null | undefined) => {
    await act(async () => { element?.click(); });
    await settle();
  };
  return {
    window, host, root, muteCalls, sent, button, rowMute, click,
    counts: () => ({ muteOthersCalls, undoCalls }),
    release: () => release?.(),
  };
}

test('有批次时显示撤销，恢复后按钮消失，并且不改当前音量', async () => {
  const view = await render([music, meeting], { restore: [2, 3] });
  try {
    assert.strictEqual(view.button('撤销静音其他') == null, true);
    await view.click(view.button('静音其他'));
    assert.strictEqual(view.counts().muteOthersCalls, 1);
    assert.strictEqual(view.muteCalls.length, 0);
    const undo = view.button('撤销静音其他');
    assert.ok(undo);
    assert.strictEqual(undo?.textContent, '撤销静音其他');
    assert.strictEqual(view.rowMute('音乐')?.getAttribute('aria-pressed'), 'true');
    await view.click(undo);
    assert.strictEqual(view.counts().undoCalls, 1);
    assert.strictEqual(view.button('撤销静音其他') == null, true);
    assert.strictEqual(view.rowMute('音乐')?.getAttribute('aria-pressed'), 'false');
    assert.strictEqual(view.rowMute('会议')?.getAttribute('aria-pressed'), 'false');
    assert.strictEqual(view.host.querySelector('[role="alert"]') == null, true);
    assert.strictEqual(view.sent.some(command => command.type === 'volume' || command.type === 'mute'), false);
    await view.click(view.button('撤销静音其他'));
    assert.strictEqual(view.counts().undoCalls, 1);
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});

test('撤销没有可恢复标签时给出不可用说明，调用失败时给出失败说明', async () => {
  const unavailable = await render([music], { undo: 'unavailable' });
  try {
    await unavailable.click(unavailable.button('静音其他'));
    await unavailable.click(unavailable.button('撤销静音其他'));
    assert.strictEqual(unavailable.host.querySelector('[role="status"]')?.textContent, '这些标签页已经不能安全地取消静音。');
    assert.strictEqual(unavailable.button('撤销静音其他') == null, true);
    assert.strictEqual(unavailable.rowMute('音乐')?.getAttribute('aria-pressed'), 'true');
  } finally {
    await act(async () => { unavailable.root.unmount(); });
    await unavailable.window.happyDOM.close();
  }
  const failed = await render([music], { undo: 'failed' });
  try {
    await failed.click(failed.button('静音其他'));
    await failed.click(failed.button('撤销静音其他'));
    assert.strictEqual(failed.host.querySelector('[role="alert"]')?.textContent, '没能撤销静音其他标签页。');
    assert.ok(failed.button('撤销静音其他'));
    assert.strictEqual(failed.rowMute('音乐')?.getAttribute('aria-pressed'), 'true');
  } finally {
    await act(async () => { failed.root.unmount(); });
    await failed.window.happyDOM.close();
  }
});

test('列表空着时仍可撤销，进行中的重复点击不会再发一次', async () => {
  const empty = await render([]);
  try {
    assert.strictEqual(empty.button('静音其他') == null, true);
    assert.strictEqual(empty.button('撤销静音其他') == null, true);
  } finally {
    await act(async () => { empty.root.unmount(); });
    await empty.window.happyDOM.close();
  }
  const view = await render([music, meeting], { hang: true });
  try {
    const button = view.button('静音其他');
    assert.ok(button);
    await act(async () => { button?.click(); button?.click(); });
    assert.strictEqual(view.counts().muteOthersCalls, 1);
    view.release();
    await settle();
    assert.strictEqual(view.counts().muteOthersCalls, 1);
    assert.ok(view.button('撤销静音其他'));
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});

test('空列表里已有批次时撤销按钮还在', async () => {
  const window = new Window({ url: 'https://example.com' });
  browser(window);
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  let undoCalls = 0;
  const sounding: SoundingTabsClient = {
    async list() { return { tabs: [], undo: undoCalls === 0, currentMuted: false }; },
    async focus() {},
    async mute() {},
    async listenCurrent() { return { failed: false, undo: false, unavailable: true }; },
    async muteOthers() { return { failed: false, undo: true }; },
    async undoMuteOthers() { undoCalls += 1; return 'unavailable'; },
    watch() { return () => {}; },
  };
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: media.id, media: [{ ...media }] }; },
    async command() {},
    async select() {},
    async highlight() {},
  };
  const store: SettingsStore = { async load() { return defaultSettings; }, async save() { return; }, watch() { return () => {}; } };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { client, sounding, openSettings() {} }) })); });
  try {
    const undo = host.querySelector('button[aria-label="撤销静音其他"]') as HTMLButtonElement | null;
    assert.ok(undo);
    assert.match(host.textContent ?? '', /没有其他正在播放的标签页/);
    await act(async () => { undo?.click(); });
    await settle();
    assert.strictEqual(undoCalls, 1);
    assert.strictEqual(host.querySelector('[role="status"]')?.textContent, '这些标签页已经不能安全地取消静音。');
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
