import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { defaultSettings, type MediaCommand } from '../lib/types';

test('后台按当前滚轮方向解释刻度，方向键和扩展命令不反转', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const listeners: Array<(command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void> = [];
  const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void): void } };
  const original = commands.onCommand;
  commands.onCommand = { addListener(callback) { listeners.push(callback); } };
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  let volume = .5;
  const applied: number[] = [];
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string; command?: MediaCommand }) => {
    if (message.type === 'snapshot') return { media: [{ id: '1', paused: false, muted: false, volume, maxVolume: 2, rate: 1 }] };
    if (message.type === 'command' && message.command?.type === 'volume') {
      volume = message.command.value;
      applied.push(Math.round(volume * 1000) / 1000);
    }
    return { ok: true };
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const sender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
    const request = (message: object) => new Promise<unknown>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, sender, resolve);
    });
    const wheel = (notches: number) => request({ type: 'hotkey', action: { type: 'volume', notches } });
    const jump = async (value: number) => {
      await request({ type: 'command', id: '0:1', command: { type: 'volume', value } });
    };
    await wheel(1);
    assert.equal(applied.at(-1), .6, '默认向上的一格加大音量');
    await wheel(-1);
    assert.equal(applied.at(-1), .5, '默认向下的一格减小音量');
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, wheelDirection: 'down' } });
    await wheel(1);
    assert.equal(applied.at(-1), .4, '改成向下增大后，同一向上刻度立刻减小');
    await wheel(-1);
    assert.equal(applied.at(-1), .5, '向下刻度在向下增大时加大');
    await jump(.1);
    await wheel(1);
    assert.equal(applied.at(-1), .09, '反向时低于 25% 仍按 1%');
    await jump(.5);
    await request({ type: 'hotkey', action: { type: 'volume', delta: 10 } });
    assert.equal(applied.at(-1), .6, '方向键不跟着反');
    await Promise.all(listeners.map(listener => listener('volume-up')));
    assert.equal(applied.at(-1), .7, '扩展命令不跟着反');
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, wheelDirection: 'up' } });
    await wheel(1);
    assert.equal(applied.at(-1), .8, '改回向上增大后同一刻度立刻加大');
    const legacy = { ...defaultSettings } as Partial<typeof defaultSettings>;
    delete legacy.wheelDirection;
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': legacy });
    await jump(.5);
    await wheel(1);
    assert.equal(applied.at(-1), .6, '旧设置没有这一项时仍向上增大');
  } finally {
    commands.onCommand = original;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
