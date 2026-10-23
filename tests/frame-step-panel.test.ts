import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { defaultSettings, type MediaClient, type MediaCommand, type MediaState, type Settings, type SettingsStore } from '../lib/types';

function browser(window: Window) {
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
}

const base: MediaState = { id: '1', host: 'example.com', label: '', title: '正片', kind: 'video', volume: .5, maxVolume: 1, muted: false, paused: false, rate: 1, currentTime: 40, duration: 120, live: false, seekable: [{ start: 0, end: 120 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };

async function render(media: MediaState) {
  const window = new Window({ url: 'https://example.com' });
  browser(window);
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  const sent: MediaCommand[] = [];
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: '1', media: [media] }; },
    async command(_, command) { sent.push(command); },
    async select() {},
    async highlight() {}
  };
  const value: Settings = { ...defaultSettings };
  const store: SettingsStore = {
    async load() { return value; },
    async save() {},
    watch() { return () => {}; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { client, openSettings() {} }) })); });
  const button = (label: string) => host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
  return { window, host, root, sent, button };
}

test('弹出面板逐帧按钮发出方向，并写明先暂停', async () => {
  const view = await render(base);
  try {
    const back = view.button('上一帧');
    const forward = view.button('下一帧');
    assert.ok(back);
    assert.ok(forward);
    assert.equal(back.disabled, false);
    assert.equal(forward.disabled, false);
    assert.match(view.host.querySelector('#frame-step-hint')?.textContent ?? '', /会先暂停，再移动一帧/);
    await act(async () => { back.click(); });
    await act(async () => { forward.click(); });
    assert.deepEqual(view.sent, [{ type: 'frame', direction: -1 }, { type: 'frame', direction: 1 }]);
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});

test('直播和不可跳转时逐帧按钮禁用，并说明原因', async () => {
  for (const media of [
    { ...base, live: true, duration: null, seekable: [{ start: 20, end: 40 }] },
    { ...base, seekable: [], duration: null }
  ]) {
    const view = await render(media);
    try {
      const back = view.button('上一帧');
      const forward = view.button('下一帧');
      assert.equal(back?.disabled, true);
      assert.equal(forward?.disabled, true);
      assert.match(view.host.querySelector('#frame-step-hint')?.textContent ?? '', /不能逐帧/);
      await act(async () => { back?.click(); });
      assert.deepEqual(view.sent, []);
    } finally {
      await act(async () => { view.root.unmount(); });
      await view.window.happyDOM.close();
    }
  }
});
