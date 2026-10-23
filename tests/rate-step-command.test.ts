import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { defaultSettings, type MediaCommand } from '../lib/types';

test('页内快捷键和扩展命令 rate-faster / rate-slower 使用已保存的步长', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const listeners: Array<(command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void> = [];
  const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void): void } };
  const original = commands.onCommand;
  commands.onCommand = { addListener(callback) { listeners.push(callback); } };
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  const applied: MediaCommand[] = [];
  let rate = 1;
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string; command?: MediaCommand }) => {
    if (message.type === 'snapshot') return { media: [{ id: '1', paused: false, muted: false, volume: 1, maxVolume: 1, rate }] };
    if (message.type === 'command' && message.command?.type === 'rate') {
      rate = message.command.value;
      applied.push(message.command);
    }
    return { ok: true, rate };
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const fire = (name: string) => Promise.all(listeners.map(listener => listener(name)));
    const sender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
    const hotkey = (direction: 1 | -1 | 0) => new Promise<unknown>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', type: 'hotkey', action: { type: 'rate', direction } }, sender, resolve);
    });

    await fire('rate-faster');
    assert.deepEqual(applied.at(-1), { type: 'rate', value: 1.25 });
    await hotkey(-1);
    assert.deepEqual(applied.at(-1), { type: 'rate', value: 1 });

    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, rateStep: 0.1 } });
    await fire('rate-faster');
    assert.deepEqual(applied.at(-1), { type: 'rate', value: 1.1 });
    await hotkey(1);
    assert.deepEqual(applied.at(-1), { type: 'rate', value: 1.2 });
    await fire('rate-slower');
    assert.deepEqual(applied.at(-1), { type: 'rate', value: 1.1 });

    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, rateStep: 0.5 } });
    rate = 1;
    await hotkey(1);
    assert.deepEqual(applied.at(-1), { type: 'rate', value: 1.5 });
    await fire('rate-faster');
    assert.deepEqual(applied.at(-1), { type: 'rate', value: 2 });

    rate = 4;
    const atMax = applied.length;
    await fire('rate-faster');
    await hotkey(1);
    assert.equal(applied.length, atMax, '到 4× 后加快不再下发');
    rate = 0.25;
    const atMin = applied.length;
    await fire('rate-slower');
    await hotkey(-1);
    assert.equal(applied.length, atMin, '到 0.25× 后减慢不再下发');

    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, rateStep: 0.2 } });
    rate = 1;
    await hotkey(1);
    assert.deepEqual(applied.at(-1), { type: 'rate', value: 1.25 }, '非法存储值回落到 0.25');

    const legacy = { ...defaultSettings } as Partial<typeof defaultSettings>;
    delete legacy.rateStep;
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': legacy });
    await fire('rate-faster');
    assert.deepEqual(applied.at(-1), { type: 'rate', value: 1.5 }, '没有这一项的旧设置仍是 0.25');
  } finally {
    commands.onCommand = original;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
