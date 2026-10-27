import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import type { MediaCommand } from '../lib/types';

test('扩展命令切换镜像、设标记、跳到标记；输入框聚焦时这三项不执行', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const listeners: Array<(command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void> = [];
  const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void): void } };
  const original = commands.onCommand;
  commands.onCommand = { addListener(callback) { listeners.push(callback); } };
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  let media: Array<Record<string, unknown>> = [{ id: '1', kind: 'video', paused: false, muted: false, volume: .5, maxVolume: 1, rate: 1, mirrored: false, currentTime: 12, live: false, seekable: [{ start: 0, end: 120 }] }];
  let typing = false;
  const applied: MediaCommand[] = [];
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string; command?: MediaCommand }) => {
    if (message.type === 'snapshot') return { media, typing };
    if (message.type === 'command' && message.command) applied.push(message.command);
    return { ok: true };
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const fire = (name: string) => Promise.all(listeners.map(listener => listener(name)));
    const sender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
    const hotkey = (action: unknown) => new Promise<unknown>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', type: 'hotkey', action }, sender, resolve);
    });

    await fire('mirror');
    assert.deepEqual(applied.at(-1), { type: 'mirror', value: true });
    media = [{ ...media[0]!, mirrored: true }];
    await fire('mirror');
    assert.deepEqual(applied.at(-1), { type: 'mirror', value: false });
    await fire('mark-set');
    assert.deepEqual(applied.at(-1), { type: 'mark', action: 'set' });
    await fire('mark-jump');
    assert.deepEqual(applied.at(-1), { type: 'mark', action: 'jump' });

    typing = true;
    const blocked = applied.length;
    await fire('mirror');
    await fire('mark-set');
    await fire('mark-jump');
    assert.equal(applied.length, blocked, '输入框聚焦时扩展命令不切换镜像、不设标记、不跳标记');
    const typed = await hotkey({ type: 'mirror' }) as { handled?: boolean };
    assert.equal(typed.handled, false);
    assert.equal(applied.length, blocked);
    await fire('play-pause');
    assert.deepEqual(applied.at(-1), { type: 'pause' }, '其它扩展命令仍可在输入时执行');

    typing = false;
    media = [];
    const withoutMedia = applied.length;
    await fire('mirror');
    await fire('mark-jump');
    assert.equal(applied.length, withoutMedia);

    media = [{ id: '1', kind: 'video', paused: true, muted: false, volume: 1, maxVolume: 1, rate: 1, mirrored: false }];
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { siteMode: 'exclude', sites: ['example.com'], sitePrefs: {} } });
    await fire('mark-set');
    assert.equal(applied.length, withoutMedia);
    await fakeBrowser.tabs.create({ url: 'chrome://extensions', active: true });
    await fire('mirror');
    assert.equal(applied.length, withoutMedia);

    const stored = await fakeBrowser.storage.local.get('ottertap-settings-v1') as { 'ottertap-settings-v1'?: { sitePrefs?: unknown } };
    const saved = stored['ottertap-settings-v1'];
    const text = JSON.stringify(stored);
    assert.equal(text.includes('mirrored'), false);
    assert.equal(text.includes('"mark"'), false);
    assert.deepEqual(saved?.sitePrefs, {});
  } finally {
    commands.onCommand = original;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
