import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { defaultSettings, type MediaCommand } from '../lib/types';

test('扩展命令作用在活动标签页已锁定的媒体上，停用或没有媒体时不执行', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const listeners: Array<(command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void> = [];
  const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void): void } };
  const original = commands.onCommand;
  commands.onCommand = { addListener(callback) { listeners.push(callback); } };
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  let items = [
    { id: '1', paused: true, muted: true, volume: .2, maxVolume: 1, rate: 1 },
    { id: '2', paused: false, muted: false, volume: .95, maxVolume: 2, rate: 1 }
  ];
  let present = true;
  const applied: Array<{ id?: string; command?: MediaCommand }> = [];
  const hints: string[] = [];
  const rateHints: number[] = [];
  const revealed: number[] = [];
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string; command?: MediaCommand; id?: string; key?: string; rate?: number; percent?: number }) => {
    if (message.type === 'snapshot') return { media: present ? items : [] };
    if (message.type === 'actionHint') { hints.push(message.key ?? ''); return { ok: true }; }
    if (message.type === 'rateHint') { rateHints.push(message.rate ?? 0); return { ok: true }; }
    if (message.type === 'reveal') { revealed.push(message.percent ?? 0); return { ok: true }; }
    if (message.type === 'command' && message.command) {
      applied.push({ id: message.id, command: message.command });
      items = items.map(item => {
        if (item.id !== message.id) return item;
        if (message.command?.type === 'play') return { ...item, paused: false };
        if (message.command?.type === 'pause') return { ...item, paused: true };
        if (message.command?.type === 'mute') return { ...item, muted: !item.muted };
        if (message.command?.type === 'volume') return { ...item, volume: message.command.value, muted: message.command.value <= 0 };
        if (message.command?.type === 'rate') return { ...item, rate: message.command.value };
        return item;
      });
    }
    return { ok: true };
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const fire = (name: string) => Promise.all(listeners.map(listener => listener(name)));
    await fire('play-pause');
    assert.deepEqual(applied.at(-1), { id: '2', command: { type: 'pause' } });
    assert.equal(hints.at(-1), 'paused');
    await fire('skip-back');
    assert.deepEqual(applied.at(-1), { id: '2', command: { type: 'skip', value: -10 } });
    assert.equal(hints.at(-1), 'skipBack');
    await fire('skip-forward');
    assert.deepEqual(applied.at(-1), { id: '2', command: { type: 'skip', value: 10 } });
    await fire('mute');
    assert.deepEqual(applied.at(-1), { id: '2', command: { type: 'mute' } });
    assert.equal(hints.at(-1), 'mute');
    assert.equal(items.find(item => item.id === '2')?.volume, .95);
    await fire('mute');
    assert.equal(hints.at(-1), 'unmute');
    await fire('volume-up');
    assert.deepEqual(applied.at(-1)?.command, { type: 'volume', value: 1 });
    assert.equal(revealed.at(-1), 100);
    await fire('rate-faster');
    assert.deepEqual(applied.at(-1)?.command, { type: 'rate', value: 1.25 });
    assert.equal(rateHints.at(-1), 1.25);
    await fire('rate-reset');
    assert.deepEqual(applied.at(-1)?.command, { type: 'rate', value: 1 });
    const beforeMissing = applied.length;
    await fire('not-a-command');
    assert.equal(applied.length, beforeMissing);

    const sender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
    await new Promise<unknown>(resolve => { void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', type: 'select', id: '0:1' }, sender, resolve); });
    await fire('play-pause');
    assert.deepEqual(applied.at(-1), { id: '1', command: { type: 'play' } });
    assert.equal(hints.at(-1), 'play');

    present = false;
    const withoutMedia = applied.length;
    await fire('skip-forward');
    assert.equal(applied.length, withoutMedia);
    present = true;
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, siteMode: 'exclude', sites: ['example.com'] } });
    const whileDisabled = applied.length;
    await fire('mute');
    assert.equal(applied.length, whileDisabled);
    await fakeBrowser.tabs.create({ url: 'chrome://extensions', active: true });
    await fire('play-pause');
    assert.equal(applied.length, whileDisabled);
  } finally {
    commands.onCommand = original;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
