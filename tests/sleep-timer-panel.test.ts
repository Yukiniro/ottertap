import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act, type ReactNode } from 'react';
import type { SleepTimerClient } from '../lib/sleep-timer';
import { defaultSettings, type MediaClient, type MediaState, type SettingsStore } from '../lib/types';

const clip: MediaState = { id: '0:1', host: 'example.com', label: '', title: '播客', kind: 'audio', volume: 1, maxVolume: 1, muted: false, paused: false, rate: 1, currentTime: 30, duration: 3600, live: false, seekable: [{ start: 0, end: 3600 }], pip: false, pipAvailable: false, pipBlock: 'audio', channel: 'stereo', channelAvailable: true };

async function render(media: MediaState[], options: { sleep?: boolean; fail?: string } = {}) {
  const window = new Window({ url: 'https://example.com' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { MediaPanel } = await import('../components/media-panel');
  let sleepAt: number | undefined;
  const started: number[] = [];
  let reads = 0;
  const client: MediaClient = {
    async read() { reads += 1; return { enabled: true, host: 'example.com', selectedId: media[0]?.id ?? '', media, ...(sleepAt == null ? {} : { sleepAt }) }; },
    async command() {},
    async select() {},
    async highlight() {},
  };
  const sleep: SleepTimerClient = {
    async start(minutes) {
      if (options.fail) throw new Error(options.fail);
      started.push(minutes);
      sleepAt = Date.now() + minutes * 60_000;
    },
    async cancel() { sleepAt = undefined; },
    async extend() { if (sleepAt != null) sleepAt += 15 * 60_000; },
  };
  const store: SettingsStore = { async load() { return defaultSettings; }, async save() {}, watch() { return () => {}; } };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { client, openSettings() {}, ...(options.sleep === false ? {} : { sleep }) }) as ReactNode })); });
  const query = <T extends Element>(selector: string) => window.document.querySelector(selector) as unknown as T | null;
  const trigger = () => query<HTMLButtonElement>('button[aria-label="睡眠定时"]');
  const open = async () => {
    const button = trigger();
    assert.ok(button);
    await act(async () => {
      for (const event of [
        new window.PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }),
        new window.MouseEvent('mousedown', { bubbles: true, button: 0 }),
        new window.PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }),
        new window.MouseEvent('click', { bubbles: true, button: 0 }),
      ]) button.dispatchEvent(event as unknown as Event);
    });
  };
  const click = async (selector: string) => {
    const button = query<HTMLButtonElement>(selector);
    assert.ok(button, selector);
    await act(async () => { button.click(); });
  };
  const type = async (value: string) => {
    const input = query<HTMLInputElement>('#sleep-timer-custom');
    assert.ok(input);
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value);
      input.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
    });
  };
  const submit = () => query<HTMLButtonElement>('form button[type="submit"]');
  return {
    window, started, trigger, open, click, type, submit, query,
    reads: () => reads,
    close: async () => { await act(async () => { root.unmount(); }); await window.happyDOM.close(); },
  };
}

test('没有媒体时入口不可用并有一句短说明', async () => {
  const view = await render([]);
  try {
    const trigger = view.trigger();
    assert.ok(trigger, '没有媒体时入口仍在');
    assert.equal(trigger.getAttribute('aria-disabled'), 'true');
    assert.equal(trigger.getAttribute('aria-describedby'), 'sleep-timer-status');
    assert.equal(view.query('#sleep-timer-status')?.textContent, '这一页没有可暂停的媒体。');
    assert.equal(trigger.title, '睡眠定时 · 这一页没有可暂停的媒体。');
    assert.equal(trigger.textContent, '');
    await view.open();
    assert.equal(view.query('[data-slot="popover-content"] [data-slot="popover-description"]')?.textContent, '这一页没有可暂停的媒体。');
    assert.equal(view.query('button[aria-label="15 分钟后暂停"]'), null, '不给档位');
    assert.equal(view.query('#sleep-timer-custom'), null);
  } finally { await view.close(); }
});

test('入口在面板标题栏，不占面板高度', async () => {
  const view = await render([clip]);
  try { assert.ok(view.trigger()?.closest('header'), '睡眠定时在标题栏里'); }
  finally { await view.close(); }
});

test('没有传入定时客户端时不占位', async () => {
  const view = await render([clip], { sleep: false });
  try { assert.equal(view.trigger(), null); }
  finally { await view.close(); }
});

test('选一个档位后关闭弹层并显示倒计时', async () => {
  const view = await render([clip]);
  try {
    assert.equal(view.trigger()?.hasAttribute('aria-disabled'), false);
    assert.equal(view.query('#sleep-timer-status'), null);
    assert.equal(view.trigger()?.textContent, '', '默认不开，只有图标');
    assert.equal(view.trigger()?.hasAttribute('data-running'), false);
    await view.open();
    for (const minutes of [15, 30, 45, 60]) assert.ok(view.query(`button[aria-label="${minutes} 分钟后暂停"]`), `有 ${minutes} 分钟档`);
    assert.match(view.query('[data-slot="popover-content"]')?.textContent ?? '', /只暂停小獭在这个标签页里控制的那一条媒体/);
    const reads = view.reads();
    await view.click('button[aria-label="30 分钟后暂停"]');
    assert.deepEqual(view.started, [30]);
    assert.ok(view.reads() > reads, '开始后马上刷新');
    assert.equal(view.query('button[aria-label="30 分钟后暂停"]'), null, '弹层收起');
    const text = view.trigger()?.textContent ?? '';
    assert.ok(text === '30:00' || text === '29:59', `倒计时可见：${text}`);
    assert.equal(view.trigger()?.hasAttribute('data-running'), true);
    assert.match(view.query('#sleep-timer-status')?.textContent ?? '', /^睡眠还剩 (30:00|29:59)$/);
    assert.equal(view.trigger()?.getAttribute('aria-describedby'), 'sleep-timer-status');
  } finally { await view.close(); }
});

test('自定义分钟只收 1 到 180 的整数', async () => {
  const view = await render([clip]);
  try {
    await view.open();
    assert.equal(view.query<HTMLInputElement>('#sleep-timer-custom')?.placeholder, '1–180 分钟');
    assert.equal(view.submit()?.disabled, true, '空着不能开始');
    for (const value of ['0', '181', '2.5', '-3']) {
      await view.type(value);
      assert.equal(view.submit()?.disabled, true, `${value} 不能开始`);
    }
    await view.type('180');
    assert.equal(view.submit()?.disabled, false);
    await view.type('90');
    await view.click('form button[type="submit"]');
    assert.deepEqual(view.started, [90]);
    const text = view.trigger()?.textContent ?? '';
    assert.ok(text === '1:30:00' || text === '1:29:59', `超过一小时带上小时：${text}`);
  } finally { await view.close(); }
});

test('开始失败时留下说明，不显示倒计时', async () => {
  const view = await render([clip], { fail: '这一页没有可暂停的媒体。' });
  try {
    await view.open();
    await view.click('button[aria-label="15 分钟后暂停"]');
    assert.equal(view.query('[role="alert"]')?.textContent, '这一页没有可暂停的媒体。');
    assert.equal(view.trigger()?.textContent, '');
    assert.equal(view.trigger()?.hasAttribute('data-running'), false);
  } finally { await view.close(); }
});
