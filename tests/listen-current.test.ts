import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import type { ListenCurrentResult, SoundingTab, SoundingTabsClient } from '../lib/tabs';
import { defaultSettings, type MediaClient, type MediaCommand, type MediaState, type SettingsStore } from '../lib/types';

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

async function render(initial: SoundingTab[], behavior: { currentMuted?: boolean; result?: ListenCurrentResult; reject?: boolean } = {}) {
  const window = new Window({ url: 'https://example.com' });
  browser(window);
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  const tabs = initial.map(tab => ({ ...tab }));
  let currentMuted = behavior.currentMuted === true;
  let undo = false;
  let listenCalls = 0;
  let muteOthersCalls = 0;
  const sent: MediaCommand[] = [];
  const sounding: SoundingTabsClient = {
    async list() { return { tabs: tabs.map(tab => ({ ...tab })), undo, currentMuted }; },
    async focus() {},
    async mute(id, muted) {
      const tab = tabs.find(item => item.id === id);
      if (tab) tab.muted = muted;
    },
    async muteOthers() {
      muteOthersCalls += 1;
      return { failed: false, undo: true };
    },
    async listenCurrent() {
      listenCalls += 1;
      if (behavior.reject) throw new Error('down');
      const result = behavior.result ?? { failed: false, undo: true, unavailable: false };
      if (!result.failed && !result.unavailable) {
        for (const tab of tabs) if (!tab.muted) tab.muted = true;
        currentMuted = false;
        undo = result.undo;
      } else if (result.failed && result.undo) {
        const first = tabs.find(tab => !tab.muted);
        if (first) first.muted = true;
        currentMuted = false;
        undo = true;
      }
      return result;
    },
    async undoMuteOthers() {
      undo = false;
      currentMuted = true;
      for (const tab of tabs) tab.muted = false;
      return 'restored';
    },
    watch() { return () => {}; },
  };
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: media.id, media: [{ ...media }] }; },
    async command(_target, command) { sent.push(command); },
    async select() {},
    async highlight() {},
  };
  const store: SettingsStore = { async load() { return defaultSettings; }, async save() { throw new Error('saved'); }, watch() { return () => {}; } };
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
    window, host, root, button, rowMute, click, sent,
    counts: () => ({ listenCalls, muteOthersCalls }),
  };
}

test('当前标签被浏览器静音时，空列表仍可只听当前，并且不改媒体音量', async () => {
  const view = await render([], { currentMuted: true });
  try {
    const listen = view.button('只听当前标签页');
    assert.ok(listen);
    assert.strictEqual(listen?.textContent, '只听当前');
    assert.strictEqual(listen?.disabled, false);
    assert.strictEqual(view.button('静音其他') == null, true);
    assert.strictEqual(view.host.querySelector('[role="status"]') == null, true);
    await view.click(listen);
    assert.strictEqual(view.counts().listenCalls, 1);
    assert.strictEqual(view.counts().muteOthersCalls, 0);
    assert.strictEqual(view.sent.some(command => command.type === 'volume' || command.type === 'mute'), false);
    assert.ok(view.button('撤销静音其他'));
    assert.strictEqual(view.host.querySelector('[role="alert"]') == null, true);
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});

test('没有发声标签且当前未静音时，只听当前不出现', async () => {
  const view = await render([]);
  try {
    assert.strictEqual(view.button('只听当前标签页') == null, true);
    assert.strictEqual(view.button('静音其他') == null, true);
    assert.strictEqual(view.host.querySelector('[role="status"]') == null, true);
    assert.match(view.host.textContent ?? '', /没有其他正在播放的标签页/);
    assert.strictEqual(view.counts().listenCalls, 0);
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});

test('当前已经可听时，只听当前只静音仍在发声的其他标签', async () => {
  const view = await render([music, { ...meeting, muted: true }]);
  try {
    const listen = view.button('只听当前标签页');
    const others = view.button('静音其他');
    assert.ok(listen);
    assert.ok(others);
    assert.strictEqual(listen?.disabled, false);
    assert.strictEqual(others?.textContent, '静音其他');
    await view.click(listen);
    assert.strictEqual(view.counts().listenCalls, 1);
    assert.strictEqual(view.counts().muteOthersCalls, 0);
    assert.strictEqual(view.rowMute('音乐')?.getAttribute('aria-pressed'), 'true');
    assert.strictEqual(view.rowMute('会议')?.getAttribute('aria-pressed'), 'true');
    assert.strictEqual(view.sent.length, 0);
    assert.strictEqual(view.host.querySelector('[role="alert"]') == null, true);
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});

test('列表里只剩已经静音的标签、当前也未静音时，按钮不可用', async () => {
  const view = await render([{ ...music, muted: true }]);
  try {
    const listen = view.button('只听当前标签页');
    assert.ok(listen);
    assert.strictEqual(listen?.disabled, true);
    assert.ok(view.button('静音其他'));
    assert.strictEqual(view.host.querySelector('[role="status"]')?.textContent, '没有其他发声标签，当前标签也没有被静音。');
    await view.click(listen);
    assert.strictEqual(view.counts().listenCalls, 0);
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});

test('只听当前有一部分失败时显示失败，不当成全部成功', async () => {
  const view = await render([music, meeting], { result: { failed: true, undo: true, unavailable: false } });
  try {
    await view.click(view.button('只听当前标签页'));
    assert.strictEqual(view.host.querySelector('[role="alert"]')?.textContent, '没能改成只听当前。');
    assert.strictEqual(view.rowMute('音乐')?.getAttribute('aria-pressed'), 'true');
    assert.strictEqual(view.rowMute('会议')?.getAttribute('aria-pressed'), 'false');
    assert.ok(view.button('撤销静音其他'));
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});

test('调用失败时不显示成已经只听当前', async () => {
  const view = await render([music], { reject: true });
  try {
    await view.click(view.button('只听当前标签页'));
    assert.strictEqual(view.host.querySelector('[role="alert"]')?.textContent, '没能改成只听当前。');
    assert.strictEqual(view.rowMute('音乐')?.getAttribute('aria-pressed'), 'false');
    assert.strictEqual(view.button('撤销静音其他') == null, true);
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});

test('撤销会回到只听当前之前，包括当前标签重新静音', async () => {
  const view = await render([music], { currentMuted: true });
  try {
    await view.click(view.button('只听当前标签页'));
    const undo = view.button('撤销静音其他');
    assert.ok(undo);
    await view.click(undo);
    assert.strictEqual(view.button('撤销静音其他') == null, true);
    assert.strictEqual(view.rowMute('音乐')?.getAttribute('aria-pressed'), 'false');
    assert.strictEqual(view.button('只听当前标签页')?.disabled, false);
    assert.strictEqual(view.host.querySelector('[role="alert"]') == null, true);
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});
