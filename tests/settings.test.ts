import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

test('设置分类只显示对应属性，保存保留其他分类数据，失败时不误报已保存', async () => {
  const window = new Window({ url: 'https://example.com' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { SettingsPage } = await import('../components/settings-page');
  let value: Settings = { ...defaultSettings, theme: 'light', sites: ['bilibili.com'] };
  let reject = false;
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { if (reject) throw new Error('storage failed'); value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div'); window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const button = (label: string) => [...host.querySelectorAll('button')].find(item => item.textContent === label)!;
  const click = async (element: Element) => { await act(async () => { (element as unknown as HTMLElement).click(); }); };
  try {
    await act(async () => { root.render(createElement(SettingsPage, { store })); });
    assert.equal(host.querySelector('h1')!.textContent, '网站规则');
    assert.ok(host.querySelector('#site-domain'));
    assert.equal(host.querySelector('[role="tab"][aria-selected="true"]')!.textContent, '网站规则');
    await click(button('外观') as unknown as Element);
    assert.equal(host.querySelector('h1')!.textContent, '外观');
    assert.equal(host.querySelector('#site-domain'), null);
    await click(button('深色') as unknown as Element);
    assert.equal(value.theme, 'dark');
    assert.deepEqual(value.sites, ['bilibili.com']);
    await click(button('浮动控制器') as unknown as Element);
    assert.equal(host.querySelector('[role="switch"]')!.getAttribute('aria-checked'), 'true');
    reject = true;
    await click(host.querySelector('[role="switch"]') as unknown as Element);
    assert.equal(value.floating, true);
    assert.match(host.querySelector('[role="status"]')!.textContent!, /未保存/);
    assert.match(host.querySelector('[role="alert"]')!.textContent!, /设置未保存/);
    reject = false;
    await click(host.querySelector('[role="switch"]') as unknown as Element);
    assert.equal(value.floating, false);
    assert.equal(value.theme, 'dark');
    assert.deepEqual(value.sites, ['bilibili.com']);
    await click(button('网站规则') as unknown as Element);
    assert.ok(host.querySelector('#site-domain'));
    assert.match(host.querySelector('[role="list"][aria-label="网站列表"]')!.textContent!, /bilibili.com/);
    assert.equal(host.querySelector('[role="switch"]'), null);
    assert.equal(listeners.size, 1);
  } finally {
    await act(async () => { root.unmount(); });
    assert.equal(listeners.size, 0);
    await window.happyDOM.close();
  }
});
