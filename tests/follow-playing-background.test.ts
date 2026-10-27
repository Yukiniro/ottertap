import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { defaultSettings } from '../lib/types';

test('播放消息切换选中；非手动选择不让路，手动点选和关闭设置时不切换', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  const other = await fakeBrowser.tabs.create({ url: 'https://example.com/feed', active: false });
  const media = [
    { id: '1', paused: true, muted: false, volume: 1, maxVolume: 1, rate: 1, currentTime: 0, duration: 10, live: false, seekable: [{ start: 0, end: 10 }] },
    { id: '2', paused: true, muted: false, volume: 1, maxVolume: 1, rate: 1, currentTime: 0, duration: 10, live: false, seekable: [{ start: 0, end: 10 }] }
  ];
  const applied: string[] = [];
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type?: string; id?: string }) => {
    if (message.type === 'snapshot') return { media };
    if (message.type === 'command') applied.push(message.id ?? '');
    return { ok: true };
  });
  const sender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
  const senderB = { id: fakeBrowser.runtime.id, tab: other, frameId: 0 };
  const ask = (message: object, from = sender) => new Promise<unknown>(resolve => {
    void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, from, resolve);
  });
  const selected = async (from = sender) => (await ask({ type: 'read' }, from) as { selectedId?: string }).selectedId ?? '';
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    await ask({ type: 'playing', id: '2' });
    assert.equal(await selected(), '0:2', '没有选中时，开始播放的那一条成为选中');
    await ask({ type: 'hotkey', action: { type: 'rate', direction: 1 } });
    assert.equal(applied.at(-1), '2', '页内倍速作用在跟随到的媒体上');
    await ask({ type: 'select', id: '0:1' });
    assert.equal(await selected(), '0:1');
    await ask({ type: 'playing', id: '2' });
    assert.equal(await selected(), '0:2', '面板自动补上的选择不挡住跟随');
    await ask({ type: 'select', id: '0:1', manual: true });
    assert.equal(await selected(), '0:1');
    await ask({ type: 'playing', id: '2' });
    assert.equal(await selected(), '0:1', '刚手动点选时，另一条开始播放不抢走');
    await ask({ type: 'playing', id: 'nope' });
    assert.equal(await selected(), '0:1');
    await ask({ type: 'playing', id: '1' });
    assert.equal(await selected(), '0:1', '同一条再次播放不换目标');

    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, followPlaying: false } });
    await new Promise(resolve => setTimeout(resolve, 20));
    await ask({ type: 'select', id: '0:1' }, senderB);
    await ask({ type: 'playing', id: '2' }, senderB);
    assert.equal(await selected(senderB), '0:1', '关闭设置后不再自动切');
    await ask({ type: 'playing', id: '2' });
    assert.equal(await selected(), '0:1', '关闭设置后，原来的标签页也不再跟随');

    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, followPlaying: true } });
    await new Promise(resolve => setTimeout(resolve, 20));
    await ask({ type: 'playing', id: '2' }, senderB);
    assert.equal(await selected(senderB), '0:2', '重新打开后，没有手动点选的标签页恢复跟随');
  } finally {
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
