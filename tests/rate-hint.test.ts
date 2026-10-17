import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act, Fragment } from 'react';
import { rateHintEvent } from '../lib/hotkey';
import { defaultSettings, type MediaClient, type Settings, type SettingsStore } from '../lib/types';

test('倍速提示在浮动控制器隐藏时仍显示，并对读屏可读', async () => {
  const window = new Window({ url: 'https://example.com' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MutationObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { FloatingController } = await import('../components/floating');
  const { RateHint } = await import('../components/rate-hint');
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: '', media: [] }; },
    async command() {},
    async select() {},
    async highlight() {}
  };
  const settings: Settings = { ...defaultSettings, floating: false };
  const store: SettingsStore = { async load() { return settings; }, async save() {}, watch() { return () => {}; } };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  try {
    const hint = createElement(RateHint);
    const floating = createElement(FloatingController, { client });
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(Fragment, null, floating, hint) })); });
    assert.equal(host.querySelector('aside'), null);
    const show = async (rate: number) => {
      await act(async () => { window.dispatchEvent(new window.CustomEvent(rateHintEvent, { detail: rate as unknown as object })); });
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    };
    await show(1.5);
    const status = host.querySelector('[role="status"]')!;
    assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.equal(status.textContent, '倍速 1.5×');
    assert.equal(status.className.includes('opacity-100'), true);
    await show(1.1);
    assert.equal(status.textContent, '倍速 1.1×');
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
