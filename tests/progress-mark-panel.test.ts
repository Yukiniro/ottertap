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

const base: MediaState = { id: '1', host: 'example.com', label: '', title: '正片', kind: 'video', volume: .5, maxVolume: 1, muted: false, paused: true, rate: 1, currentTime: 40, duration: 120, live: false, seekable: [{ start: 0, end: 120 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };

async function render(media: MediaState[], selectedId = media[0]?.id ?? '') {
  const window = new Window({ url: 'https://example.com' });
  browser(window);
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  const sent: MediaCommand[] = [];
  let items = media.map(item => ({ ...item }));
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId, media: items }; },
    async command(target, command) {
      sent.push(command);
      if (command.type === 'mark' && command.action === 'set') items = items.map(item => item.id === target.id ? { ...item, mark: item.currentTime } : item);
      if (command.type === 'mark' && command.action === 'clear') items = items.map(item => item.id === target.id ? { ...item, mark: undefined } : item);
      if (command.type === 'mark' && command.action === 'jump') items = items.map(item => item.id === target.id && typeof item.mark === 'number' ? { ...item, currentTime: item.mark } : item);
      if (command.type === 'skip') items = items.map(item => item.id === target.id ? { ...item, currentTime: item.currentTime + command.value } : item);
      if (command.type === 'frame') items = items.map(item => item.id === target.id ? { ...item, paused: true, currentTime: item.currentTime + command.direction / 30 } : item);
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
  const status = () => host.querySelector('#progress-mark-status')?.textContent ?? '';
  const tick = () => host.querySelector('[data-progress-mark]') as HTMLElement | null;
  return { window, host, root, sent, button, status, tick };
}

test('设标记后进度条旁出现位置，跳转和清除可用，快进和逐帧仍可点', async () => {
  const view = await render([base]);
  try {
    const set = view.button('设标记');
    const jump = view.button('跳到标记');
    const clear = view.button('清除标记');
    assert.ok(set && jump && clear);
    assert.equal(set.disabled, false);
    assert.equal(jump.disabled, true);
    assert.equal(clear.disabled, true);
    assert.equal(view.status(), '');
    assert.equal(view.tick(), null);
    assert.equal(view.button('下一帧')?.disabled, false);
    assert.equal(view.button('前进 10 秒')?.disabled, false);

    await act(async () => { set.click(); });
    assert.deepEqual(view.sent, [{ type: 'mark', action: 'set' }]);
    assert.equal(view.status(), '标记在 00:40');
    assert.equal(view.button('跳到标记')?.disabled, false);
    assert.equal(view.button('清除标记')?.disabled, false);
    const ratio = 40 / 120;
    assert.equal(view.tick()?.style.left, `calc(${ratio} * (100% - 0.75rem) + 0.375rem)`);

    await act(async () => { view.button('前进 10 秒')?.click(); });
    await act(async () => { view.button('下一帧')?.click(); });
    assert.equal(view.status(), '标记在 00:40');
    assert.deepEqual(view.sent.slice(1), [{ type: 'skip', value: 10 }, { type: 'frame', direction: 1 }]);

    await act(async () => { view.button('跳到标记')?.click(); });
    assert.deepEqual(view.sent.at(-1), { type: 'mark', action: 'jump' });
    assert.equal(view.status(), '标记在 00:40');

    await act(async () => { view.button('清除标记')?.click(); });
    assert.deepEqual(view.sent.at(-1), { type: 'mark', action: 'clear' });
    assert.equal(view.status(), '');
    assert.equal(view.tick(), null);
    assert.equal(view.button('跳到标记')?.disabled, true);
    const sent = view.sent.length;
    await act(async () => { view.button('跳到标记')?.click(); });
    assert.equal(view.sent.length, sent);
  } finally {
    await act(async () => { view.root.unmount(); });
    await view.window.happyDOM.close();
  }
});

test('换到另一条媒体时不显示这条的标记', async () => {
  const marked: MediaState = { ...base, id: 'a', title: '甲', mark: 40, currentTime: 10 };
  const other: MediaState = { ...base, id: 'b', title: '乙', currentTime: 80 };
  const away = await render([marked, other], 'b');
  try {
    assert.equal(away.host.querySelector('h1')?.textContent, '乙');
    assert.equal(away.status(), '');
    assert.equal(away.tick(), null);
    assert.equal(away.button('跳到标记')?.disabled, true);
    assert.equal(away.button('设标记')?.disabled, false);
  } finally {
    await act(async () => { away.root.unmount(); });
    await away.window.happyDOM.close();
  }
  const home = await render([marked, other], 'a');
  try {
    assert.equal(home.host.querySelector('h1')?.textContent, '甲');
    assert.equal(home.status(), '标记在 00:40');
    assert.ok(home.tick());
    assert.equal(home.button('跳到标记')?.disabled, false);
  } finally {
    await act(async () => { home.root.unmount(); });
    await home.window.happyDOM.close();
  }
});

test('直播和不可跳转时标记入口禁用并说明', async () => {
  for (const media of [
    { ...base, live: true, duration: null, seekable: [{ start: 20, end: 40 }], mark: 30 },
    { ...base, seekable: [], duration: null, mark: 30 }
  ]) {
    const view = await render([media]);
    try {
      assert.equal(view.button('设标记')?.disabled, true);
      assert.equal(view.button('跳到标记')?.disabled, true);
      assert.equal(view.button('清除标记')?.disabled, true);
      assert.equal(view.status(), '直播和无法跳转的媒体不能设标记。');
      assert.equal(view.tick(), null);
      assert.equal(view.button('上一帧')?.disabled, true);
      await act(async () => { view.button('设标记')?.click(); });
      assert.deepEqual(view.sent, []);
    } finally {
      await act(async () => { view.root.unmount(); });
      await view.window.happyDOM.close();
    }
  }
});
