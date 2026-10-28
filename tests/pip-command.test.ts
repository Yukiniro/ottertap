import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { readFlatMessages } from '../lib/message-catalog';
import { defaultSettings, type MediaCommand } from '../lib/types';

const messages = readFlatMessages(readFileSync(new URL('../locales/zh_CN.yml', import.meta.url), 'utf8'));

test('扩展命令 pip 复用画中画指令，失败时显示同一句提示', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  const getMessage = fakeBrowser.i18n.getMessage;
  fakeBrowser.i18n.getMessage = (name: string) => messages[name] ?? '';
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const listeners: Array<(command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void> = [];
  const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void): void } };
  const original = commands.onCommand;
  commands.onCommand = { addListener(callback) { listeners.push(callback); } };
  await fakeBrowser.windows.create({ focused: true });
  await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
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

    await fire('pip');
    assert.deepEqual(applied.at(-1), { id: '1', command: { type: 'pip' } });
    assert.deepEqual(hints, ['pipOnHint']);

    media = [{ ...media[0]!, pip: true }];
    await fire('pip');
    assert.deepEqual(applied.at(-1), { id: '1', command: { type: 'pip' } });
    assert.deepEqual(hints, ['pipOnHint', 'pipOffHint']);

    media = [{ ...media[0]!, pip: false, pipAvailable: false, pipBlock: 'audio' }];
    pipError = messages.pipUnavailableAudio ?? '';
    await fire('pip');
    assert.equal(hints.at(-1), 'pipUnavailableAudio');
    assert.deepEqual(applied.at(-1)?.command, { type: 'pip' });

    media = [{ ...media[0]!, pip: false, pipAvailable: false, pipBlock: 'disabled' }];
    pipError = messages.pipDisabledBySite ?? '';
    await fire('pip');
    assert.equal(hints.at(-1), 'pipDisabledBySite');

    media = [{ ...media[0]!, pipAvailable: false, pipBlock: 'unsupported' }];
    pipError = messages.pipUnsupported ?? '';
    await fire('pip');
    assert.equal(hints.at(-1), 'pipUnsupported');

    media = [{ ...media[0]!, pip: false, pipAvailable: true, pipBlock: '' }];
    pipError = messages.pipNeedsGesture ?? '';
    await fire('pip');
    assert.equal(hints.at(-1), 'pipNeedsGesture');

    pipError = messages.pipNotReady ?? '';
    await fire('pip');
    assert.equal(hints.at(-1), 'pipNotReady');

    pipError = 'frame send failed';
    const hinted = hints.length;
    const sent = applied.length;
    await fire('pip');
    assert.equal(applied.length, sent + 1);
    assert.equal(hints.length, hinted);

    pipError = '';
    media = [];
    const withoutMedia = applied.length;
    await fire('pip');
    assert.equal(applied.length, withoutMedia);
    assert.equal(hints.length, hinted);

    media = [{ id: '1', paused: false, muted: false, volume: .5, maxVolume: 1, rate: 1, pip: false, pipAvailable: true, pipBlock: '' }];
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, siteMode: 'exclude', sites: ['example.com'] } });
    await fire('pip');
    assert.equal(applied.length, withoutMedia);
    await fakeBrowser.tabs.create({ url: 'chrome://extensions', active: true });
    await fire('pip');
    assert.equal(applied.length, withoutMedia);
    assert.equal(hints.length, hinted);
  } finally {
    commands.onCommand = original;
    fakeBrowser.i18n.getMessage = getMessage;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
