import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { defaultSettings, type MediaCommand } from '../lib/types';

test('volume-up / volume-down 和 context 使用已保存的音量步长', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const listeners: Array<(command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void> = [];
  const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void): void } };
  const original = commands.onCommand;
  commands.onCommand = { addListener(callback) { listeners.push(callback); } };
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  const applied: MediaCommand[] = [];
  const revealed: number[] = [];
  let volume = .5;
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string; command?: MediaCommand; percent?: number }) => {
    if (message.type === 'snapshot') return { media: [{ id: '1', paused: false, muted: false, volume, maxVolume: 2, rate: 1 }] };
    if (message.type === 'reveal') revealed.push(message.percent ?? 0);
    if (message.type === 'command' && message.command?.type === 'volume') {
      volume = message.command.value;
      applied.push(message.command);
    }
    return { ok: true };
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const fire = (name: string) => Promise.all(listeners.map(listener => listener(name)));
    const sender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
    const context = () => new Promise<unknown>(resolve => { void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', type: 'context' }, sender, resolve); });

    await fire('volume-up');
    assert.deepEqual(applied.at(-1), { type: 'volume', value: .6 });
    assert.equal(revealed.at(-1), 60);
    assert.equal((await context() as { volumeStep?: number }).volumeStep, 10);

    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, volumeStep: 20 } });
    await fire('volume-up');
    assert.deepEqual(applied.at(-1), { type: 'volume', value: .8 });
    assert.equal(revealed.at(-1), 80);
    assert.equal((await context() as { volumeStep?: number }).volumeStep, 20);

    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, volumeStep: 5 } });
    await fire('volume-down');
    assert.deepEqual(applied.at(-1), { type: 'volume', value: .75 });
    assert.equal((await context() as { volumeStep?: number }).volumeStep, 5);

    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, volumeStep: 15 } });
    await fire('volume-up');
    assert.deepEqual(applied.at(-1), { type: 'volume', value: .85 }, '非法存储值回落到 10');

    const legacy = { ...defaultSettings } as Partial<typeof defaultSettings>;
    delete legacy.volumeStep;
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': legacy });
    await fire('volume-down');
    assert.deepEqual(applied.at(-1), { type: 'volume', value: .75 }, '没有这一项的旧设置仍是 10%');
    assert.equal((await context() as { volumeStep?: number }).volumeStep, 10);
  } finally {
    commands.onCommand = original;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
