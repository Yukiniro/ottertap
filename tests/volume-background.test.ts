import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import type { MediaCommand } from '../lib/types';

test('后台逐次处理并发音量消息，100% 停靠不会被合并吞掉，手动命令后重新取值', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com' });
  let volume = .95;
  let maxVolume = 2;
  const applied: number[] = [];
  const revealed: number[] = [];
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string; command?: MediaCommand; percent?: number }) => {
    if (message.type === 'snapshot') return { media: [{ id: '1', volume, maxVolume, muted: false, paused: false }] };
    if (message.type === 'reveal') { revealed.push(message.percent!); return { ok: true }; }
    if (message.command?.type === 'volume') {
      await new Promise(resolve => setTimeout(resolve, 2));
      volume = message.command.value;
      applied.push(Math.round(volume * 100));
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
    const hotkey = (delta: number) => request({ type: 'hotkey', action: { type: 'volume', delta } });
    await Promise.all([hotkey(10), hotkey(10), hotkey(-20), hotkey(-10)]);
    assert.deepEqual(applied, [100, 110, 100, 90]);
    assert.deepEqual(revealed.map(Math.round), [100, 110, 100, 90]);
    await request({ type: 'command', id: '0:1', command: { type: 'volume', value: 1.05 } });
    await hotkey(-10);
    assert.equal(volume, 1);
    await hotkey(-.4);
    assert.equal(volume, .996);
    await hotkey(.8);
    assert.equal(volume, 1);
    await hotkey(.4);
    assert.equal(volume, 1.004);
    maxVolume = 1;
    await request({ type: 'command', id: '0:1', command: { type: 'volume', value: .95 } });
    await hotkey(10);
    await hotkey(10);
    assert.equal(volume, 1, '不能放大的媒体仍受 100% 上限约束');
  } finally { sendMessage.mock.restore(); fakeBrowser.reset(); }
});
