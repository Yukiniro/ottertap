import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { defaultSettings } from '../lib/types';

test('选中从一条换到另一条时只高亮新的那条；音频改走短提示', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/feed', active: true });
  const media = [
    { id: '1', kind: 'video', paused: true, muted: false, volume: 1, maxVolume: 1, rate: 1, currentTime: 0, duration: 10, live: false, seekable: [{ start: 0, end: 10 }] },
    { id: '2', kind: 'audio', paused: true, muted: false, volume: 1, maxVolume: 1, rate: 1, currentTime: 0, duration: 10, live: false, seekable: [{ start: 0, end: 10 }] }
  ];
  const highlights: string[] = [];
  const hints: string[] = [];
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type?: string; id?: string; key?: string }) => {
    if (message.type === 'snapshot') return { media };
    if (message.type === 'highlight') {
      highlights.push(message.id ?? '');
      const item = media.find(entry => entry.id === message.id);
      return { ok: true, kind: item?.kind ?? 'video' };
    }
    if (message.type === 'actionHint') { hints.push(message.key ?? ''); return { ok: true }; }
    if (message.type === 'command') return { ok: true };
    return { ok: true };
  });
  const sender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
  const ask = (message: object) => new Promise<unknown>(resolve => {
    void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, sender, resolve);
  });
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));
  const selected = async () => (await ask({ type: 'read' }) as { selectedId?: string }).selectedId ?? '';
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    await ask({ type: 'playing', id: '1' });
    assert.equal(await selected(), '0:1');
    await flush();
    assert.deepEqual(highlights, [], '第一次锁住不画轮廓');
    await ask({ type: 'playing', id: '2' });
    await flush();
    assert.equal(await selected(), '0:2');
    assert.deepEqual(highlights, ['2']);
    assert.deepEqual(hints, ['audioSelectedHint']);
    highlights.length = 0;
    hints.length = 0;
    await ask({ type: 'playing', id: '2' });
    await flush();
    assert.deepEqual(highlights, [], '同一条再次播放不再提示');
    await ask({ type: 'select', id: '0:1', manual: true });
    await flush();
    assert.equal(await selected(), '0:1');
    assert.deepEqual(highlights, ['1']);
    assert.deepEqual(hints, [], '视频不走短提示');
    highlights.length = 0;
    await ask({ type: 'highlight', id: '0:2' });
    await flush();
    assert.deepEqual(highlights, [], '列表打开时不再去画已经离开的那一条');
    await ask({ type: 'highlight', id: '0:1' });
    await flush();
    assert.deepEqual(highlights, ['1']);
    highlights.length = 0;
    await ask({ type: 'playing', id: '2' });
    await flush();
    assert.equal(await selected(), '0:1', '刚点选时不跟随');
    assert.deepEqual(highlights, []);
    await ask({ type: 'hotkey', action: { type: 'volume', delta: 10 }, target: '2' });
    await flush();
    assert.equal(await selected(), '0:2');
    assert.deepEqual(highlights, ['2']);
    assert.deepEqual(hints, ['audioSelectedHint']);

    highlights.length = 0;
    hints.length = 0;
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, followPlaying: false } });
    await new Promise(resolve => setTimeout(resolve, 20));
    await ask({ type: 'select', id: '0:1' });
    await flush();
    highlights.length = 0;
    hints.length = 0;
    await ask({ type: 'playing', id: '2' });
    await flush();
    assert.equal(await selected(), '0:1');
    assert.deepEqual(highlights, [], '关闭跟随后不因为播放而高亮');
    assert.deepEqual(hints, []);
  } finally {
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
