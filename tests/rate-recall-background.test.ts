import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { noteRecallRate } from '../lib/rate';
import type { MediaCommand } from '../lib/types';

test('Alt+0 与扩展命令 rate-reset 按各帧记住的倍速来回切，提示实际倍速，且不写存储', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const listeners: Array<(command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void> = [];
  const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void): void } };
  const original = commands.onCommand;
  commands.onCommand = { addListener(callback) { listeners.push(callback); } };
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  const pages = new Map<number, { rate: number; recall: number | null }>([[0, { rate: 1, recall: null }], [2, { rate: 1, recall: null }]]);
  let iframeOnly = false;
  let frameTwo = false;
  let revertTo: number | null = null;
  const commanded: number[] = [];
  const hinted: number[] = [];
  const commandFrames: number[] = [];
  const touch = (frameId: number, observed: number) => {
    const page = pages.get(frameId)!;
    page.recall = noteRecallRate(page.recall, observed);
  };
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string; command?: MediaCommand; id?: string; rate?: number }, options?: { frameId?: number }) => {
    const frameId = options?.frameId ?? 0;
    const page = pages.get(frameId) ?? { rate: 1, recall: null };
    if (message.type === 'snapshot') {
      if (frameId === 2) {
        if (!frameTwo) return { media: [], recallRate: null };
        touch(2, page.rate);
        return { media: [{ id: '7', rate: page.rate, volume: 1, maxVolume: 1, muted: false, paused: false }], recallRate: page.recall };
      }
      if (iframeOnly) return { media: [], recallRate: null };
      touch(0, page.rate);
      return { media: [{ id: '1', rate: page.rate, volume: 1, maxVolume: 1, muted: false, paused: false }], recallRate: page.recall };
    }
    if (message.type === 'rateHint') { hinted.push(message.rate!); return { ok: true }; }
    if (message.command?.type === 'rate') {
      touch(frameId, page.rate);
      page.rate = revertTo ?? message.command.value;
      revertTo = null;
      touch(frameId, page.rate);
      commanded.push(message.command.value);
      commandFrames.push(frameId);
      return { ok: true, rate: page.rate };
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
    const hotkey = (direction: 1 | -1 | 0) => request({ type: 'hotkey', action: { type: 'rate', direction } });
    const top = pages.get(0)!;

    await hotkey(0);
    assert.deepEqual(commanded, [], '1× 且没记过时不发倍速指令');
    assert.deepEqual(hinted, [1]);

    await hotkey(1);
    await hotkey(1);
    await hotkey(-1);
    assert.deepEqual(commanded, [1.25, 1.5, 1.25]);
    assert.equal(top.recall, 1.25);
    await hotkey(0);
    assert.equal(commanded.at(-1), 1);
    assert.equal(hinted.at(-1), 1);
    assert.equal(top.recall, 1.25);
    await hotkey(0);
    assert.equal(commanded.at(-1), 1.25);
    assert.equal(hinted.at(-1), 1.25, '提示用实际生效的倍速');

    top.rate = 1.8;
    await hotkey(0);
    assert.equal(commanded.at(-1), 1);
    assert.equal(top.recall, 1.8, '站点菜单改到的倍速盖过旧值');
    await hotkey(0);
    assert.equal(commanded.at(-1), 1.8);
    assert.equal(hinted.at(-1), 1.8);

    await request({ type: 'command', id: '0:1', command: { type: 'rate', value: 2 } });
    assert.equal(top.rate, 2);
    assert.equal(top.recall, 2);
    await hotkey(0);
    await hotkey(0);
    assert.deepEqual(commanded.slice(-2), [1, 2], '预设改过之后记住的是 2×');

    top.rate = 1.7;
    revertTo = 1.1;
    await hotkey(1);
    assert.equal(commanded.at(-1), 1.75);
    assert.equal(hinted.at(-1), 1.1);
    assert.equal(top.recall, 1.1);
    await hotkey(0);
    await hotkey(0);
    assert.deepEqual(commanded.slice(-2), [1, 1.1]);
    assert.equal(hinted.at(-1), 1.1);

    const fire = (name: string) => Promise.all(listeners.map(listener => listener(name, tab)));
    await fire('rate-reset');
    assert.equal(commanded.at(-1), 1);
    await fire('rate-reset');
    assert.equal(commanded.at(-1), 1.1);
    assert.equal(hinted.at(-1), 1.1);

    iframeOnly = true;
    frameTwo = true;
    await request({ type: 'register' });
    await new Promise<unknown>(resolve => { void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', type: 'register' }, { ...sender, frameId: 2 }, resolve); });
    const framed = pages.get(2)!;
    framed.rate = 1.6;
    await hotkey(0);
    assert.equal(commandFrames.at(-1), 2);
    assert.equal(commanded.at(-1), 1);
    assert.equal(framed.recall, 1.6);
    assert.equal(top.recall, 1.1, '别的帧的记忆不串过来');
    await hotkey(0);
    assert.equal(commandFrames.at(-1), 2);
    assert.equal(hinted.at(-1), 1.6);

    assert.equal((await fakeBrowser.storage.local.get('ottertap-settings-v1'))['ottertap-settings-v1'], undefined);
    const dumped = JSON.stringify(await fakeBrowser.storage.local.get(null));
    assert.equal(dumped.includes('recall'), false);
  } finally {
    commands.onCommand = original;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
