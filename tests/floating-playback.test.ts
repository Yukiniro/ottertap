import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { maxGain } from '../lib/amplifier';
import { defaultSettings, type MediaClient, type MediaCommand, type MediaState, type Settings, type SettingsStore } from '../lib/types';

test('展开浮动药丸后可播放暂停，并按面板同一条步进路径跳转', async () => {
  const window = new Window({ url: 'https://example.com' });
  const globals = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'CustomEvent', 'MutationObserver', 'ResizeObserver'] as const;
  for (const name of globals) Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { FloatingController } = await import('../components/floating');
  const times = '×';
  let media: MediaState = { id: '1', title: '测试媒体', label: '测试媒体', host: 'example.com', kind: 'video', paused: true, muted: false, volume: 1, maxVolume: maxGain, rate: 1, currentTime: 40, duration: 120, live: false, seekable: [{ start: 0, end: 120 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };
  const sent: MediaCommand[] = [];
  let gate = Promise.resolve();
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: '1', media: [{ ...media }] }; },
    async command(_, value) {
      sent.push(value);
      await gate;
      if (value.type === 'play') media = { ...media, paused: false };
      else if (value.type === 'pause') media = { ...media, paused: true };
      else if (value.type === 'skip') media = { ...media, currentTime: media.currentTime + value.value };
      else if (value.type === 'volume') media = { ...media, volume: value.value, muted: false };
      else if (value.type === 'mute') media = { ...media, muted: !media.muted };
      else if (value.type === 'rate') media = { ...media, rate: value.value };
    },
    async select() {},
    async highlight() {}
  };
  let settings: Settings = { ...defaultSettings };
  const listeners = new Set<(value: Settings) => void>();
  const store: SettingsStore = {
    async load() { return settings; },
    async save(next) { settings = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const button = (label: string) => host.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
  const click = async (element: HTMLButtonElement) => { await act(async () => { element.click(); }); };
  const publish = async (next: Settings) => {
    settings = next;
    await act(async () => { listeners.forEach(listener => listener(next)); });
  };
  const skipValue = (command: MediaCommand | undefined) => command?.type === 'skip' ? command.value : undefined;
  const refresh = async () => {
    const slider = host.querySelector('input[type="range"]')!;
    await act(async () => { slider.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true })); });
  };
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(FloatingController, { client }) })); });
    const trigger = host.querySelector('[data-slot="popover-trigger"]')!;
    await act(async () => { trigger.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    assert.equal(host.querySelector('input[type="range"]')!.getAttribute('aria-valuenow'), '100');
    await refresh();
    assert.equal(media.volume, .99, '音量滑块仍能调节');
    assert.ok(host.querySelector('[role="group"][aria-labelledby="floating-speed-label"]'));
    await click(button(`加快 0.25${times}`)!);
    assert.equal(media.rate, 1.25, '倍速加快仍走原来的指令');
    await click(button('1 倍速')!);
    assert.equal(media.rate, 1);

    assert.equal(button('播放')!.disabled, false);
    await click(button('播放')!);
    assert.equal(media.paused, false);
    assert.equal(button('暂停')!.getAttribute('aria-label'), '暂停');
    await click(button('暂停')!);
    assert.equal(media.paused, true);
    assert.deepEqual(sent.filter(item => item.type === 'play' || item.type === 'pause'), [{ type: 'play' }, { type: 'pause' }]);

    const back = button('后退 10 秒')!;
    const forward = button('前进 10 秒')!;
    assert.equal(back.disabled, false);
    assert.equal(forward.disabled, false);
    assert.equal(back.querySelector('span')?.textContent, '10');
    assert.equal(forward.querySelector('span')?.textContent, '10');
    assert.equal(host.querySelector('#floating-skip-hint'), null);
    await click(back);
    await click(forward);
    assert.deepEqual(sent.filter(item => item.type === 'skip'), [{ type: 'skip', value: -10 }, { type: 'skip', value: 10 }]);

    await publish({ ...settings, skipSeconds: 30 });
    assert.equal(button('后退 10 秒'), null);
    assert.equal(button('前进 30 秒')?.querySelector('span')?.textContent, '30');
    await click(button('前进 30 秒')!);
    assert.equal(skipValue(sent.at(-1)), 30);

    await publish({ ...settings, skipSeconds: 10, skipWithRate: true });
    assert.equal(button('前进 10 秒')?.querySelector('span')?.textContent, '10', '1× 时随倍速仍是 10 秒');
    let release = () => {};
    gate = new Promise(resolve => { release = resolve; });
    await act(async () => { button(`加快 0.25${times}`)!.click(); });
    assert.equal(button('前进 13 秒')?.querySelector('span')?.textContent, '13', '连点倍速时跳转秒数跟着已经显示的倍速走');
    release();
    gate = Promise.resolve();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    assert.equal(media.rate, 1.25);

    media = { ...media, rate: 2 };
    await refresh();
    assert.equal(button('前进 20 秒')?.querySelector('span')?.textContent, '20');
    await click(button('前进 20 秒')!);
    assert.equal(skipValue(sent.at(-1)), 20);

    media = { ...media, rate: 4 };
    await refresh();
    assert.equal(button('前进 30 秒')?.querySelector('span')?.textContent, '30', '4× 按 3× 限制成 30 秒');
    media = { ...media, rate: 0.25 };
    await refresh();
    assert.equal(button('后退 5 秒')?.querySelector('span')?.textContent, '5', '0.25× 按 0.5× 跳 5 秒');

    media = { ...media, rate: 1, live: true, duration: null, seekable: [] };
    await refresh();
    const blocked = button('前进 10 秒')!;
    assert.equal(blocked.disabled, true);
    assert.equal(blocked.getAttribute('title'), '直播和无法跳转的媒体不能快进快退。');
    assert.equal(host.querySelector('#floating-skip-hint')?.textContent, '直播和无法跳转的媒体不能快进快退。');
    const beforeBlocked = sent.length;
    await click(blocked);
    assert.equal(sent.length, beforeBlocked, '不能跳转时不再下发');
    assert.equal(button('播放')!.disabled, false, '不能跳转时仍可播放');

    media = { ...media, live: true, seekable: [{ start: 20, end: 80 }] };
    await refresh();
    assert.equal(button('前进 10 秒')!.disabled, false, '有可跳窗口的直播与面板一样可以跳');
    assert.equal(host.querySelector('#floating-skip-hint'), null);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
