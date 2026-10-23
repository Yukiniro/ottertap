import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

test('设置同页展示全部项，保存只改对应字段，失败时不误报已保存', async () => {
  const window = new Window({ url: 'https://example.com' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
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
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
    assert.equal(host.querySelector('h1')!.textContent, '设置');
    assert.ok(host.querySelector('#theme-label'));
    assert.ok(host.querySelector('#settings-floating'));
    assert.ok(host.querySelector('#site-domain'));
    await click(button('深色') as unknown as Element);
    assert.equal(value.theme, 'dark');
    assert.deepEqual(value.sites, ['bilibili.com']);
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
    assert.match(host.querySelector('[role="list"][aria-label="网站列表"]')!.textContent!, /bilibili.com/);
    assert.doesNotMatch(host.querySelector('#shortcuts')!.textContent!, /Shift/);
    const pageKeys = [...host.querySelectorAll('dl[aria-label="页内快捷键"] kbd')].map(node => node.textContent);
    assert.deepEqual(pageKeys, ['Alt + 滚轮', ',', '.', 'Alt + .', 'Alt + ,', 'Alt + 0', 'Alt + M']);
    const singleKeys = [...host.querySelectorAll('dl[aria-label="单键模式按键"] kbd')].map(node => node.textContent);
    assert.deepEqual(singleKeys, ['K', 'J / ←', 'L / →', '↑', '↓', 'M', '>', '<']);
    assert.match(host.textContent!, /输入框或可编辑区域/);
    for (const [label, key, initial] of [['悬停在主播放区直接用滚轮调音量', 'hoverWheel', true], ['单键模式', 'singleKey', false]] as const) {
      const toggle = host.querySelector(`[role="switch"][aria-label="${label}"]`);
      assert.ok(toggle, label);
      assert.equal(toggle.getAttribute('aria-checked'), String(initial), label);
      await click(toggle as unknown as Element);
      assert.equal(value[key], !initial);
      await click(toggle as unknown as Element);
      assert.equal(value[key], initial);
    }
    assert.match(host.textContent!, /加快 0\.25×/);
    assert.match(host.textContent!, /减慢 0\.25×/);
    assert.match(host.textContent!, /回到 1×，再按切回/);
    assert.match(host.textContent!, /1× 与之前的倍速间切换/);
    assert.match(host.textContent!, /, \. 0/);
    assert.match(host.textContent!, /暂停后上一帧/);
    assert.match(host.textContent!, /会先暂停，再移动一帧/);
    assert.match(host.textContent!, /锁定倍速/);
    const lock = host.querySelector('[role="switch"][aria-label="锁定倍速"]');
    assert.ok(lock);
    assert.equal(lock.getAttribute('aria-checked'), 'false');
    await click(lock as unknown as Element);
    assert.equal(value.lockRate, true);
    assert.equal(value.floating, false);
    assert.equal(listeners.size, 1);
  } finally {
    await act(async () => { root.unmount(); });
    assert.equal(listeners.size, 0);
    await window.happyDOM.close();
  }
});
