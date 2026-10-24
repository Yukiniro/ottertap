import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { defaultSettings, type MediaCommand } from '../lib/types';

test('后台对带 Shift 的滚轮刻度用粗调步长，细档、方向键和扩展命令不抢', async () => {
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
    const wheel = (notches: number, shift = false) => request({ type: 'hotkey', action: shift ? { type: 'volume', notches, shift: true } : { type: 'volume', notches } });
    const jump = async (value: number) => {
      await request({ type: 'command', id: '0:1', command: { type: 'volume', value } });
    };
    await wheel(1);
    assert.equal(applied.at(-1), .11, '低音量没按 Shift 仍是 1%');
    await jump(.1);
    await wheel(1, true);
    assert.equal(applied.at(-1), .6, '低音量按住 Shift 用默认粗档 50%，不走 1%');
    await jump(.4);
    await wheel(1);
    assert.equal(applied.at(-1), .5, '25% 以上没按 Shift 用音量步长');
    await wheel(1, true);
    assert.equal(applied.at(-1), 1, '同一音量按住 Shift 用 50%');
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, coarseVolumeStep: 20, volumeStep: 10, fineWheel: true } });
    await jump(.1);
    await wheel(1, true);
    assert.equal(applied.at(-1), .3, '改成 20% 后下一格粗档立刻生效');
    await jump(.04);
    await wheel(1, true);
    assert.equal(applied.at(-1), .24, '粗档 20% 从 4% 落到仍低于 25% 的位置');
    await wheel(1);
    assert.equal(applied.at(-1), .25, '松开 Shift 后，仍低于 25% 时回到 1%');
    await jump(.1);
    await request({ type: 'hotkey', action: { type: 'volume', delta: 10 } });
    assert.equal(applied.at(-1), .2, '方向键不走粗档');
    await jump(.1);
    await Promise.all(listeners.map(listener => listener('volume-up')));
    assert.equal(applied.at(-1), .2, '扩展命令不走粗档');
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, coarseVolumeStep: 50, wheelDirection: 'down' } });
    await jump(.4);
    await wheel(-1, true);
    assert.equal(applied.at(-1), .9, '方向反转后 Shift 仍用粗档，只是加减反过来');
    const legacy = { ...defaultSettings } as Partial<typeof defaultSettings>;
    delete legacy.coarseVolumeStep;
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': legacy });
    await jump(.1);
    await wheel(1, true);
    assert.equal(applied.at(-1), .6, '旧设置没有粗档时按住 Shift 用 50%');
  } finally {
    commands.onCommand = original;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
