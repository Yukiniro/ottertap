import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { readFlatMessages } from '../lib/message-catalog';
import type { MediaCommand, MediaState } from '../lib/types';

const messages = readFlatMessages(readFileSync(new URL('../locales/zh_CN.yml', import.meta.url), 'utf8'));

test('键控、扩展命令和面板成功时发出页内提示，失败时用原来的短说明', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  const getMessage = fakeBrowser.i18n.getMessage;
  fakeBrowser.i18n.getMessage = (name: string) => messages[name] ?? '';
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const { actionHintKey, actionHintText, mirrorMarkHintKey } = await import('../lib/hotkey');
  const { mirrorMarkFailureKey } = await import('../lib/media');
  const media = { id: '1', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1, mirrored: false } as MediaState;
  assert.equal(mirrorMarkHintKey({ type: 'mirror', value: true }), 'mirrorOnHint');
  assert.equal(mirrorMarkHintKey({ type: 'mirror', value: false }), 'mirrorOffHint');
  assert.equal(mirrorMarkHintKey({ type: 'mark', action: 'set' }), 'markSetHint');
  assert.equal(mirrorMarkHintKey({ type: 'mark', action: 'jump' }), 'markJumpHint');
  assert.equal(mirrorMarkHintKey({ type: 'mark', action: 'clear' }), '');
  assert.equal(mirrorMarkHintKey({ type: 'pause' }), '');
  assert.equal(actionHintKey({ type: 'mirror' }, media), 'mirrorOnHint');
  assert.equal(actionHintKey({ type: 'mirror' }, { ...media, mirrored: true }), 'mirrorOffHint');
  assert.equal(actionHintKey({ type: 'mark', action: 'set' }, media), 'markSetHint');
  assert.equal(actionHintKey({ type: 'mark', action: 'jump' }, media), 'markJumpHint');
  assert.equal(actionHintText('mirrorOnHint'), '镜像开');
  assert.equal(actionHintText('mirrorOffHint'), '镜像关');
  assert.equal(actionHintText('markSetHint'), '已标记');
  assert.equal(actionHintText('markJumpHint'), '回到标记');
  for (const key of ['mirrorUnavailableAudio', 'markUnavailable', 'markMissing', 'cannotSeek'] as const) {
    assert.equal(mirrorMarkFailureKey(messages[key] ?? ''), key);
    assert.equal(actionHintText(key), messages[key]);
  }
  assert.equal(mirrorMarkFailureKey('其它'), '');
  assert.equal(actionHintText('nope'), '');

  const listeners: Array<(command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void> = [];
  const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void): void } };
  const original = commands.onCommand;
  commands.onCommand = { addListener(callback) { listeners.push(callback); } };
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  let clip: Record<string, unknown> = { id: '1', kind: 'video', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1, mirrored: false, currentTime: 12, live: false, seekable: [{ start: 0, end: 120 }] };
  let typing = false;
  let failure = '';
  const hints: string[] = [];
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string; command?: MediaCommand; key?: string }) => {
    if (message.type === 'snapshot') return { media: [clip], typing };
    if (message.type === 'actionHint') { hints.push(message.key ?? ''); return { ok: true }; }
    if (message.type === 'command' && message.command) {
      if (failure) return { error: failure };
      if (message.command.type === 'mirror') clip = { ...clip, mirrored: message.command.value };
    }
    return { ok: true };
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const pageSender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
    const panelSender = { id: fakeBrowser.runtime.id, url: fakeBrowser.runtime.getURL('/popup.html') };
    const hotkey = (action: unknown) => new Promise<Record<string, unknown>>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', type: 'hotkey', action }, pageSender, resolve);
    });
    const panel = (command: MediaCommand) => new Promise<Record<string, unknown>>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', type: 'command', tabId: tab.id, id: '0:1', command }, panelSender, resolve);
    });
    const fire = (name: string) => Promise.all(listeners.map(listener => listener(name, tab)));

    const on = await hotkey({ type: 'mirror' });
    assert.equal(on.handled, true);
    assert.equal(hints.at(-1), 'mirrorOnHint');
    const off = await hotkey({ type: 'mirror' });
    assert.equal(off.handled, true);
    assert.equal(hints.at(-1), 'mirrorOffHint');
    clip = { ...clip, mirrored: false };
    await hotkey({ type: 'mark', action: 'set' });
    assert.equal(hints.at(-1), 'markSetHint');
    await hotkey({ type: 'mark', action: 'jump' });
    assert.equal(hints.at(-1), 'markJumpHint');

    const hinted = hints.length;
    typing = true;
    const typed = await hotkey({ type: 'mirror' });
    assert.equal(typed.handled, false);
    assert.equal(hints.length, hinted);
    typing = false;

    await fire('mirror');
    assert.equal(hints.at(-1), 'mirrorOnHint');
    await fire('mark-set');
    assert.equal(hints.at(-1), 'markSetHint');
    await fire('mark-jump');
    assert.equal(hints.at(-1), 'markJumpHint');

    const panelOn = await panel({ type: 'mirror', value: true });
    assert.equal(panelOn.ok, true);
    assert.equal(hints.at(-1), 'mirrorOnHint');
    const panelOff = await panel({ type: 'mirror', value: false });
    assert.equal(panelOff.ok, true);
    assert.equal(hints.at(-1), 'mirrorOffHint');
    await panel({ type: 'mark', action: 'set' });
    assert.equal(hints.at(-1), 'markSetHint');
    await panel({ type: 'mark', action: 'jump' });
    assert.equal(hints.at(-1), 'markJumpHint');
    const beforeClear = hints.length;
    const cleared = await panel({ type: 'mark', action: 'clear' });
    assert.equal(cleared.ok, true);
    assert.equal(hints.length, beforeClear);

    failure = messages.markMissing ?? '';
    const missing = await hotkey({ type: 'mark', action: 'jump' });
    assert.equal(missing.handled, true);
    assert.equal(missing.error, undefined);
    assert.equal(hints.at(-1), 'markMissing');
    failure = messages.markUnavailable ?? '';
    const blocked = await panel({ type: 'mark', action: 'set' });
    assert.equal(blocked.error, messages.markUnavailable);
    assert.equal(hints.at(-1), 'markUnavailable');
    failure = messages.mirrorUnavailableAudio ?? '';
    const audio = await hotkey({ type: 'mirror' });
    assert.equal(audio.handled, true);
    assert.equal(hints.at(-1), 'mirrorUnavailableAudio');
    failure = messages.cannotSeek ?? '';
    const waiting = await panel({ type: 'mark', action: 'jump' });
    assert.equal(waiting.error, messages.cannotSeek);
    assert.equal(hints.at(-1), 'cannotSeek');
    const kept = hints.length;
    failure = '媒体已移除';
    const other = await panel({ type: 'mirror', value: true });
    assert.equal(other.error, '媒体已移除');
    assert.equal(hints.length, kept);
  } finally {
    commands.onCommand = original;
    fakeBrowser.i18n.getMessage = getMessage;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
