import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';

type Hint = { type?: string; key?: string; seconds?: number };
type Sent = { tabId: number; frameId?: number; message: Hint & { id?: string; at?: number; command?: { type?: string } } };

test('开始、取消和到期暂停成功才发页内提示，失败和已经暂停不假装成功', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  const clip = (id: string, paused = false) => ({ id, kind: 'video', paused, muted: false, volume: 1, maxVolume: 1, rate: 1, currentTime: 30, duration: 600, live: false, seekable: [{ start: 0, end: 600 }] });
  let media = [clip('1')];
  let sleepAt: number | undefined;
  let pauseError = '';
  const sent: Sent[] = [];
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (tabId: number, message: Sent['message'], options?: { frameId?: number }) => {
    sent.push({ tabId, frameId: options?.frameId, message });
    if (message.type === 'snapshot') return { media, ...(options?.frameId === 0 && sleepAt != null ? { sleepAt } : {}) };
    if (message.type === 'sleep') { sleepAt = message.at; return { ok: true }; }
    if (message.type === 'sleepCancel') {
      if (sleepAt == null) return { error: '现在没有睡眠定时。' };
      sleepAt = undefined;
      return { ok: true };
    }
    if (message.type === 'sleepExtend') {
      if (sleepAt == null) return { error: '现在没有睡眠定时。' };
      sleepAt += 15 * 60_000;
      return { ok: true, sleepAt };
    }
    if (message.type === 'command' && message.command?.type === 'pause') {
      if (pauseError) return { error: pauseError };
      media = media.map(item => item.id === message.id ? { ...item, paused: true } : item);
      return { ok: true };
    }
    return { ok: true };
  });
  const catalog = (globalThis as unknown as { chrome: { i18n: { getMessage: (name: string) => string } } }).chrome.i18n;
  const getMessage = mock.method(fakeBrowser.i18n, 'getMessage', (name: string) => catalog.getMessage(name));
  const panel = { id: fakeBrowser.runtime.id, url: fakeBrowser.runtime.getURL('/popup.html') };
  const page = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
  const ask = (message: object, from: object = panel) => new Promise<Record<string, unknown>>(resolve => {
    void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', tabId: tab.id, ...message }, from, resolve);
  });
  const hints = () => sent.filter(item => item.message.type === 'actionHint').map(item => ({ key: item.message.key, seconds: item.message.seconds, frameId: item.frameId }));
  const commands = () => sent.filter(item => item.message.type === 'command').map(item => `${item.message.id}:${item.message.command?.type}`);
  try {
    const background = await import('../entrypoints/background');
    background.default.main();

    media = [];
    assert.equal((await ask({ type: 'sleep', minutes: 30 })).ok, undefined);
    assert.deepEqual(hints(), [], '没有媒体时不提示已开始');

    media = [clip('1')];
    assert.deepEqual(await ask({ type: 'sleep', minutes: 2.5 }), { error: '无效的控制指令。' });
    assert.deepEqual(hints(), [], '无效分钟不提示');
    assert.deepEqual(await ask({ type: 'sleepCancel' }), { error: '现在没有睡眠定时。' });
    assert.deepEqual(hints(), [], '没有定时时取消不提示成功');

    const started = await ask({ type: 'sleep', minutes: 30 });
    assert.equal(started.ok, true);
    assert.deepEqual(hints(), [{ key: 'sleepStartHint', seconds: 30, frameId: 0 }], '开始成功才提示，并且交给顶层页面');
    assert.deepEqual(commands(), [], '开始不暂停');

    const beforeExtend = hints().length;
    const extended = await ask({ type: 'sleepExtend' });
    assert.equal(extended.ok, true);
    assert.equal(hints().length, beforeExtend, '续时不再发一条提示');

    const cancelled = await ask({ type: 'sleepCancel' });
    assert.equal(cancelled.ok, true);
    assert.equal(hints().at(-1)?.key, 'sleepCancelHint');
    assert.deepEqual(commands(), [], '取消不暂停');

    await ask({ type: 'sleep', minutes: 15 });
    sleepAt = undefined;
    await ask({ type: 'sleepDue' }, { ...page, frameId: 3 });
    assert.equal(hints().filter(item => item.key === 'sleepDueHint').length, 0, 'iframe 的到期不提示');
    assert.deepEqual(commands(), []);

    media = [];
    await ask({ type: 'sleepDue' }, page);
    assert.equal(hints().filter(item => item.key === 'sleepDueHint').length, 0, '媒体已卸不提示已暂停');
    assert.deepEqual(commands(), []);

    media = [clip('1', true)];
    await ask({ type: 'sleepDue' }, page);
    assert.equal(hints().filter(item => item.key === 'sleepDueHint').length, 0, '已经暂停不再提示成功');
    assert.deepEqual(commands(), []);

    media = [clip('1')];
    pauseError = '这一页现在不能控制。';
    const failed = await ask({ type: 'sleepDue' }, page);
    assert.equal(failed.ok, undefined);
    assert.match(String(failed.error), /不能控制/);
    assert.equal(hints().filter(item => item.key === 'sleepDueHint').length, 0, '暂停失败不提示成功');
    assert.equal(media[0]?.paused, false);

    pauseError = '';
    const paused = await ask({ type: 'sleepDue' }, page);
    assert.equal(paused.ok, true);
    assert.deepEqual(commands(), ['1:pause', '1:pause'], '失败的那次发过暂停，成功的那次再发一次');
    assert.equal(hints().filter(item => item.key === 'sleepDueHint').length, 1);
    assert.equal(media[0]?.paused, true);
  } finally {
    sendMessage.mock.restore();
    getMessage.mock.restore();
    fakeBrowser.reset();
  }
});
