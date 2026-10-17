import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import type { MediaCommand } from '../lib/types';
import { defaultSettings } from '../lib/types';

const storageKey = 'ottertap-settings-v1';

test('倍速快捷键按顺序生效，提示实际倍速，未记住的站点不写存储，顶层按键能控制 iframe', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch' });
  let rate = 1;
  let iframeOnly = false;
  let frameTwo = false;
  let revertTo: number | null = null;
  const commanded: number[] = [];
  const hinted: number[] = [];
  const commandFrames: number[] = [];
  const memory = new Map<string, unknown>();
  const writes: unknown[] = [];
  const storage = fakeBrowser.storage.local as unknown as {
    get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
  };
  storage.get = async keys => {
    const names = keys == null ? [...memory.keys()] : Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(names.map(name => [name, memory.get(name)]));
  };
  storage.set = async items => {
    writes.push(structuredClone(items));
    for (const [key, value] of Object.entries(items)) memory.set(key, structuredClone(value));
  };
  storage.remove = async keys => {
    for (const key of Array.isArray(keys) ? keys : [keys]) memory.delete(key);
  };
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string; command?: MediaCommand; id?: string; rate?: number }, options?: { frameId?: number }) => {
    if (message.type === 'snapshot') {
      const frameId = options?.frameId ?? 0;
      if (frameId === 2) return { media: frameTwo ? [{ id: '7', rate, volume: 1, maxVolume: 1, muted: false, paused: false }] : [] };
      return { media: iframeOnly ? [] : [{ id: '1', rate, volume: 1, maxVolume: 1, muted: false, paused: false }] };
    }
    if (message.type === 'rateHint') { hinted.push(message.rate!); return { ok: true }; }
    if (message.command?.type === 'rate') {
      await new Promise(resolve => setTimeout(resolve, 2));
      commanded.push(message.command.value);
      commandFrames.push(options?.frameId ?? 0);
      rate = revertTo ?? message.command.value;
      const actual = rate;
      revertTo = null;
      return { ok: true, rate: actual };
    }
    return { ok: true };
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const sender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
    const request = (message: object, frameId = 0) => new Promise<unknown>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, { ...sender, frameId }, resolve);
    });
    const hotkey = (direction: 1 | -1 | 0) => request({ type: 'hotkey', action: { type: 'rate', direction } });
    await Promise.all([hotkey(1), hotkey(1), hotkey(-1), hotkey(0)]);
    assert.deepEqual(commanded, [1.25, 1.5, 1.25, 1]);
    assert.deepEqual(hinted, [1.25, 1.5, 1.25, 1]);
    assert.equal(writes.length, 0, '未记住的站点不应写入存储');
    assert.equal((await fakeBrowser.storage.local.get(storageKey))[storageKey], undefined);

    rate = 1.1;
    await hotkey(1);
    assert.equal(commanded.at(-1), 1.25);
    rate = 1.1;
    await hotkey(-1);
    assert.equal(commanded.at(-1), 1);
    rate = 4;
    const beforeLimit = commanded.length;
    await hotkey(1);
    assert.equal(commanded.length, beforeLimit);
    assert.equal(hinted.at(-1), 4);
    rate = 0.25;
    await hotkey(-1);
    assert.equal(commanded.length, beforeLimit);
    assert.equal(hinted.at(-1), 0.25);

    rate = 1.25;
    revertTo = 1.1;
    await hotkey(1);
    assert.equal(commanded.at(-1), 1.5);
    assert.equal(hinted.at(-1), 1.1);
    await hotkey(1);
    assert.equal(commanded.at(-1), 1.25);
    assert.equal(hinted.at(-1), 1.25);
    assert.equal(writes.length, 0);

    iframeOnly = true;
    frameTwo = true;
    await request({ type: 'register' }, 2);
    rate = 2;
    await hotkey(1);
    assert.equal(commandFrames.at(-1), 2);
    assert.equal(commanded.at(-1), 2.25);
    assert.equal(hinted.at(-1), 2.25);

    iframeOnly = false;
    frameTwo = false;
    await fakeBrowser.storage.local.set({ [storageKey]: { ...defaultSettings, sitePrefs: { 'example.com': { volume: .5 } } } });
    const writesBefore = writes.length;
    rate = 1;
    revertTo = 1.1;
    await hotkey(1);
    assert.equal(hinted.at(-1), 1.1);
    const stored = (await fakeBrowser.storage.local.get(storageKey))[storageKey] as { sitePrefs: Record<string, { volume?: number; rate?: number }> };
    assert.deepEqual(stored.sitePrefs['example.com'], { volume: .5, rate: 1.25 });
    assert.equal(writes.length, writesBefore + 1);

    await fakeBrowser.storage.local.remove(storageKey);
    const cleared = writes.length;
    rate = 1.5;
    await hotkey(1);
    assert.equal(writes.length, cleared);
    assert.equal((await fakeBrowser.storage.local.get(storageKey))[storageKey], undefined);
  } finally { sendMessage.mock.restore(); fakeBrowser.reset(); }
});
