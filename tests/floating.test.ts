import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { defaultSettings, type MediaClient, type MediaState, type Settings, type SettingsStore } from '../lib/types';

test('浮动入口贴边半隐藏、可切换侧边；药丸可调到 150%、静音恢复，并在 Escape 和外部点击后收起', async () => {
  const window = new Window({ url: 'https://example.com' });
  const globals = ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const;
  for (const name of globals) Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { FloatingController } = await import('../components/floating');
  let media: MediaState = { id: '1', title: '测试媒体', host: 'example.com', kind: 'video', paused: false, muted: false, volume: .75, maxVolume: 1.5, rate: 1, currentTime: 10, duration: 100, live: false, seekable: [{ start: 0, end: 100 }] };
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', media: [{ ...media }] }; },
    async command(_, value) { if (value.type === 'mute') media = { ...media, muted: !media.muted }; else if (value.type === 'volume') media = { ...media, volume: value.value, muted: false }; }
  };
  let settings: Settings = defaultSettings;
  const store: SettingsStore = { async load() { return settings; }, async save(next) { settings = next; }, watch() { return () => {}; } };
  const shadowHost = window.document.createElement('div'); window.document.body.append(shadowHost);
  const host = window.document.createElement('div'); shadowHost.attachShadow({ mode: 'open' }).append(host);
  shadowHost.addEventListener('keydown', event => event.stopPropagation());
  const root = createRoot(host as unknown as HTMLElement);
  try {
  const trigger = () => host.querySelector('[data-slot="popover-trigger"]')!;
  const slider = () => host.querySelector('input[type="range"]')!;
  const dock = () => host.querySelector('aside')!;
  await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(FloatingController, { client }) })); });
  assert.equal(!!host.querySelector('[role="dialog"]'), false);
  assert.equal(dock().dataset.side, 'right');
  assert.equal(dock().dataset.revealed, 'false');
  await act(async () => { dock().dispatchEvent(new window.PointerEvent('pointerover', { bubbles: true, composed: true })); });
  assert.equal(dock().dataset.revealed, 'true');
  await act(async () => { dock().dispatchEvent(new window.PointerEvent('pointerout', { bubbles: true, composed: true, relatedTarget: window.document.body })); await new Promise(resolve => setTimeout(resolve, 350)); });
  assert.equal(dock().dataset.revealed, 'false');
  await act(async () => { trigger().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); });
  assert.equal(dock().dataset.side, 'left');
  assert.equal(settings.floatingPosition.side, 'left');
  await act(async () => { trigger().dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
  assert.equal(trigger().getAttribute('aria-expanded'), 'true');
  assert.equal(dock().dataset.revealed, 'true');
  assert.equal(host.querySelector('[data-slot="popover-content"]')!.getAttribute('data-side'), 'right');
  assert.equal(slider().getAttribute('aria-orientation'), 'vertical');
  assert.equal(slider().getAttribute('aria-valuenow'), '75');
  assert.equal(slider().getAttribute('max'), '150');
  assert.ok(host.querySelector('[data-slot="volume-limit-mark"]'));
  await act(async () => { slider().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true })); });
  assert.equal(media.volume, .76);
  await act(async () => { host.querySelector('button[aria-label="静音"]')!.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
  assert.equal(media.muted, true);
  assert.equal(media.volume, .76);
  assert.equal(slider().getAttribute('aria-valuenow'), '0');
  await act(async () => { host.querySelector('button[aria-label="取消静音"]')!.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
  assert.equal(media.muted, false);
  assert.equal(slider().getAttribute('aria-valuenow'), '76');
  assert.equal(host.querySelector('[data-slot="slider"]')!.getAttribute('data-boost'), 'false');
  await act(async () => { slider().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true })); });
  assert.equal(media.volume, 1.5);
  assert.equal(host.querySelector('[data-slot="slider"]')!.getAttribute('data-boost'), 'true');
  await act(async () => { for (const type of ['pointerdown', 'pointerup'] as const) host.querySelector('[role="dialog"] span')!.dispatchEvent(new window.PointerEvent(type, { bubbles: true, composed: true })); });
  assert.ok(host.querySelector('[role="dialog"]'), 'Shadow DOM 内部点击不应误判为外部点击');
  await act(async () => { slider().dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true })); });
  assert.equal(!!host.querySelector('[role="dialog"]'), false);
  await act(async () => { trigger().dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
  await act(async () => { for (const type of ['pointerdown', 'pointerup', 'click'] as const) window.document.body.dispatchEvent(new (type === 'click' ? window.MouseEvent : window.PointerEvent)(type, { bubbles: true })); });
  assert.equal(!!host.querySelector('[role="dialog"]'), false);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
