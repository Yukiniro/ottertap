import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';

type Sent = { tabId: number; frameId?: number; message: { type?: string; id?: string; at?: number; command?: { type?: string } } };

test('睡眠定时挂在标签的顶层框架上，到期只暂停那时的当前选中，不写存储', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  const clip = (id: string) => ({ id, kind: 'video', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1, currentTime: 30, duration: 600, live: false, seekable: [{ start: 0, end: 600 }] });
  let media: ReturnType<typeof clip>[] = [];
  let sleepAt: number | undefined;
  const sent: Sent[] = [];
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (tabId: number, message: Sent['message'], options?: { frameId?: number }) => {
    sent.push({ tabId, frameId: options?.frameId, message });
    if (message.type === 'snapshot') return { media, ...(options?.frameId === 0 && sleepAt != null ? { sleepAt } : {}) };
    if (message.type === 'sleep') { sleepAt = message.at; return { ok: true }; }
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

    assert.deepEqual(await ask({ type: 'sleep', minutes: 15 }), { error: '这一页没有可暂停的媒体。' }, '没有媒体时不能开定时');
    assert.equal(sent.some(item => item.message.type === 'sleep'), false);

    media = [clip('1'), clip('2')];
    for (const minutes of [0, 181, 2.5, '30']) {
      assert.deepEqual(await ask({ type: 'sleep', minutes }), { error: '无效的控制指令。' }, `拒绝 ${String(minutes)} 分钟`);
    }
    assert.equal(sent.some(item => item.message.type === 'sleep'), false, '无效分钟不下发到页面');

    await ask({ type: 'select', id: '0:1', manual: true });
    const before = Date.now();
    const started = await ask({ type: 'sleep', minutes: 30 });
    const after = Date.now();
    assert.equal(started.ok, true);
    const armed = sent.filter(item => item.message.type === 'sleep');
    assert.equal(armed.length, 1);
    assert.equal(armed[0]?.frameId, 0, '定时交给顶层框架');
    const at = armed[0]?.message.at ?? 0;
    assert.ok(at >= before + 30 * 60_000 && at <= after + 30 * 60_000, `截止时间约 30 分钟后：${at - before}`);
    assert.equal(started.sleepAt, at);

    const read = await ask({ type: 'read' });
    assert.equal(read.sleepAt, at, '面板读到同一个截止时间');
    assert.equal(read.selectedId, '0:1');
    assert.deepEqual(commands(), [], '开定时不暂停任何媒体');

    await ask({ type: 'select', id: '0:2', manual: true });
    assert.deepEqual(commands(), [], '换目标不立刻暂停旧的那条');

    await ask({ type: 'sleepDue' }, { ...page, frameId: 3 });
    assert.deepEqual(commands(), [], 'iframe 发来的到期不算');

    sleepAt = undefined;
    await ask({ type: 'sleepDue' }, page);
    assert.deepEqual(commands(), ['2:pause'], '到期只暂停那时的当前选中');
    assert.equal(media.find(item => item.id === '1')?.paused, false, '旧目标继续播放');

    await ask({ type: 'sleepDue' }, page);
    assert.deepEqual(commands(), ['2:pause'], '已经暂停的不再发命令');
    assert.equal((await ask({ type: 'read' })).sleepAt, undefined, '到期后面板不再显示倒计时');

    assert.equal(JSON.stringify(await fakeBrowser.storage.local.get(null)), settingsBefore, '不写站点记忆和设置');
  } finally {
    sendMessage.mock.restore();
    getMessage.mock.restore();
    fakeBrowser.reset();
  }
});
