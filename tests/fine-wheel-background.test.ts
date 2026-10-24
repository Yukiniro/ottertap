import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { defaultSettings, type MediaCommand } from '../lib/types';

test('后台按手势里的当前音量给滚轮刻度选步长，方向键和扩展命令不改', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const listeners: Array<(command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void> = [];
  const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void): void } };
  const original = commands.onCommand;
  commands.onCommand = { addListener(callback) { listeners.push(callback); } };
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  let volume = .1;
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
    await wheel(1);
    await wheel(4);
    assert.deepEqual(applied.slice(0, 3), [.11, .12, .16], '低音量连滚仍是 1%');
    await jump(.4);
    await wheel(1);
    assert.equal(applied.at(-1), .5, '25% 以上用 10%');
    await jump(.24);
    await wheel(1);
    await wheel(1);
    assert.deepEqual(applied.slice(-2), [.25, .35], '跨过 25% 的下一格回到常规步长');
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, fineWheel: false, volumeStep: 20 } });
    await jump(.1);
    await wheel(1);
    assert.equal(applied.at(-1), .3, '开关关闭时低音量也用 20%');
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, fineWheel: true, volumeStep: 10 } });
    await jump(.1);
    await request({ type: 'hotkey', action: { type: 'volume', delta: 10 } });
    assert.equal(applied.at(-1), .2, '方向键的百分点不走细档');
    await jump(.1);
    await Promise.all(listeners.map(listener => listener('volume-up')));
    assert.equal(applied.at(-1), .2, '扩展命令在低音量仍用音量步长');
    const legacy = { ...defaultSettings } as Partial<typeof defaultSettings>;
    delete legacy.fineWheel;
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': legacy });
    await jump(.1);
    await wheel(1);
    assert.equal(applied.at(-1), .11, '旧设置没有这一项时仍然细调');
  } finally {
    commands.onCommand = original;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
