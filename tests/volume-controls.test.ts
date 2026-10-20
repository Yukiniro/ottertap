import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, act } from 'react';
import { Window } from 'happy-dom';
import { defaultSettings, type MediaClient, type MediaState, type SettingsStore } from '../lib/types';

test('面板和音量药丸的真实滑块：双向拖动吸附、松手保留、方向键可脱离、Home/End 到边界', async () => {
  const window = new Window({ url: 'https://example.com' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  const { FloatingController } = await import('../components/floating');
  const store: SettingsStore = { async load() { return defaultSettings; }, async save() {}, watch() { return () => {}; } };
  try {
    for (const vertical of [false, true]) {
      let media: MediaState = { id: '1', host: 'example.com', label: '', title: '媒体', kind: 'video', volume: .75, maxVolume: 2, muted: false, paused: false, rate: 1, currentTime: 0, duration: 100, live: false, seekable: [], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };
      const commands: number[] = [];
      const client: MediaClient = {
        async read() { return { enabled: true, host: 'example.com', selectedId: '1', media: [{ ...media }] }; },
        async command(_, command) { if (command.type === 'volume') { media = { ...media, volume: command.value }; commands.push(command.value * 100); } },
        async select() {}, async highlight() {}
      };
      const host = window.document.createElement('div'); window.document.body.append(host);
      const root = createRoot(host as unknown as HTMLElement);
      try {
        await act(async () => { root.render(createElement(ThemeProvider, { store, children: vertical ? createElement(FloatingController, { client }) : createElement(MediaPanel, { client, openSettings() {} }) })); });
        if (vertical) await act(async () => { host.querySelector('[data-slot="popover-trigger"]')!.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
        const input = host.querySelector('input[aria-label="音量"]')!;
        const slider = input.closest('[data-slot="slider"]')!;
        const control = slider.querySelector('[data-slot="slider-track"]')!.parentElement!;
        const thumb = slider.querySelector('[data-slot="slider-thumb"]')!;
        control.getBoundingClientRect = () => new window.DOMRect(0, 0, 210, 210);
        thumb.getBoundingClientRect = () => new window.DOMRect(0, 0, 10, 10);
        const pointer = (type: string, percent: number) => new window.PointerEvent(type, { bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: vertical ? 105 : percent + 5, clientY: vertical ? 205 - percent : 105 });
        await act(async () => { control.dispatchEvent(pointer('pointerdown', 96)); });
        assert.equal(media.volume, .96);
        for (const [raw, expected] of [[97, 100], [99, 100], [103, 100], [104, 104], [103, 100], [97, 100], [96, 96], [101, 100]]) {
          await act(async () => { window.document.dispatchEvent(pointer('pointermove', raw!)); });
          assert.equal(Math.round(media.volume * 100), expected, `orientation=${vertical ? 'vertical' : 'horizontal'}, pointer=${raw}`);
          assert.equal(input.getAttribute('aria-valuenow'), String(expected));
        }
        await act(async () => { window.document.dispatchEvent(pointer('pointerup', 101)); });
        assert.equal(media.volume, 1, '松手不能提交未经吸附的原始值');
        for (const [key, expected] of [['ArrowUp', 101], ['ArrowDown', 100], ['ArrowDown', 99], ['PageUp', 100], ['PageUp', 110], ['Home', 0], ['End', 200]] as const) {
          await act(async () => { input.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true })); });
          assert.equal(Math.round(media.volume * 100), expected, key);
        }
        if (vertical) {
          await act(async () => { control.dispatchEvent(pointer('pointerdown', 95)); window.document.dispatchEvent(pointer('pointerup', 95)); });
          commands.length = 0;
          await act(async () => {
            input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, shiftKey: true, bubbles: true }));
            input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, shiftKey: true, repeat: true, bubbles: true }));
            await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
          });
          assert.deepEqual(commands.map(Math.round), [100, 110]);
          commands.length = 0;
          await act(async () => {
            // happy-dom's WheelEvent omits MouseEvent modifier properties.
            for (const axes of [{ deltaX: 200, deltaY: 0 }, { deltaX: 0, deltaY: 100 }]) input.dispatchEvent(Object.assign(new window.WheelEvent('wheel', { ...axes, bubbles: true }), { altKey: true, shiftKey: true, ctrlKey: false, metaKey: false }));
            await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));
          });
          assert.deepEqual(commands.map(Math.round), [100, 90]);
        }
      } finally { await act(async () => root.unmount()); host.remove(); }
    }
  } finally { await window.happyDOM.close(); }
});
