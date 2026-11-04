import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act, type ReactNode } from 'react';
import type { SleepTimerClient } from '../lib/sleep-timer';
import { defaultSettings, type MediaClient, type MediaState, type SettingsStore } from '../lib/types';

const clip: MediaState = { id: '0:1', host: 'example.com', label: '', title: '播客', kind: 'audio', volume: 1, maxVolume: 1, muted: false, paused: false, rate: 1, currentTime: 30, duration: 3600, live: false, seekable: [{ start: 0, end: 3600 }], pip: false, pipAvailable: false, pipBlock: 'audio', channel: 'stereo', channelAvailable: true };
const clock = (text: string) => text.split(':').reduce((total, part) => total * 60 + Number(part), 0);

async function render(options: { fail?: 'extend' | 'cancel' } = {}) {
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
  const actions: string[] = [];
  const commands: string[] = [];
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'example.com', selectedId: clip.id, media: [{ ...clip }], ...(sleepAt == null ? {} : { sleepAt }) }; },
    async command(_media, command) { commands.push(command.type); },
    async select() {},
    async highlight() {},
  };
  const sleep: SleepTimerClient = {
    async start(minutes) {
      started.push(minutes);
      sleepAt = Date.now() + minutes * 60_000;
    },
    async cancel() {
      if (options.fail === 'cancel') throw new Error('这一页现在控不了。');
      actions.push('cancel');
      sleepAt = undefined;
    },
    async extend() {
      if (options.fail === 'extend') throw new Error('这一页现在控不了。');
      if (sleepAt == null) throw new Error('现在没有睡眠定时。');
      actions.push('extend');
      sleepAt += 15 * 60_000;
    },
  };
  const store: SettingsStore = { async load() { return defaultSettings; }, async save() {}, watch() { return () => {}; } };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(MediaPanel, { client, openSettings() {}, sleep }) as ReactNode })); });
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
  return {
    window, started, actions, commands, trigger, open, click, query,
    close: async () => { await act(async () => { root.unmount(); }); await window.happyDOM.close(); },
  };
}

test('没开定时时不显示取消和续时', async () => {
  const view = await render();
  try {
    await view.open();
    assert.equal(view.query('button[aria-label="取消睡眠"]'), null);
    assert.equal(view.query('button[aria-label="再续 +15 分钟"]'), null);
    assert.equal(view.query('#sleep-timer-feedback'), null);
  } finally { await view.close(); }
});

test('续时把剩余加上 15 分钟，并留下看得见的说明', async () => {
  const view = await render();
  try {
    await view.open();
    await view.click('button[aria-label="15 分钟后暂停"]');
    const before = clock(view.trigger()?.textContent ?? '');
    assert.ok(before > 14 * 60 && before <= 15 * 60, `开始后约 15 分钟：${before}`);
    await view.open();
    assert.ok(view.query('button[aria-label="取消睡眠"]'));
    assert.ok(view.query('button[aria-label="再续 +15 分钟"]'));
    await view.click('button[aria-label="再续 +15 分钟"]');
    assert.deepEqual(view.actions, ['extend']);
    assert.deepEqual(view.commands, [], '续时不改播放');
    const after = clock(view.trigger()?.textContent ?? '');
    assert.ok(after >= before + 15 * 60 - 2 && after <= before + 15 * 60 + 1, `剩余应增加 15 分钟：${before} -> ${after}`);
    const feedback = view.query('#sleep-timer-feedback');
    assert.equal(feedback?.textContent, '已再续 15 分钟。');
    assert.equal(feedback?.getAttribute('role'), 'status');
    assert.equal(feedback?.className.includes('sr-only'), false, '续时说明不是只给读屏');
    assert.match(view.query('#sleep-timer-status')?.textContent ?? '', /已再续 15 分钟/);
    assert.equal(view.query('button[aria-label="15 分钟后暂停"]') == null, false, '弹层还开着，可以再操作');
  } finally { await view.close(); }
});

test('取消后倒计时消失、播放不变，并且可以再设', async () => {
  const view = await render();
  try {
    await view.open();
    await view.click('button[aria-label="30 分钟后暂停"]');
    await view.open();
    await view.click('button[aria-label="取消睡眠"]');
    assert.deepEqual(view.actions, ['cancel']);
    assert.deepEqual(view.commands, [], '取消不暂停');
    assert.equal(view.trigger()?.textContent, '');
    assert.equal(view.trigger()?.hasAttribute('data-running'), false);
    const feedback = view.query('#sleep-timer-feedback');
    assert.equal(feedback?.textContent, '已取消睡眠，播放没有变化。');
    assert.equal(feedback?.getAttribute('role'), 'status');
    assert.equal(feedback?.className.includes('sr-only'), false);
    assert.equal(view.query('#sleep-timer-status')?.textContent, '已取消睡眠，播放没有变化。');
    assert.ok(view.query('button[aria-label="15 分钟后暂停"]'), '取消后档位还在，误触可以再设');
    await view.click('button[aria-label="15 分钟后暂停"]');
    assert.deepEqual(view.started, [30, 15]);
    const text = view.trigger()?.textContent ?? '';
    assert.ok(text === '15:00' || text === '14:59', `再设后倒计时回来：${text}`);
    assert.equal(view.query('#sleep-timer-feedback'), null, '再设之后收起弹层，取消说明不再占着');
    assert.match(view.query('#sleep-timer-status')?.textContent ?? '', /后暂停$/);
  } finally { await view.close(); }
});

test('取消或续时失败时留下说明，倒计时还在', async () => {
  const view = await render({ fail: 'cancel' });
  try {
    await view.open();
    await view.click('button[aria-label="15 分钟后暂停"]');
    await view.open();
    const before = view.trigger()?.textContent;
    await view.click('button[aria-label="取消睡眠"]');
    assert.equal(view.query('[role="alert"]')?.textContent, '这一页现在控不了。');
    assert.equal(view.trigger()?.textContent, before, '失败不把倒计时清掉');
    assert.equal(view.query('#sleep-timer-feedback'), null);
  } finally { await view.close(); }
});
