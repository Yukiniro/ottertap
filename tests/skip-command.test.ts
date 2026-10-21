import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { defaultSettings, type MediaCommand } from '../lib/types';

test('skip-back / skip-forward 和 context 使用已保存的步长', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const listeners: Array<(command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void> = [];
  const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void): void } };
  const original = commands.onCommand;
  commands.onCommand = { addListener(callback) { listeners.push(callback); } };
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  const applied: MediaCommand[] = [];
  const hints: Array<{ key?: string; seconds?: number }> = [];
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string; command?: MediaCommand; key?: string; seconds?: number }) => {
    if (message.type === 'snapshot') return { media: [{ id: '1', paused: false, muted: false, volume: .5, maxVolume: 1, rate: 1 }] };
    if (message.type === 'actionHint') hints.push({ key: message.key, seconds: message.seconds });
    if (message.type === 'command' && message.command) applied.push(message.command);
    return { ok: true };
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const fire = (name: string) => Promise.all(listeners.map(listener => listener(name)));
    const sender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
    const context = () => new Promise<unknown>(resolve => { void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', type: 'context' }, sender, resolve); });

    await fire('skip-back');
    assert.deepEqual(applied.at(-1), { type: 'skip', value: -10 });
    assert.deepEqual(hints.at(-1), { key: 'skipBack', seconds: 10 });

    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, skipSeconds: 30 } });
    await fire('skip-forward');
    assert.deepEqual(applied.at(-1), { type: 'skip', value: 30 });
    assert.deepEqual(hints.at(-1), { key: 'skipForward', seconds: 30 });
    assert.equal((await context() as { skipSeconds?: number }).skipSeconds, 30);

    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, skipSeconds: 8 } });
    await fire('skip-back');
    assert.deepEqual(applied.at(-1), { type: 'skip', value: -10 }, '非法存储值回落到 10');

    const legacy = { ...defaultSettings } as Partial<typeof defaultSettings>;
    delete legacy.skipSeconds;
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': legacy });
    await fire('skip-forward');
    assert.deepEqual(applied.at(-1), { type: 'skip', value: 10 }, '没有这一项的旧设置仍是 10 秒');
    assert.equal((await context() as { skipSeconds?: number }).skipSeconds, 10);
  } finally {
    commands.onCommand = original;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
