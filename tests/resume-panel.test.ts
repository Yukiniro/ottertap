import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { defaultSettings, type MediaClient, type MediaCommand, type MediaState, type Settings, type SettingsStore } from '../lib/types';

function browser(window: Window) {
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true, writable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
}

const base: MediaState = { id: '1', host: 'example.com', label: '', title: '正片', kind: 'video', volume: .5, maxVolume: 1, muted: false, paused: true, rate: 1, currentTime: 5, duration: 300, live: false, seekable: [{ start: 0, end: 300 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };

async function render(media: MediaState[]) {
  const window = new Window({ url: 'https://example.com' });
  browser(window);
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  const sent: MediaCommand[] = [];
  let items = media.map(item => ({ ...item }));
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: items[0]?.id ?? '', media: items.map(item => ({ ...item })) }; },
    async command(target, command) {
      sent.push(command);
      if (command.type === 'resume' && command.action === 'jump') items = items.map(item => item.id === target.id ? { ...item, currentTime: (item.resume ?? 0) - 3 } : item);
      if (command.type === 'resume' && command.action === 'clear') items = items.map(item => { const { resume, ...rest } = item; return item.id === target.id ? rest : item; });
    },
    async select() {},
    async highlight() {}
  };
  const value: Settings = { ...defaultSettings };
  const store: SettingsStore = { async load() { return value; }, async save() {}, watch() { return () => {}; } };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { client, openSettings() {} }) })); });
  const button = (label: string) => host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
  return { window, host, root, sent, button };
}

test('有接着看进度时出现跳转和清除，点了跳回去；没有进度不占位；不可跳转时禁用', async () => {
  const view = await render([{ ...base, resume: 120 }]);
  try {
    const jump = view.button('跳到接着看');
    const clear = view.button('清除接着看');
    assert.ok(jump && clear, '两个入口都在进度行里');
    assert.equal(jump!.disabled, false);
    assert.equal(jump!.title, '跳到接着看 · 02:00');
    await act(async () => { jump!.click(); });
    assert.deepEqual(view.sent, [{ type: 'resume', action: 'jump' }]);
    await act(async () => { clear!.click(); });
    assert.deepEqual(view.sent.at(-1), { type: 'resume', action: 'clear' });

    const empty = await render([{ ...base }]);
    assert.equal(empty.button('跳到接着看'), null, '没有进度不占位');
    assert.equal(empty.button('清除接着看'), null);

    const unseekable = await render([{ ...base, resume: 120, seekable: [] }]);
    assert.equal(unseekable.button('跳到接着看')!.disabled, true, '不可跳转时禁用');
    await empty.window.happyDOM.close();
    await unseekable.window.happyDOM.close();
  } finally { await view.window.happyDOM.close(); }
});
