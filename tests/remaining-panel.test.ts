import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { defaultSettings, type MediaClient, type MediaCommand, type MediaState, type Settings, type SettingsStore } from '../lib/types';
import type { SleepTimerClient } from '../lib/sleep-timer';

function browser(window: Window) {
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
}

const base: MediaState = { id: '1', host: 'example.com', label: '', title: '网课', kind: 'video', volume: 1, maxVolume: 1, muted: false, paused: true, rate: 1, currentTime: 0, duration: 120, live: false, seekable: [{ start: 0, end: 120 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };

async function render(media: MediaState, options: { sleep?: boolean; sleepAt?: number } = {}) {
  const window = new Window({ url: 'https://example.com' });
  browser(window);
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  let item = { ...media };
  let sleepAt = options.sleepAt;
  const saves: Settings[] = [];
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: item.id, media: [item], ...(sleepAt == null ? {} : { sleepAt }) }; },
    async command(_target, command: MediaCommand) {
      if (command.type === 'rate') item = { ...item, rate: command.value };
    },
    async select() {},
    async highlight() {},
  };
  const sleep: SleepTimerClient | undefined = options.sleep ? {
    async start(minutes) { sleepAt = Date.now() + minutes * 60_000; },
    async cancel() { sleepAt = undefined; },
    async extend() { if (sleepAt != null) sleepAt += 15 * 60_000; },
  } : undefined;
  const value: Settings = { ...defaultSettings };
  const store: SettingsStore = { async load() { return value; }, async save(next) { saves.push(next); }, watch() { return () => {}; } };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { client, sleep, openSettings() {} }) })); });
  const button = (label: string) => host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
  const line = () => host.querySelector('#episode-remaining')?.textContent ?? '';
  return {
    window, host, root, saves, button, line,
    close: async () => { await act(async () => { root.unmount(); }); await window.happyDOM.close(); },
  };
}

test('可 seek 且知道时长时，本集剩余按倍速折算，进度条还在', async () => {
  const view = await render(base);
  try {
    assert.equal(view.line(), '本集剩余约 02:00（1×）');
    assert.ok(view.host.querySelector('[aria-label="播放进度"]'), '不替换进度条');
    assert.equal(view.saves.length, 0);
  } finally { await view.close(); }
});

test('2× 时剩余约为媒体时钟的一半，改倍速后更新', async () => {
  const half = await render({ ...base, currentTime: 20, rate: 2 });
  try {
    assert.equal(half.line(), '本集剩余约 00:50（2×）');
  } finally { await half.close(); }

  const view = await render({ ...base, currentTime: 0, rate: 1 });
  try {
    assert.equal(view.line(), '本集剩余约 02:00（1×）');
    await act(async () => { view.button('2 倍速')?.click(); });
    assert.equal(view.line(), '本集剩余约 01:00（2×）');
    await act(async () => { view.button('1.5 倍速')?.click(); });
    assert.equal(view.line(), '本集剩余约 01:20（1.5×）');
    assert.equal(view.saves.length, 0, '改倍速不写设置');
  } finally { await view.close(); }
});

test('直播、未知时长和不可 seek 不显示剩余', async () => {
  for (const media of [
    { ...base, live: true, duration: null, seekable: [{ start: 20, end: 40 }] },
    { ...base, duration: null, seekable: [{ start: 0, end: 30 }] },
    { ...base, seekable: [], duration: null },
    { ...base, seekable: [], duration: 120 },
  ]) {
    const view = await render(media);
    try {
      assert.equal(view.host.querySelector('#episode-remaining'), null);
      assert.equal(view.line(), '');
    } finally { await view.close(); }
  }
});

test('和睡眠倒计时并排时，本集剩余与睡眠还剩不是同一句', async () => {
  const view = await render(base, { sleep: true, sleepAt: Date.now() + 15 * 60_000 });
  try {
    const episode = view.line();
    const sleep = view.host.querySelector('#sleep-timer-status')?.textContent ?? '';
    assert.match(episode, /^本集剩余约 /);
    assert.match(sleep, /^睡眠还剩 /);
    assert.equal(episode.includes('睡眠'), false);
    assert.equal(sleep.includes('本集'), false);
    assert.notEqual(episode, sleep);
    assert.ok(view.host.querySelector('[aria-label="播放进度"]'));
  } finally { await view.close(); }
});
