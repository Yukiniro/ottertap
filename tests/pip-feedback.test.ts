import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { readFlatMessages } from '../lib/message-catalog';
import type { MediaCommand, MediaState } from '../lib/types';

const read = (file: string) => readFlatMessages(readFileSync(new URL(`../locales/${file}`, import.meta.url), 'utf8'));
const messages = read('zh_CN.yml');

test('八种语言都有画中画开和关', () => {
  const files = readdirSync(new URL('../locales/', import.meta.url)).filter(name => name.endsWith('.yml')).sort();
  assert.deepEqual(files, ['de.yml', 'en.yml', 'es.yml', 'fr.yml', 'ja.yml', 'ko.yml', 'zh_CN.yml', 'zh_TW.yml']);
  for (const file of files) {
    const locale = read(file);
    assert.notEqual(locale.pipOnHint, '', file);
    assert.notEqual(locale.pipOffHint, '', file);
    assert.notEqual(locale.pipOnHint, locale.pipOffHint, file);
  }
  assert.equal(read('en.yml').pipOnHint, 'Picture-in-picture on');
  assert.equal(read('en.yml').pipOffHint, 'Picture-in-picture off');
  assert.equal(messages.pipOnHint, '画中画开');
  assert.equal(messages.pipOffHint, '画中画关');
});

test('面板、浮动、页内键和扩展命令成功时发出页内提示，失败仍用原来的短说明', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  const getMessage = fakeBrowser.i18n.getMessage;
  fakeBrowser.i18n.getMessage = (name: string) => messages[name] ?? '';
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const { actionHintKey, actionHintText, pipSuccessHintKey } = await import('../lib/hotkey');
  const media = { id: '1', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1, pip: false } as MediaState;
  assert.equal(pipSuccessHintKey(false), 'pipOnHint');
  assert.equal(pipSuccessHintKey(true), 'pipOffHint');
  assert.equal(actionHintKey({ type: 'pip' }, media), 'pipOnHint');
  assert.equal(actionHintKey({ type: 'pip' }, { ...media, pip: true }), 'pipOffHint');
  assert.equal(actionHintText('pipOnHint'), '画中画开');
  assert.equal(actionHintText('pipOffHint'), '画中画关');
  for (const key of ['pipUnavailableAudio', 'pipDisabledBySite', 'pipUnsupported', 'pipNeedsGesture', 'pipNotReady', 'pipFailed'] as const) {
    assert.equal(actionHintText(key), messages[key]);
  }

  const listeners: Array<(command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void> = [];
  const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void): void } };
  const original = commands.onCommand;
  commands.onCommand = { addListener(callback) { listeners.push(callback); } };
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  let clip: Record<string, unknown> = { id: '1', kind: 'video', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1, pip: false, pipAvailable: true, pipBlock: '' };
  let failure = '';
  const hints: string[] = [];
  const applied: MediaCommand[] = [];
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string; command?: MediaCommand; key?: string }) => {
    if (message.type === 'snapshot') return { media: [clip] };
    if (message.type === 'actionHint') { hints.push(message.key ?? ''); return { ok: true }; }
    if (message.type === 'command' && message.command) {
      applied.push(message.command);
      if (message.command.type === 'pip' && failure) return { error: failure };
      if (message.command.type === 'pip') clip = { ...clip, pip: clip.pip !== true };
    }
    return { ok: true };
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const pageSender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
    const panelSender = { id: fakeBrowser.runtime.id, url: fakeBrowser.runtime.getURL('/popup.html') };
    const hotkey = () => new Promise<Record<string, unknown>>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', type: 'hotkey', action: { type: 'pip' } }, pageSender, resolve);
    });
    const command = (sender: { id?: string; tab?: typeof tab; frameId?: number; url?: string }) => new Promise<Record<string, unknown>>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', type: 'command', tabId: tab.id, id: '0:1', command: { type: 'pip' } }, sender, resolve);
    });
    const fire = () => Promise.all(listeners.map(listener => listener('pip', tab)));

    const entered = await hotkey();
    assert.equal(entered.handled, true);
    assert.deepEqual(applied.at(-1), { type: 'pip' });
    assert.equal(hints.at(-1), 'pipOnHint');
    const left = await hotkey();
    assert.equal(left.handled, true);
    assert.deepEqual(applied.at(-1), { type: 'pip' });
    assert.equal(hints.at(-1), 'pipOffHint');

    await fire();
    assert.deepEqual(applied.at(-1), { type: 'pip' });
    assert.equal(hints.at(-1), 'pipOnHint');
    await fire();
    assert.equal(hints.at(-1), 'pipOffHint');

    const panelOn = await command(panelSender);
    assert.equal(panelOn.ok, true);
    assert.deepEqual(applied.at(-1), { type: 'pip' });
    assert.equal(hints.at(-1), 'pipOnHint');
    const panelOff = await command(panelSender);
    assert.equal(panelOff.ok, true);
    assert.equal(hints.at(-1), 'pipOffHint');

    const floatOn = await command(pageSender);
    assert.equal(floatOn.ok, true);
    assert.deepEqual(applied.at(-1), { type: 'pip' });
    assert.equal(hints.at(-1), 'pipOnHint');
    const floatOff = await command(pageSender);
    assert.equal(floatOff.ok, true);
    assert.equal(hints.at(-1), 'pipOffHint');

    failure = messages.pipUnavailableAudio ?? '';
    const audio = await hotkey();
    assert.equal(audio.handled, true);
    assert.equal(hints.at(-1), 'pipUnavailableAudio');
    const beforePanelFailure = hints.length;
    const blocked = await command(panelSender);
    assert.equal(blocked.error, messages.pipUnavailableAudio);
    assert.equal(hints.length, beforePanelFailure);
    failure = messages.pipNeedsGesture ?? '';
    await fire();
    assert.equal(hints.at(-1), 'pipNeedsGesture');
    failure = 'frame send failed';
    const kept = hints.length;
    const sent = applied.length;
    const other = await command(pageSender);
    assert.equal(other.error, 'frame send failed');
    assert.equal(applied.length, sent + 1);
    assert.equal(hints.length, kept);

    const stored = await fakeBrowser.storage.local.get('ottertap-settings-v1');
    const prefs = (stored['ottertap-settings-v1'] as { sitePrefs?: object } | undefined)?.sitePrefs;
    assert.equal(prefs === undefined || Object.keys(prefs).length === 0, true);
  } finally {
    commands.onCommand = original;
    fakeBrowser.i18n.getMessage = getMessage;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
