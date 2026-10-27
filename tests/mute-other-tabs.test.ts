import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import type { SoundingTab, SoundingTabsClient } from '../lib/tabs';
import { defaultSettings, type MediaClient, type MediaCommand, type MediaState, type Settings, type SettingsStore } from '../lib/types';

function browser(window: Window) {
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
}

const media: MediaState = { id: '1', host: 'example.com', label: '', title: '正片', kind: 'video', volume: .5, maxVolume: 1, muted: false, paused: true, rate: 1, currentTime: 40, duration: 120, live: false, seekable: [{ start: 0, end: 120 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };

const music: SoundingTab = { id: 2, windowId: 1, title: '音乐', favIconUrl: '', muted: false };
const meeting: SoundingTab = { id: 3, windowId: 1, title: '会议', favIconUrl: '', muted: false };

async function settle() {
  await act(async () => {
    for (let step = 0; step < 8; step += 1) await Promise.resolve();
  });
}

async function render(initial: SoundingTab[], behavior: { reject?: number[]; ignore?: number[]; listFails?: boolean } = {}) {
  const window = new Window({ url: 'https://example.com' });
  browser(window);
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  const tabs = initial.map(tab => ({ ...tab }));
  const calls: Array<{ id: number; muted: boolean }> = [];
  const focused: number[] = [];
  const sent: MediaCommand[] = [];
  let saves = 0;
  let lists = 0;
  const sounding: SoundingTabsClient = {
    async list() {
      lists += 1;
      if (behavior.listFails && lists > 1) throw new Error('list down');
      return tabs.map(tab => ({ ...tab }));
    },
    async focus(id) { focused.push(id); },
    async mute(id, muted) {
      calls.push({ id, muted });
      if (behavior.reject?.includes(id)) throw new Error('mute failed');
      if (behavior.ignore?.includes(id)) return;
      const tab = tabs.find(item => item.id === id);
      if (!tab) throw new Error(`missing ${id}`);
      tab.muted = muted;
    },
    watch() { return () => {}; },
  };
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: media.id, media: [{ ...media }] }; },
    async command(_target, command) { sent.push(command); },
    async select() {},
    async highlight() {},
  };
  const value: Settings = { ...defaultSettings, sitePrefs: { 'example.com': { volume: .5, rate: 1 } } };
  const store: SettingsStore = { async load() { return value; }, async save() { saves += 1; }, watch() { return () => {}; } };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { client, sounding, openSettings() {} }) })); });
  const button = () => host.querySelector('button[aria-label="静音其他"]') as HTMLButtonElement | null;
  const row = (title: string) => [...host.querySelectorAll('[role="listitem"]')].find(item => item.textContent?.includes(title));
  const rowMute = (title: string) => row(title)?.querySelector('button[aria-pressed]') as HTMLButtonElement | null;
  const click = async (element: HTMLElement | null | undefined) => {
    await act(async () => { element?.click(); });
    await settle();
  };
  return { window, host, root, calls, focused, sent, saves: () => saves, button, row, rowMute, click };
}

test('静音其他把列表里的标签都静音，当前页音量和站点记忆不动', async () => {
  const view = await render([music, { ...meeting, muted: true }]);
  try {
    const button = view.button();
    assert.ok(button);
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, '静音其他');
    await view.click(button);
    assert.deepEqual(view.calls.map(call => call.id).sort(), [2, 3]);
    assert.ok(view.calls.every(call => call.muted === true));
    assert.equal(view.rowMute('音乐')?.getAttribute('aria-pressed'), 'true');
    assert.equal(view.rowMute('会议')?.getAttribute('aria-pressed'), 'true');
    assert.equal(view.host.querySelector('[role="alert"]'), null);
    assert.match(view.host.textContent ?? '', /50%/);
    assert.equal(view.sent.some(command => command.type === 'volume' || command.type === 'mute'), false);
    assert.equal(view.saves(), 0);
    const opener = view.row('音乐')?.querySelector('button[aria-label="切换到音乐"]') as HTMLButtonElement | null;
    await view.click(opener);
    assert.deepEqual(view.focused, [2]);
    const one = view.rowMute('音乐');
    await view.click(one);
    assert.equal(view.calls.at(-1)?.id, 2);
    assert.equal(view.calls.at(-1)?.muted, false);
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});

test('没有其他发声标签时不显示静音其他', async () => {
  const view = await render([]);
  try {
    assert.equal(view.button(), null);
    assert.match(view.host.textContent ?? '', /没有其他正在播放的标签页/);
    assert.equal(view.saves(), 0);
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});

test('有一条静音失败时不把那一条显示成已静音', async () => {
  const view = await render([music, meeting], { reject: [3] });
  try {
    await view.click(view.button());
    assert.equal(view.rowMute('音乐')?.getAttribute('aria-pressed'), 'true');
    assert.equal(view.rowMute('音乐')?.getAttribute('aria-label'), '取消静音');
    assert.equal(view.rowMute('会议')?.getAttribute('aria-pressed'), 'false');
    assert.equal(view.rowMute('会议')?.getAttribute('aria-label'), '静音');
    assert.match(view.host.querySelector('[role="alert"]')?.textContent ?? '', /没能静音其他标签页/);
    assert.match(view.host.textContent ?? '', /50%/);
    assert.equal(view.saves(), 0);
    assert.equal(view.sent.some(command => command.type === 'volume' || command.type === 'mute'), false);
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});

test('浏览器没有静音时界面保持未静音并报错', async () => {
  const view = await render([music, meeting], { ignore: [2, 3] });
  try {
    await view.click(view.button());
    assert.equal(view.rowMute('音乐')?.getAttribute('aria-pressed'), 'false');
    assert.equal(view.rowMute('会议')?.getAttribute('aria-pressed'), 'false');
    assert.match(view.host.querySelector('[role="alert"]')?.textContent ?? '', /没能静音其他标签页/);
    assert.equal(view.saves(), 0);
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});

test('静音之后读不到标签列表时不把它们显示成已静音', async () => {
  const view = await render([music, meeting], { listFails: true });
  try {
    await view.click(view.button());
    assert.equal(view.rowMute('音乐')?.getAttribute('aria-pressed'), 'false');
    assert.equal(view.rowMute('会议')?.getAttribute('aria-pressed'), 'false');
    assert.match(view.host.querySelector('[role="alert"]')?.textContent ?? '', /没能静音其他标签页/);
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});
