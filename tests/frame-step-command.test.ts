import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { readFlatMessages } from '../lib/message-catalog';
import type { MediaCommand } from '../lib/types';

const messages = readFlatMessages(readFileSync(new URL('../locales/zh_CN.yml', import.meta.url), 'utf8'));

test('页内逐帧热键下发帧指令，不可用时提示同一句说明', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  const getMessage = fakeBrowser.i18n.getMessage;
  fakeBrowser.i18n.getMessage = (name: string) => messages[name] ?? '';
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  const applied: MediaCommand[] = [];
  const hints: string[] = [];
  let frameError = '';
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string; command?: MediaCommand; key?: string }) => {
    if (message.type === 'snapshot') return { media: [{ id: '1', paused: false, muted: false, volume: .5, maxVolume: 1, rate: 1, live: false, seekable: [{ start: 0, end: 30 }] }] };
    if (message.type === 'actionHint') { hints.push(message.key ?? ''); return { ok: true }; }
    if (message.type === 'command' && message.command) {
      applied.push(message.command);
      if (message.command.type === 'frame' && frameError) return { error: frameError };
    }
    return { ok: true };
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const sender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
    const hotkey = (direction: 1 | -1) => new Promise<unknown>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', type: 'hotkey', action: { type: 'frame', direction } }, sender, resolve);
    });

    const forward = await hotkey(1) as { handled?: boolean; error?: string };
    assert.equal(forward.error, undefined);
    assert.equal(forward.handled, true);
    assert.deepEqual(applied.at(-1), { type: 'frame', direction: 1 });
    assert.equal(hints.at(-1), 'shortcutFrameForward');

    frameError = messages.frameStepUnavailable ?? '';
    const back = await hotkey(-1) as { handled?: boolean; error?: string };
    assert.equal(back.handled, true);
    assert.equal(back.error, undefined);
    assert.deepEqual(applied.at(-1), { type: 'frame', direction: -1 });
    assert.equal(hints.at(-1), 'frameStepUnavailable');
  } finally {
    fakeBrowser.i18n.getMessage = getMessage;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
