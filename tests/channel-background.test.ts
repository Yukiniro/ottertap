import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import type { MediaCommand, SitePref } from '../lib/types';
import { defaultSettings } from '../lib/types';

const storageKey = 'ottertap-settings-v1';

test('声道指令经后台下发到对应 frame，并写回已记住的站点；失败和非法值不写存储；进入页面恢复一次', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://www.example.com/watch' });
  const delivered: { command: MediaCommand; frameId: number }[] = [];
  let reject = '';
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string; command?: MediaCommand }, options?: { frameId?: number }) => {
    if (message.type === 'snapshot') return { media: [{ id: '1', rate: 1, volume: 1, maxVolume: 2, muted: false, paused: false, channel: 'stereo', channelAvailable: true }] };
    if (message.type === 'command' && message.command) {
      if (reject) return { error: reject };
      delivered.push({ command: message.command, frameId: options?.frameId ?? 0 });
    }
    return { ok: true };
  });
  const stored = async () => ((await fakeBrowser.storage.local.get(storageKey))[storageKey] as { sitePrefs: Record<string, SitePref> } | undefined)?.sitePrefs;
  try {
    await fakeBrowser.storage.local.set({ [storageKey]: { ...defaultSettings, sitePrefs: { 'example.com': { volume: .5 } } } });
    const background = await import('../entrypoints/background');
    background.default.main();
    const request = (message: object) => new Promise<{ ok?: boolean; error?: string }>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, { id: fakeBrowser.runtime.id, tab, frameId: 0 }, resolve as (value: unknown) => void);
    });
    const channel = (value: string) => request({ type: 'command', id: '3:1', command: { type: 'channel', value } });

    assert.deepEqual(await channel('mono'), { ok: true });
    assert.deepEqual(delivered, [{ command: { type: 'channel', value: 'mono' }, frameId: 3 }]);
    assert.deepEqual(await stored(), { 'example.com': { volume: .5, channel: 'mono' } });

    reject = '此媒体来自其他域名，无法切换声道。';
    assert.deepEqual(await channel('left'), { error: reject });
    assert.deepEqual(await stored(), { 'example.com': { volume: .5, channel: 'mono' } }, '下发失败时不改记忆');
    reject = '';

    assert.ok((await channel('surround')).error);
    assert.equal(delivered.length, 1);

    assert.deepEqual(await channel('stereo'), { ok: true });
    assert.deepEqual(await stored(), { 'example.com': { volume: .5 } }, '切回立体声删掉声道字段');

    await fakeBrowser.storage.local.set({ [storageKey]: { ...defaultSettings, sitePrefs: { 'example.com': { channel: 'right' } } } });
    delivered.length = 0;
    await request({ type: 'read' });
    await request({ type: 'read' });
    assert.deepEqual(delivered, [{ command: { type: 'channel', value: 'right' }, frameId: 0 }], '同一媒体只恢复一次');
  } finally {
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
