import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { maxGain } from '../lib/amplifier';
import { defaultSettings, type MediaClient, type MediaState, type Settings, type SettingsStore } from '../lib/types';

test('展开后可打开面板，打不开时提示点工具栏图标', async () => {
  const window = new Window({ url: 'https://example.com' });
  const globals = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'CustomEvent', 'MutationObserver', 'ResizeObserver'] as const;
  for (const name of globals) Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { FloatingController } = await import('../components/floating');
  const preview: MediaState = { id: '0:1', title: '预览', label: '预览', host: 'example.com', kind: 'video', paused: true, muted: false, volume: 1, maxVolume: maxGain, rate: 1, currentTime: 0, duration: 10, live: false, seekable: [{ start: 0, end: 10 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };
  const feature: MediaState = { ...preview, id: '0:2', title: '正片', label: '正片' };
  const selects: string[] = [];
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: '0:2', media: [preview, feature] }; },
    async command() {},
    async select(id) { selects.push(id); },
    async highlight() {}
  };
  let settings: Settings = { ...defaultSettings };
  const listeners = new Set<(value: Settings) => void>();
  const store: SettingsStore = {
    async load() { return settings; },
    async save(next) { settings = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const opened: string[] = [];
  let openResult: boolean | Error = true;
  const openPanel = async (id: string) => {
    opened.push(id);
    if (openResult instanceof Error) throw openResult;
    return openResult;
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const button = () => host.querySelector('button[aria-label="打开面板"]') as HTMLButtonElement | null;
  const hint = () => host.querySelector('[role="status"]')?.textContent?.trim() ?? '';
  const expand = async () => {
    const trigger = host.querySelector('[data-slot="popover-trigger"]')!;
    await act(async () => { trigger.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
  };
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(FloatingController, { client }) })); });
    await expand();
    assert.equal(button(), null, '预览页没有弹出面板可开，不放入口');

    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(FloatingController, { client, openPanel }) })); });
    if (!button()) await expand();
    assert.equal(button()?.textContent, '打开面板');
    assert.equal(hint(), '');
    assert.equal(host.querySelector('[data-slot="popover-trigger"]')?.getAttribute('title')?.startsWith('正片'), true);

    await act(async () => { button()!.click(); });
    assert.deepEqual(opened, ['0:2']);
    assert.deepEqual(selects, [], '打开面板只把当前 id 交给后台，不再走会套用站点偏好的 select');
    assert.equal(hint(), '');

    openResult = false;
    await act(async () => { button()!.click(); });
    assert.equal(hint(), '请点工具栏图标');
    assert.equal(button()?.disabled, false);

    openResult = new Error('Failed to open popup');
    await act(async () => { button()!.click(); });
    assert.deepEqual(opened, ['0:2', '0:2', '0:2']);
    assert.equal(hint(), '请点工具栏图标');
  } finally {
    await act(async () => { root.unmount(); });
  }
});
