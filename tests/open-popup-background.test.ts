import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';

test('内容脚本请求打开工具栏弹出面板，失败时不改弹出页，并锁住当前媒体', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const calls: Array<{ windowId?: number } | null> = [];
  const openPopup = mock.method(fakeBrowser.action, 'openPopup', async (options?: { windowId?: number }) => {
    calls.push(options ?? null);
  });
  const setPopup = mock.method(fakeBrowser.action, 'setPopup', async () => {
    throw new Error('should not replace the toolbar popup');
  });
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type: string }) => {
    if (message.type === 'snapshot') return { media: [{ id: '1', title: '预览' }, { id: '2', title: '正片' }] };
    return { ok: true };
  });
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  const ask = (message: object, sender: object) => new Promise<unknown>(resolve => {
    void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, sender, resolve);
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const sender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
    const opened = await ask({ type: 'openPopup', id: '0:2' }, sender);
    assert.deepEqual(opened, { ok: true });
    assert.deepEqual(calls, [{ windowId: tab.windowId }]);
    assert.equal(setPopup.mock.calls.length, 0);
    const page = await ask({ type: 'read' }, sender) as { selectedId?: string; media?: Array<{ id: string; title: string }> };
    assert.equal(page.selectedId, '0:2');
    assert.equal(page.media?.find(item => item.id === '0:2')?.title, '正片');

    openPopup.mock.mockImplementation(async () => { throw new Error('Failed to open popup'); });
    const failed = await ask({ type: 'openPopup', id: '0:2' }, sender);
    assert.deepEqual(failed, { ok: false });
    assert.equal(setPopup.mock.calls.length, 0);

    const before = calls.length;
    const extensionPage = { id: fakeBrowser.runtime.id, url: `chrome-extension://${fakeBrowser.runtime.id}/popup.html` };
    const denied = await ask({ type: 'openPopup', id: '0:1' }, extensionPage);
    assert.deepEqual(denied, { ok: false });
    assert.equal(calls.length, before);
    const still = await ask({ type: 'read' }, sender) as { selectedId?: string };
    assert.equal(still.selectedId, '0:2');

    const action = fakeBrowser.action as { openPopup?: unknown };
    const saved = action.openPopup;
    action.openPopup = undefined;
    const missing = await ask({ type: 'openPopup', id: '0:2' }, sender);
    action.openPopup = saved;
    assert.deepEqual(missing, { ok: false });
    assert.equal(calls.length, before);
  } finally {
    openPopup.mock.restore();
    setPopup.mock.restore();
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
