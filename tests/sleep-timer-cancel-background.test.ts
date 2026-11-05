import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';

type Sent = { tabId: number; frameId?: number; message: { type?: string; id?: string; at?: number; minutes?: number; command?: { type?: string } } };

test('取消和续 +15 只改页面里的截止时间，不暂停，也不写存储', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  const clip = (id: string) => ({ id, kind: 'video', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1, currentTime: 30, duration: 600, live: false, seekable: [{ start: 0, end: 600 }] });
  let media = [clip('1'), clip('2')];
  let sleepAt: number | undefined;
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
    if (message.type === 'command') {
      if (message.command?.type === 'pause') media = media.map(item => item.id === message.id ? { ...item, paused: true } : item);
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
  const commands = () => sent.filter(item => item.message.type === 'command').map(item => `${item.message.id}:${item.message.command?.type}`);
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const settingsBefore = JSON.stringify(await fakeBrowser.storage.local.get(null));

    assert.deepEqual(await ask({ type: 'sleepCancel' }), { error: '现在没有睡眠定时。' }, '没有定时时不能取消');
    assert.deepEqual(await ask({ type: 'sleepExtend' }), { error: '现在没有睡眠定时。' }, '没有定时时不能续');
    assert.deepEqual(commands(), []);

    await ask({ type: 'select', id: '0:1', manual: true });
    const started = await ask({ type: 'sleep', minutes: 15 });
    assert.equal(started.ok, true);
    const armedAt = sent.find(item => item.message.type === 'sleep')?.message.at ?? 0;
    await ask({ type: 'select', id: '0:2', manual: true });
    const extended = await ask({ type: 'sleepExtend', minutes: 90 });
    assert.equal(extended.ok, true);
    assert.equal(extended.sleepAt, armedAt + 15 * 60_000, '续时只加 15 分钟，不理传来的分钟数');
    const extendCalls = sent.filter(item => item.message.type === 'sleepExtend');
    assert.equal(extendCalls.length, 2, '没开时拒绝过一次，开了之后再续一次');
    const extendCall = extendCalls[1];
    assert.equal(extendCall?.frameId, 0, '续时交给顶层框架');
    assert.equal(extendCall?.message.minutes, undefined, '后台不把分钟数下发到页面');
    assert.deepEqual(commands(), [], '换目标和续时都不暂停');
    assert.equal(media.every(item => !item.paused), true);

    sleepAt = undefined;
    await ask({ type: 'sleepDue' }, page);
    assert.deepEqual(commands(), ['2:pause'], '到期仍只暂停续时之后的当前选中');
    assert.equal(media.find(item => item.id === '1')?.paused, false, '旧目标继续播放');

    const restarted = await ask({ type: 'sleep', minutes: 15 });
    assert.equal(restarted.ok, true);
    const pausedBeforeCancel = commands();
    const cancelled = await ask({ type: 'sleepCancel' });
    assert.equal(cancelled.ok, true);
    assert.equal(sleepAt, undefined);
    assert.deepEqual(commands(), pausedBeforeCancel, '取消不暂停');
    assert.equal((await ask({ type: 'read' })).sleepAt, undefined, '取消后面板不再显示倒计时');

    const again = await ask({ type: 'sleep', minutes: 30 });
    assert.equal(again.ok, true, '误触取消后可以再设');
    assert.equal(typeof again.sleepAt, 'number');
    media = [];
    const cleared = await ask({ type: 'sleepCancel' });
    assert.equal(cleared.ok, true, '媒体没了也能取消已开的定时');
    assert.deepEqual(commands(), pausedBeforeCancel);

    const stored = JSON.stringify(await fakeBrowser.storage.local.get(null));
    assert.equal(stored, settingsBefore, '不写站点记忆和设置');
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const sleepSettingFields = new Set(['sleepSoonHint', 'sleepDefaultMinutes', 'floatingSleepNote']);
    for (const [key, value] of Object.entries(parsed)) {
      assert.equal(/sleep/i.test(key), false, `睡眠倒计时不应写成存储键 ${key}`);
      if (key !== 'ottertap-settings-v1' || !value || typeof value !== 'object') continue;
      for (const field of Object.keys(value)) {
        if (/sleep/i.test(field)) assert.equal(sleepSettingFields.has(field), true, `设置里出现了名单外的睡眠字段 ${field}`);
      }
    }
  } finally {
    sendMessage.mock.restore();
    getMessage.mock.restore();
    fakeBrowser.reset();
  }
});
