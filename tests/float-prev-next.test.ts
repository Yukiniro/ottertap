import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { maxGain } from '../lib/amplifier';
import { defaultSettings, type MediaClient, type MediaCommand, type MediaState, type Settings, type SettingsStore } from '../lib/types';

test('展开音量药丸后，至少两条媒体才有上一条和下一条，切换后仍控制新目标', async () => {
  const window = new Window({ url: 'https://example.com' });
  const globals = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'CustomEvent', 'MutationObserver', 'ResizeObserver'] as const;
  for (const name of globals) Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { FloatingController } = await import('../components/floating');
  const item = (id: string, title: string): MediaState => ({ id, title, label: title, host: 'example.com', kind: 'video', paused: true, muted: false, volume: 1, maxVolume: maxGain, rate: 1, currentTime: 0, duration: 30, live: false, seekable: [{ start: 0, end: 30 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true });
  const first = item('0:1', '预览');
  const second = item('0:2', '正片');
  const third = item('0:3', '片尾');
  let media = [first];
  let selectedId = first.id;
  const selects: { id: string; manual: boolean | undefined }[] = [];
  const commands: { id: string; command: MediaCommand }[] = [];
  const highlights: string[] = [];
  const saves: unknown[] = [];
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId, media: media.map(entry => ({ ...entry })) }; },
    async command(current, command) {
      commands.push({ id: current.id, command });
      const index = media.findIndex(entry => entry.id === current.id);
      if (index < 0) return;
      if (command.type === 'play') media[index] = { ...media[index]!, paused: false };
      else if (command.type === 'pause') media[index] = { ...media[index]!, paused: true };
    },
    async select(id, manual) { selects.push({ id, manual }); selectedId = id; },
    async highlight(current) { highlights.push(current.id); }
  };
  let settings: Settings = { ...defaultSettings, floatingPosition: { side: 'right', y: .8 } };
  const listeners = new Set<(value: Settings) => void>();
  const store: SettingsStore = {
    async load() { return settings; },
    async save(next) { saves.push(next); settings = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  let root = createRoot(host as unknown as HTMLElement);
  const button = (label: string) => host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
  const expand = async () => {
    const trigger = host.querySelector('[data-slot="popover-trigger"]')!;
    await act(async () => { trigger.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
  };
  const mount = async () => {
    await act(async () => { root.unmount(); });
    root = createRoot(host as unknown as HTMLElement);
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(FloatingController, { client, openPanel: async () => true }) })); });
    await expand();
  };
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(FloatingController, { client, openPanel: async () => true }) })); });
    await expand();
    assert.equal(button('上一条媒体'), null, '只有一条时不放上一条');
    assert.equal(button('下一条媒体'), null, '只有一条时不放下一条');
    assert.equal(host.querySelectorAll('button[aria-label="上一条媒体"], button[aria-label="下一条媒体"]').length, 0);
    assert.ok(button('打开面板'), '打开面板仍在');
    assert.equal(selects.length, 0);

    media = [first, second, third];
    await mount();
    const playback = host.querySelector('[role="group"][aria-label="播放"]');
    const previous = button('上一条媒体');
    const next = button('下一条媒体');
    const open = button('打开面板');
    assert.ok(previous && next && open);
    assert.ok(playback?.querySelector('button[aria-label="上一条媒体"]'));
    assert.ok(playback?.querySelector('button[aria-label="下一条媒体"]'));
    assert.equal(playback?.querySelector('button[aria-label="打开面板"]'), null, '上一条和下一条不放进打开面板那一栏');
    assert.equal(previous.textContent?.includes('上一条'), true);
    assert.equal(next.textContent?.includes('下一条'), true);
    assert.equal(host.querySelector('[data-slot="popover-trigger"]')?.getAttribute('title')?.startsWith('预览'), true);

    const click = async (element: HTMLButtonElement) => { await act(async () => { element.click(); }); };
    await click(next);
    assert.deepEqual(selects, [{ id: '0:2', manual: true }]);
    assert.deepEqual(highlights, [], '轮廓由选中切换发出，药丸不再单独高亮');
    assert.equal(host.querySelector('[data-slot="popover-trigger"]')?.getAttribute('title')?.startsWith('正片'), true);
    assert.ok(button('上一条媒体') && button('下一条媒体') && button('打开面板'), '切换后药丸仍展开，两个入口都在');
    await click(button('播放')!);
    assert.deepEqual(commands, [{ id: '0:2', command: { type: 'play' } }]);
    assert.equal(media.find(entry => entry.id === '0:1')?.paused, true, '播放不作用在上一条');

    await click(button('下一条媒体')!);
    await click(button('下一条媒体')!);
    assert.deepEqual(selects.map(entry => entry.id), ['0:2', '0:3', '0:1'], '下一条按页面顺序循环');
    await click(button('上一条媒体')!);
    assert.equal(selects.at(-1)?.id, '0:3', '上一条从第一条回到最后一条');
    assert.equal(selects.every(entry => entry.manual === true), true);
    assert.deepEqual(saves, [], '切换不写位置或站点记忆');
    assert.deepEqual(settings.floatingPosition, { side: 'right', y: .8 });
  } finally {
    await act(async () => { root.unmount(); });
  }
});
