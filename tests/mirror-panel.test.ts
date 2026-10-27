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

async function render(media: MediaState[], selectedId = media[0]?.id ?? '') {
  const window = new Window({ url: 'https://example.com' });
  browser(window);
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  const sent: MediaCommand[] = [];
  const saved: Settings[] = [];
  let items = media.map(item => ({ ...item }));
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId, media: items }; },
    async command(target, command) {
      sent.push(command);
      if (command.type === 'mirror') items = items.map(item => item.id === target.id ? { ...item, mirrored: command.value } : item);
    },
    async select(id) { selectedId = id; },
    async highlight() {}
  };
  const value: Settings = { ...defaultSettings, sitePrefs: { 'example.com': { volume: .5, rate: 1 } } };
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { saved.push(next); },
    watch() { return () => {}; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { client, openSettings() {} }) })); });
  const toggle = () => host.querySelector('[role="switch"][aria-label="水平镜像"]');
  const off = (element: { hasAttribute(name: string): boolean } | null) => !!element?.hasAttribute('data-disabled');
  const click = async (element: unknown) => { await act(async () => { (element as { click(): void }).click(); }); };
  return { window, host, root, sent, saved, toggle, click, off };
}

test('弹出面板的水平镜像默认关，点击只发出镜像指令', async () => {
  const view = await render([base]);
  try {
    const toggle = view.toggle();
    assert.ok(toggle);
    assert.equal(toggle.getAttribute('aria-checked'), 'false');
    assert.equal(view.off(toggle), false);
    assert.equal(view.host.querySelector('#mirror-hint'), null);
    assert.match(view.host.textContent ?? '', /水平镜像/);
    await view.click(toggle);
    assert.deepEqual(view.sent, [{ type: 'mirror', value: true }]);
    assert.equal(view.toggle()?.getAttribute('aria-checked'), 'true');
    assert.equal(view.saved.length, 0);
    await view.click(view.toggle()!);
    assert.deepEqual(view.sent, [{ type: 'mirror', value: true }, { type: 'mirror', value: false }]);
    assert.equal(view.toggle()?.getAttribute('aria-checked'), 'false');
    assert.equal(view.saved.length, 0);
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});

test('换到另一条媒体时开关跟着那一条，默认不镜像', async () => {
  const preview: MediaState = { ...base, id: '1', title: '预览', mirrored: true };
  const main: MediaState = { ...base, id: '2', title: '正片' };
  const view = await render([preview, main], '2');
  try {
    assert.equal(view.toggle()?.getAttribute('aria-checked'), 'false');
    assert.equal(view.host.querySelector('h1')?.textContent, '正片');
    assert.equal(view.sent.length, 0);
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
  const again = await render([preview, main], '1');
  try {
    assert.equal(again.toggle()?.getAttribute('aria-checked'), 'true');
    assert.equal(again.host.querySelector('h1')?.textContent, '预览');
  } finally {
    await act(async () => { again.root.unmount(); });
    await again.window.happyDOM.close();
  }
});

test('音频的水平镜像开关禁用，并说明没有画面', async () => {
  const view = await render([{ ...base, kind: 'audio', title: '播客', pip: false, pipAvailable: false, pipBlock: 'audio' }]);
  try {
    const toggle = view.toggle();
    assert.ok(toggle);
    assert.equal(view.off(toggle), true);
    assert.equal(toggle.getAttribute('aria-checked'), 'false');
    assert.match(view.host.querySelector('#mirror-hint')?.textContent ?? '', /没有画面/);
    await view.click(toggle);
    assert.deepEqual(view.sent, []);
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});
