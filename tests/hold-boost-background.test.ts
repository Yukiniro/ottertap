import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import type { MediaCommand } from '../lib/types';
import { defaultSettings } from '../lib/types';

test('后台按住临时倍速不写站点记忆，也不改全局默认倍速', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch' });
  const storageKey = 'ottertap-settings-v1';
  let rate = 1;
  let iframeOnly = false;
  let frameTwo = false;
  const holds: Array<{ phase?: string; rate?: number; frameId: number }> = [];
  const commands: number[] = [];
  const hints: Array<number | null> = [];
  const writes: unknown[] = [];
  const memory = new Map<string, unknown>();
  const storage = fakeBrowser.storage.local as unknown as {
    get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
  };
  const originalStorage = { get: storage.get, set: storage.set, remove: storage.remove };
  const notify = async (changes: Record<string, { newValue?: unknown }>) => { await fakeBrowser.storage.onChanged.trigger(changes, 'local'); };
  storage.get = async keys => {
    const names = keys == null ? [...memory.keys()] : Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(names.map(name => [name, memory.get(name)]));
  };
  storage.set = async items => {
    writes.push(structuredClone(items));
    const changes: Record<string, { newValue?: unknown }> = {};
    for (const [key, value] of Object.entries(items)) {
      memory.set(key, structuredClone(value));
      changes[key] = { newValue: structuredClone(value) };
    }
    await notify(changes);
  };
  storage.remove = async keys => {
    const changes: Record<string, { newValue?: unknown }> = {};
    for (const key of Array.isArray(keys) ? keys : [keys]) { memory.delete(key); changes[key] = {}; }
    await notify(changes);
  };
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string; phase?: string; rate?: number | null; command?: MediaCommand }, options?: { frameId?: number }) => {
    const frameId = options?.frameId ?? 0;
    if (message.type === 'snapshot') {
      if (frameId === 2) return { media: frameTwo ? [{ id: '7', rate, volume: 1, maxVolume: 1, muted: false, paused: false }] : [] };
      return { media: iframeOnly ? [] : [{ id: '1', rate, volume: 1, maxVolume: 1, muted: false, paused: false }] };
    }
    if (message.type === 'hold') {
      holds.push({ phase: message.phase, rate: typeof message.rate === 'number' ? message.rate : undefined, frameId });
      if (message.phase === 'start' && typeof message.rate === 'number') rate = message.rate;
      return { ok: true };
    }
    if (message.type === 'holdHint') { hints.push(message.rate ?? null); return { ok: true }; }
    if (message.command?.type === 'rate') { commands.push(message.command.value); return { ok: true, rate: message.command.value }; }
    return { ok: true };
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const sender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
    const request = (message: object) => new Promise<unknown>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, sender, resolve);
    });
    await fakeBrowser.storage.local.set({ [storageKey]: { ...defaultSettings, holdBoost: false, defaultRate: 1.5, sitePrefs: { 'example.com': { rate: 1.25 } } } });
    const blocked = writes.length;
    await request({ type: 'holdRate', phase: 'start' });
    assert.equal(holds.length, 0);
    assert.equal(commands.length, 0);
    assert.equal(writes.length, blocked);

    await fakeBrowser.storage.local.set({ [storageKey]: { ...defaultSettings, holdBoost: true, holdBoostRate: 2, defaultRate: 1.5, sitePrefs: { 'example.com': { rate: 1.25 } } } });
    const armed = writes.length;
    rate = 1.25;
    await request({ type: 'holdRate', phase: 'start' });
    await request({ type: 'holdRate', phase: 'end' });
    assert.deepEqual(holds.map(item => item.phase), ['start', 'end']);
    assert.equal(holds[0]?.rate, 2);
    assert.equal(holds[0]?.frameId, 0);
    assert.deepEqual(hints, [2, null]);
    assert.equal(commands.length, 0);
    assert.equal(writes.length, armed);
    const stored = (await fakeBrowser.storage.local.get(storageKey))[storageKey] as { defaultRate: number; holdBoostRate: number; sitePrefs: Record<string, { rate?: number }> };
    assert.equal(stored.defaultRate, 1.5);
    assert.equal(stored.holdBoostRate, 2);
    assert.equal(stored.sitePrefs['example.com']?.rate, 1.25);

    iframeOnly = true;
    frameTwo = true;
    await request({ type: 'register' });
    await new Promise<unknown>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', type: 'register' }, { ...sender, frameId: 2 }, resolve);
    });
    holds.length = 0;
    await request({ type: 'holdRate', phase: 'start' });
    assert.equal(holds[0]?.frameId, 2);
    assert.equal(writes.length, armed);
    await request({ type: 'holdRate', phase: 'end' });
  } finally {
    storage.get = originalStorage.get;
    storage.set = originalStorage.set;
    storage.remove = originalStorage.remove;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
