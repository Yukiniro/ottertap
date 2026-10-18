import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import type { TabSnapshot } from '../lib/tabs';

test('后台列出其他发声或已静音标签，并处理切换与静音', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  fakeBrowser.i18n.getMessage = (name: string) => name;
  const audible: TabSnapshot[] = [
    { id: 7, windowId: 2, title: 'This tab', audible: true, mutedInfo: { muted: false }, favIconUrl: 'https://cdn.example/this.png' },
    { id: 8, windowId: 3, title: 'Video', audible: true, mutedInfo: { muted: false }, favIconUrl: 'https://cdn.example/video.png', lastAccessed: 4 },
  ];
  const muted: TabSnapshot[] = [
    { id: 9, windowId: 3, title: 'Muted video', audible: false, mutedInfo: { muted: true }, lastAccessed: 9 },
    { id: 8, windowId: 3, title: 'Video', audible: true, mutedInfo: { muted: false } },
  ];
  const queries: object[] = [];
  const updates: Array<{ kind: 'tab' | 'window'; id: number; props: object }> = [];
  const query = mock.method(fakeBrowser.tabs, 'query', async (info: { audible?: boolean; muted?: boolean }) => {
    queries.push(info);
    if (info.audible) return audible;
    if (info.muted) return muted;
    return [];
  });
  const updateTab = mock.method(fakeBrowser.tabs, 'update', async (id: number, props: { active?: boolean; muted?: boolean }) => {
    updates.push({ kind: 'tab', id, props });
    return { id, windowId: 3, mutedInfo: { muted: props.muted === true } };
  });
  const updateWindow = mock.method(fakeBrowser.windows, 'update', async (id: number, props: { focused?: boolean }) => {
    updates.push({ kind: 'window', id, props });
    return { id, focused: props.focused === true };
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const page = { id: fakeBrowser.runtime.id, url: fakeBrowser.runtime.getURL('/popup.html') };
    const request = (message: object, sender: object = page) => new Promise<Record<string, unknown>>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, sender, resolve);
    });
    const listed = await request({ type: 'soundingTabs', tabId: 7 });
    assert.deepEqual(queries, [{ audible: true }, { muted: true }]);
    assert.deepEqual(listed.tabs, [
      { id: 8, windowId: 3, title: 'Video', favIconUrl: 'https://cdn.example/video.png', muted: false },
      { id: 9, windowId: 3, title: 'Muted video', favIconUrl: '', muted: true },
    ]);

    const blocked = await request({ type: 'focusTab', tabId: 9 }, { id: fakeBrowser.runtime.id, url: 'https://example.com/watch', tab: { id: 7 } });
    assert.equal(typeof blocked.error, 'string');
    assert.equal(updates.length, 0);

    assert.equal((await request({ type: 'focusTab', tabId: 9 })).ok, true);
    assert.deepEqual(updates, [
      { kind: 'tab', id: 9, props: { active: true } },
      { kind: 'window', id: 3, props: { focused: true } },
    ]);
    assert.equal((await request({ type: 'muteTab', tabId: 9, muted: false })).muted, false);
    assert.deepEqual(updates.at(-1), { kind: 'tab', id: 9, props: { muted: false } });
    assert.equal((await request({ type: 'muteTab', tabId: 9, muted: true })).muted, true);
    assert.equal(typeof (await request({ type: 'muteTab', tabId: '9', muted: true })).error, 'string');
    assert.equal(typeof (await request({ type: 'muteTab', tabId: 9, muted: 'yes' })).error, 'string');
    assert.equal(updates.filter(item => item.kind === 'tab' && 'muted' in item.props).length, 2);
  } finally {
    query.mock.restore();
    updateTab.mock.restore();
    updateWindow.mock.restore();
    fakeBrowser.reset();
  }
});
