import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';

test('扩展命令按页面顺序循环上一条和下一条；输入框聚焦时不执行；只有一条时给出短说明', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const listeners: Array<(command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void> = [];
  const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void): void } };
  const original = commands.onCommand;
  commands.onCommand = { addListener(callback) { listeners.push(callback); } };
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/feed', active: true });
  const item = (id: string, label: string) => ({ id, kind: 'video', label, title: label, paused: true, muted: false, volume: 1, maxVolume: 1, rate: 1, currentTime: 0, duration: 10, live: false, seekable: [{ start: 0, end: 10 }] });
  let media = [item('3', 'Third'), item('1', 'First'), item('2', 'Second')];
  let typing = false;
  const highlights: string[] = [];
  const hints: string[] = [];
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type?: string; id?: string; key?: string }) => {
    if (message.type === 'snapshot') return { media, typing };
    if (message.type === 'highlight') { highlights.push(message.id ?? ''); return { ok: true, kind: 'video' }; }
    if (message.type === 'actionHint') { hints.push(message.key ?? ''); return { ok: true }; }
    return { ok: true };
  });
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const fire = (name: string) => Promise.all(listeners.map(listener => listener(name)));
    const sender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
    const ask = (message: object) => new Promise<unknown>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, sender, resolve);
    });
    const selected = async () => (await ask({ type: 'read' }) as { selectedId?: string }).selectedId ?? '';
    const hotkey = (direction: 1 | -1) => ask({ type: 'hotkey', action: { type: 'media', direction } }) as Promise<{ handled?: boolean }>;

    await fire('media-next');
    await flush();
    assert.equal(await selected(), '0:1', '没有选中时，下一条从页面顺序的第一条走到下一条');
    assert.deepEqual(highlights, ['1']);
    await fire('media-next');
    await flush();
    assert.equal(await selected(), '0:2');
    media = [item('3', 'Third'), item('1', 'First')];
    highlights.length = 0;
    await fire('media-next');
    await flush();
    assert.equal(await selected(), '0:1', '选中已经不在列表里时，从还在的第一条走到下一条，不回到卸下的那条');
    assert.equal(highlights.includes('2'), false);
    media = [item('3', 'Third'), item('1', 'First'), item('2', 'Second')];
    await fire('media-next');
    await flush();
    assert.equal(await selected(), '0:2');
    await fire('media-next');
    await flush();
    assert.equal(await selected(), '0:3', '走到末尾后回到页面顺序的第一条');
    await fire('media-prev');
    await flush();
    assert.equal(await selected(), '0:2');
    const stepped = await hotkey(1);
    assert.equal(stepped.handled, true);
    assert.equal(await selected(), '0:3');

    typing = true;
    const held = await selected();
    highlights.length = 0;
    hints.length = 0;
    await fire('media-next');
    await fire('media-prev');
    const typed = await hotkey(-1);
    assert.equal(typed.handled, false);
    assert.equal(await selected(), held, '输入框聚焦时不切换');
    assert.deepEqual(highlights, []);
    assert.deepEqual(hints, []);
    typing = false;

    const alone = (await selected()).split(':')[1] || '3';
    media = [item(alone, 'Only')];
    hints.length = 0;
    highlights.length = 0;
    await fire('media-next');
    await flush();
    assert.deepEqual(hints, ['mediaOnlyOne']);
    assert.deepEqual(highlights, []);
    assert.equal(await selected(), held, '只有一条时选中不动');
    const pageKey = await hotkey(1);
    assert.equal(pageKey.handled, true);
    assert.deepEqual(hints, ['mediaOnlyOne', 'mediaOnlyOne']);

    media = [];
    hints.length = 0;
    await fire('media-prev');
    assert.deepEqual(hints, [], '没有媒体时不提示');

    media = [item('3', 'Third'), item('1', 'First')];
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { siteMode: 'exclude', sites: ['example.com'], sitePrefs: { 'example.com': { volume: 0.4 } } } });
    await flush();
    highlights.length = 0;
    hints.length = 0;
    await fire('media-next');
    await flush();
    assert.deepEqual(highlights, [], '站点停用时不切换');
    assert.deepEqual(hints, []);
    await fakeBrowser.tabs.create({ url: 'chrome://extensions', active: true });
    await fire('media-next');
    await flush();
    assert.deepEqual(highlights, []);

    const stored = await fakeBrowser.storage.local.get('ottertap-settings-v1') as { 'ottertap-settings-v1'?: { sitePrefs?: Record<string, unknown> } };
    assert.deepEqual(stored['ottertap-settings-v1']?.sitePrefs, { 'example.com': { volume: 0.4 } });
  } finally {
    commands.onCommand = original;
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
