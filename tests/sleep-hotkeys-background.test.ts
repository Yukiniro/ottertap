import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { defaultSettings } from '../lib/types';

const settingsKey = 'ottertap-settings-v1';
type Message = { type?: string; key?: string; seconds?: number; at?: number };

test('睡眠快捷键和扩展命令按默认档开始、重开和取消；输入框聚焦或没有媒体时不动', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const listeners: Array<(command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void> = [];
  const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void): void } };
  commands.onCommand = { addListener(callback) { listeners.push(callback); } };
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  await fakeBrowser.storage.local.set({ [settingsKey]: { ...defaultSettings, sleepDefaultMinutes: 45 } });
  const clip = { id: '1', kind: 'video', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1, currentTime: 30, duration: 600, live: false, seekable: [{ start: 0, end: 600 }] };
  let media = [clip];
  let typing = false;
  let sleepAt: number | undefined;
  const sent: Message[] = [];
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: Message) => {
    sent.push(message);
    if (message.type === 'snapshot') return { media, typing };
    if (message.type === 'sleep') { sleepAt = message.at; return { ok: true }; }
    if (message.type === 'sleepCancel') {
      if (sleepAt == null) return { error: '现在没有睡眠定时。' };
      sleepAt = undefined;
      return { ok: true };
    }
    return { ok: true };
  });
  const catalog = (globalThis as unknown as { chrome: { i18n: { getMessage: (name: string) => string } } }).chrome.i18n;
  const getMessage = mock.method(fakeBrowser.i18n, 'getMessage', (name: string) => catalog.getMessage(name));
  const page = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
  const ask = (message: object) => new Promise<{ handled?: boolean; error?: string }>(resolve => {
    void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, page, resolve);
  });
  const fire = (name: string) => Promise.all(listeners.map(listener => listener(name)));
  const arms = () => sent.filter(item => item.type === 'sleep');
  const hints = () => sent.filter(item => item.type === 'actionHint').map(item => item.seconds == null ? item.key : `${item.key}:${item.seconds}`);
  const pauses = () => sent.filter(item => item.type === 'command');
  try {
    const background = await import('../entrypoints/background');
    background.default.main();

    const before = Date.now();
    await fire('sleep-start');
    assert.equal(arms().length, 1);
    const first = arms()[0]!.at!;
    assert.ok(first - before >= 45 * 60_000 && first - Date.now() <= 45 * 60_000, '按设置里的 45 分钟开始');
    assert.deepEqual(hints(), ['sleepStartHint:45']);
    assert.deepEqual(pauses(), [], '开始不暂停');

    await new Promise(resolve => setTimeout(resolve, 5));
    assert.deepEqual(await ask({ type: 'hotkey', action: { type: 'sleep', action: 'start' } }), { handled: true });
    assert.equal(arms().length, 2, '进行中再按一次从现在起重开');
    assert.ok(arms()[1]!.at! > first);
    assert.deepEqual(hints(), ['sleepStartHint:45', 'sleepStartHint:45']);

    await fakeBrowser.storage.local.set({ [settingsKey]: { ...defaultSettings, sleepDefaultMinutes: 15 } });
    await new Promise(resolve => setTimeout(resolve, 0));
    await fire('sleep-start');
    assert.ok(arms()[2]!.at! - Date.now() <= 15 * 60_000 && arms()[2]!.at! - Date.now() > 14 * 60_000, '改档后立即按新档');

    await fire('sleep-cancel');
    assert.equal(sleepAt, undefined);
    assert.equal(hints().at(-1), 'sleepCancelHint');
    assert.deepEqual(await ask({ type: 'hotkey', action: { type: 'sleep', action: 'cancel' } }), { handled: true });
    assert.equal(hints().at(-1), 'sleepTimerIdle', '没有定时时取消说一句现在没有，不假装取消成功');
    assert.deepEqual(pauses(), [], '取消不暂停');

    typing = true;
    const quiet = sent.length;
    await fire('sleep-start');
    await fire('sleep-cancel');
    assert.deepEqual(sent.slice(quiet).map(item => item.type).filter(type => type !== 'snapshot'), [], '输入框聚焦时扩展命令不开始也不取消');
    typing = false;

    media = [];
    assert.deepEqual(await ask({ type: 'hotkey', action: { type: 'sleep', action: 'start' } }), { handled: false });
    assert.equal(arms().length, 3, '没有媒体时不开始');

    assert.match(String((await ask({ type: 'hotkey', action: { type: 'sleep', action: 'extend' } })).error), /无效/);
  } finally {
    sendMessage.mock.restore();
    getMessage.mock.restore();
    fakeBrowser.reset();
  }
});
