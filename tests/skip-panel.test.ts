import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { defaultSettings, type MediaClient, type MediaCommand, type MediaState, type Settings, type SettingsStore } from '../lib/types';

test('弹出面板快退快进按钮使用设置里的步长', async () => {
  const window = new Window({ url: 'https://example.com' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  const media: MediaState = { id: '1', host: 'example.com', label: '', title: '正片', kind: 'video', volume: .5, maxVolume: 1, muted: false, paused: true, rate: 1, currentTime: 40, duration: 120, live: false, seekable: [{ start: 0, end: 120 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };
  const sent: MediaCommand[] = [];
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: '1', media: [media] }; },
    async command(_, command) { sent.push(command); },
    async select() {},
    async highlight() {}
  };
  let value: Settings = { ...defaultSettings, skipSeconds: 15 };
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
    const back = button('后退 15 秒');
    const forward = button('前进 15 秒');
    assert.ok(back);
    assert.ok(forward);
    assert.equal(back.querySelector('span')?.textContent, '15');
    assert.equal(forward.querySelector('span')?.textContent, '15');
    await click(back);
    await click(forward);
    assert.deepEqual(sent, [{ type: 'skip', value: -15 }, { type: 'skip', value: 15 }]);
    value = { ...value, skipSeconds: 5 };
    await act(async () => { listeners.forEach(listener => listener(value)); });
    assert.ok(button('后退 5 秒'));
    assert.equal(button('后退 5 秒')?.querySelector('span')?.textContent, '5');
    assert.equal(button('后退 15 秒'), null);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
