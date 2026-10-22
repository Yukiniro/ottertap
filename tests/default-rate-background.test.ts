import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { defaultSettings, type MediaCommand } from '../lib/types';

const storageKey = 'ottertap-settings-v1';

test('后台把默认倍速下发一次；已看过的媒体不补，站点倍速盖过默认', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch' });
  const delivered: MediaCommand[] = [];
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string; command?: MediaCommand }) => {
    if (message.type === 'snapshot') return { media: [{ id: '1', rate: 1, volume: 1, maxVolume: 1, muted: false, paused: false }] };
    if (message.type === 'command' && message.command) delivered.push(message.command);
    return { ok: true };
  });
  const request = (page: typeof tab) => new Promise(resolve => {
    void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', type: 'read' }, { id: fakeBrowser.runtime.id, tab: page, frameId: 0 }, resolve);
  });
  try {
    await fakeBrowser.storage.local.set({ [storageKey]: { ...defaultSettings, defaultRate: null } });
    const background = await import('../entrypoints/background');
    background.default.main();
    await request(tab);
    await request(tab);
    assert.deepEqual(delivered, [], '跟随网页时不改倍速');

    await fakeBrowser.storage.local.set({ [storageKey]: { ...defaultSettings, defaultRate: 1.5 } });
    delivered.length = 0;
    await request(tab);
    assert.deepEqual(delivered, [], '这个媒体在跟随网页时已经看过，不再补默认倍速');

    const next = await fakeBrowser.tabs.create({ url: 'https://example.com/watch' });
    await request(next);
    await request(next);
    assert.deepEqual(delivered, [{ type: 'rate', value: 1.5 }], '新标签的新媒体应用一次 1.5×');

    const remembered = await fakeBrowser.tabs.create({ url: 'https://www.example.com/watch' });
    await fakeBrowser.storage.local.set({ [storageKey]: { ...defaultSettings, defaultRate: 1.5, sitePrefs: { 'example.com': { volume: .4, rate: 2 } } } });
    delivered.length = 0;
    await request(remembered);
    assert.deepEqual(delivered, [{ type: 'volume', value: .4 }, { type: 'rate', value: 2 }]);
  } finally {
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
