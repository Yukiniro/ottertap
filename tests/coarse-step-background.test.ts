import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { defaultSettings, type MediaCommand } from '../lib/types';

test('后台对 Shift 滚轮用粗调步长，跳过低音量 1%；方向键和扩展命令仍用音量步长', async () => {
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
    const wheel = (notches: number, coarse = false) => request({ type: 'hotkey', action: coarse ? { type: 'volume', notches, coarse: true } : { type: 'volume', notches } });
    const jump = async (value: number) => {
      await request({ type: 'command', id: '0:1', command: { type: 'volume', value } });
    };
    await wheel(1);
    assert.equal(applied.at(-1), .11, '不按 Shift 时低音量仍是 1%');
    await wheel(1, true);
    assert.equal(applied.at(-1), .31, 'Shift 用默认粗档 20%，不走 1%');
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, coarseStep: 5, volumeStep: 10, fineWheel: true } });
    await jump(.4);
    await wheel(1);
    assert.equal(applied.at(-1), .5, '松开 Shift 后仍是音量步长');
    await wheel(1, true);
    assert.equal(applied.at(-1), .55, '粗档改成 5% 后只影响 Shift');
    await jump(.1);
    await request({ type: 'hotkey', action: { type: 'volume', delta: 10 } });
    assert.equal(applied.at(-1), .2, '方向键不看粗档');
    await jump(.1);
    await Promise.all(listeners.map(listener => listener('volume-up')));
    assert.equal(applied.at(-1), .2, '扩展命令不看粗档');
    const legacy = { ...defaultSettings } as Partial<typeof defaultSettings>;
    delete legacy.coarseStep;
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': legacy });
    await jump(.4);
    await wheel(1, true);
    assert.equal(applied.at(-1), .6, '旧设置没有粗档时按 20%');
  } finally {
    commands.onCommand = original;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
