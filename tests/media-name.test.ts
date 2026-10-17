import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { createMediaController } from '../lib/media';
import { defaultSettings, type MediaClient, type SettingsStore } from '../lib/types';

test('媒体名称从真实控制器快照传入面板，保留媒体名称及页面标题', async () => {
  const window = new Window({ url: 'https://www.bilibili.com/video/BV1yeJQ6zECa/' });
  window.document.title = '海獭的一天';
  const video = window.document.createElement('video');
  window.document.body.append(video);
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  const controller = createMediaController(window.document as unknown as Document);
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'www.bilibili.com', selectedId: '', media: controller.snapshot() }; },
    async command(media, command) { await controller.command(media.id, command); },
    async select() {},
    async highlight() {}
  };
  const store: SettingsStore = { async load() { return defaultSettings; }, async save() {}, watch() { return () => {}; } };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { client, openSettings() {} }) })); });
    assert.equal(controller.snapshot()[0]?.title, '海獭的一天');
    assert.equal(host.querySelector('h1')?.textContent, '海獭的一天');
    const bilibiliTitle = '【经典回顾】细腻的台内控制，线路的绝对压制，樊振东3比1战胜鲍姆_哔哩哔哩_bilibili';
    const cases = [
      { pageTitle: bilibiliTitle, label: '', title: '', expected: bilibiliTitle },
      { pageTitle: bilibiliTitle, label: '正片', title: '其他名称', expected: '正片' },
      { pageTitle: bilibiliTitle, label: '', title: '预告片', expected: '预告片' },
      { pageTitle: '', label: '', title: '', expected: '未命名媒体' }
    ];
    for (const [index, scenario] of cases.entries()) {
      window.document.title = scenario.pageTitle;
      video.setAttribute('aria-label', scenario.label);
      video.setAttribute('title', scenario.title);
      await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { key: index, client, openSettings() {} }) })); });
      assert.equal(host.querySelector('h1')?.textContent, scenario.expected);
      assert.equal(host.querySelector('h1')?.getAttribute('title'), scenario.expected);
    }
  } finally {
    await act(async () => { root.unmount(); });
    controller.destroy();
    await window.happyDOM.close();
  }
});
