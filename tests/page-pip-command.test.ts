import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { readFlatMessages } from '../lib/message-catalog';
import type { MediaCommand } from '../lib/types';

const messages = readFlatMessages(readFileSync(new URL('../locales/zh_CN.yml', import.meta.url), 'utf8'));

test('页内画中画键和扩展命令发送同一条指令，失败说明与面板相同', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  const getMessage = fakeBrowser.i18n.getMessage;
  fakeBrowser.i18n.getMessage = (name: string) => messages[name] ?? '';
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const listeners: Array<(command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void> = [];
  const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void): void } };
  const original = commands.onCommand;
  commands.onCommand = { addListener(callback) { listeners.push(callback); } };
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  let media = [{ id: '1', paused: false, muted: false, volume: .5, maxVolume: 1, rate: 1, pip: false, pipAvailable: true, pipBlock: '' }];
  let pipError = '';
  const applied: Array<{ id?: string; command?: MediaCommand }> = [];
  const hints: string[] = [];
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string; command?: MediaCommand; id?: string; key?: string }) => {
    if (message.type === 'snapshot') return { media };
    if (message.type === 'actionHint') { hints.push(message.key ?? ''); return { ok: true }; }
    if (message.type === 'command' && message.command) {
      applied.push({ id: message.id, command: message.command });
      if (message.command.type === 'pip' && pipError) return { error: pipError };
    }
    return { ok: true };
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const fire = (name: string) => Promise.all(listeners.map(listener => listener(name)));
    const sender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
    const hotkey = () => new Promise<{ handled?: boolean }>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', type: 'hotkey', action: { type: 'pip' } }, sender, resolve);
    });

    await fire('pip');
    assert.deepEqual(applied.at(-1), { id: '1', command: { type: 'pip' } });
    const page = await hotkey();
    assert.equal(page.handled, true);
    assert.deepEqual(applied.at(-1), { id: '1', command: { type: 'pip' } });
    assert.equal(applied.length, 2, '扩展命令和页内键各发一次，不互相取消');

    media = [{ ...media[0]!, pip: true }];
    await hotkey();
    assert.deepEqual(applied.at(-1), { id: '1', command: { type: 'pip' } }, '已在画中画里再按仍是同一条切换');

    const reasons = ['pipUnavailableAudio', 'pipDisabledBySite', 'pipUnsupported', 'pipNeedsGesture', 'pipNotReady', 'pipFailed'] as const;
    for (const key of reasons) {
      media = [{ ...media[0]!, pip: false, pipAvailable: false, pipBlock: '' }];
      pipError = messages[key] ?? '';
      await hotkey();
      assert.equal(hints.at(-1), key, key);
      assert.deepEqual(applied.at(-1)?.command, { type: 'pip' });
    }

    pipError = 'frame send failed';
    const hinted = hints.length;
    const sent = applied.length;
    await hotkey();
    assert.equal(applied.length, sent + 1);
    assert.equal(hints.length, hinted, '面板没有的错误不另做说明');

    pipError = '';
    media = [];
    const withoutMedia = applied.length;
    await hotkey();
    await fire('pip');
    assert.equal(applied.length, withoutMedia, '没有媒体时页内键和扩展命令都不发送');
  } finally {
    commands.onCommand = original;
    fakeBrowser.i18n.getMessage = getMessage;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
