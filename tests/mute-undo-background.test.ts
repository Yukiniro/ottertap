import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { muteBatchKey } from '../lib/mute-batch';

type Row = { id: number; title: string; audible: boolean; muted: boolean; reason?: string; extensionId?: string };

test('后台只记住这次真正静音的标签，撤销时不碰归属不明或后来改过的标签', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  fakeBrowser.i18n.getMessage = (name: string) => name;
  const extensionId = fakeBrowser.runtime.id;
  const rows = new Map<number, Row>();
  const put = (row: Row) => rows.set(row.id, row);
  put({ id: 7, title: '当前', audible: true, muted: true, reason: 'extension', extensionId });
  const failing = new Set<number>();
  const bare = new Set<number>();
  const closed = new Set<number>();
  const updates: Array<{ id: number; muted: boolean }> = [];
  const snapshot = (row: Row) => ({
    id: row.id,
    windowId: 3,
    title: row.title,
    audible: row.audible,
    mutedInfo: {
      muted: row.muted,
      ...(row.reason ? { reason: row.reason } : {}),
      ...(row.extensionId ? { extensionId: row.extensionId } : {}),
    },
  });
  const query = mock.method(fakeBrowser.tabs, 'query', async (info: { audible?: boolean; muted?: boolean }) => {
    return [...rows.values()].filter(row => !closed.has(row.id) && (info.audible ? row.audible : info.muted ? row.muted : false)).map(snapshot);
  });
  const get = mock.method(fakeBrowser.tabs, 'get', async (id: number) => {
    const row = rows.get(id);
    if (!row || closed.has(id)) throw new Error('no tab');
    return snapshot(row);
  });
  const update = mock.method(fakeBrowser.tabs, 'update', async (id: number, props: { muted?: boolean }) => {
    if (props.muted === undefined) return snapshot(rows.get(id)!);
    updates.push({ id, muted: props.muted });
    if (failing.has(id)) throw new Error('mute failed');
    const row = rows.get(id);
    if (!row || closed.has(id)) throw new Error('no tab');
    row.muted = props.muted;
    if (bare.has(id)) { row.reason = undefined; row.extensionId = undefined; }
    else { row.reason = 'extension'; row.extensionId = extensionId; }
    return snapshot(row);
  });
  await fakeBrowser.storage.session.set({
    [muteBatchKey]: { entries: [{ tabId: 7, previousMuted: false, writtenMuted: true }] },
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const page = { id: fakeBrowser.runtime.id, url: fakeBrowser.runtime.getURL('/popup.html') };
    const request = (message: object, sender: object = page) => new Promise<Record<string, unknown>>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, sender, resolve);
    });
    const batch = async () => (await fakeBrowser.storage.session.get(muteBatchKey))[muteBatchKey] as { entries?: Array<{ tabId: number }> } | undefined;
    const ids = async () => ((await batch())?.entries ?? []).map(entry => entry.tabId);
    const flush = async () => { for (let step = 0; step < 6; step += 1) await new Promise(resolve => setTimeout(resolve, 0)); };

    const skippedCurrent = await request({ type: 'undoMuteOthers', tabId: 7 });
    assert.strictEqual(skippedCurrent.status, 'unavailable');
    assert.strictEqual(updates.length, 0);
    assert.deepEqual(await ids(), []);
    assert.strictEqual((await request({ type: 'soundingTabs', tabId: 7 })).undo, false);

    put({ id: 8, title: '音乐', audible: true, muted: false });
    put({ id: 9, title: '原来就静音', audible: false, muted: true, reason: 'user' });
    put({ id: 10, title: '会议', audible: true, muted: false });
    put({ id: 12, title: '没有归属', audible: true, muted: false });
    bare.add(12);
    const muted = await request({ type: 'muteOthers', tabId: 7 });
    assert.strictEqual(muted.failed, false);
    assert.strictEqual(muted.undo, true);
    assert.deepEqual(updates.map(item => item.id).sort((a, b) => a - b), [8, 9, 10, 12]);
    assert.ok(updates.every(item => item.muted === true));
    assert.deepEqual(await ids(), [8, 10]);
    assert.strictEqual(rows.get(9)?.reason, 'extension');
    assert.strictEqual(rows.get(12)?.muted, true);
    assert.strictEqual(rows.get(7)?.muted, true);
    const remembered = await ids();

    updates.length = 0;
    const again = await request({ type: 'muteOthers', tabId: 7 });
    assert.strictEqual(again.failed, false);
    assert.strictEqual(again.undo, true);
    assert.deepEqual(await ids(), remembered);
    assert.ok(updates.every(item => rows.get(item.id)?.muted === true));

    put({ id: 11, title: '失败', audible: true, muted: false });
    failing.add(11);
    const broke = await request({ type: 'muteOthers', tabId: 7 });
    assert.strictEqual(broke.failed, true);
    assert.deepEqual(await ids(), remembered);
    assert.strictEqual(rows.get(11)?.muted, false);

    rows.get(8)!.muted = false;
    put({ id: 13, title: '新的', audible: true, muted: false });
    const replaced = await request({ type: 'muteOthers', tabId: 7 });
    assert.strictEqual(replaced.undo, true);
    assert.deepEqual(await ids(), [8, 13]);

    await fakeBrowser.tabs.onUpdated.trigger(8, { mutedInfo: { muted: true, reason: 'extension', extensionId } }, snapshot(rows.get(8)!) as never);
    await flush();
    assert.deepEqual(await ids(), [8, 13]);

    rows.get(8)!.muted = false;
    rows.get(8)!.reason = 'user';
    rows.get(8)!.extensionId = undefined;
    await fakeBrowser.tabs.onUpdated.trigger(8, { mutedInfo: { muted: false, reason: 'user' } }, snapshot(rows.get(8)!) as never);
    await flush();
    assert.deepEqual(await ids(), [13]);
    rows.get(8)!.muted = true;
    rows.get(8)!.reason = 'extension';
    rows.get(8)!.extensionId = extensionId;

    rows.get(13)!.reason = 'user';
    rows.get(13)!.extensionId = undefined;
    updates.length = 0;
    const undone = await request({ type: 'undoMuteOthers', tabId: 7 });
    assert.strictEqual(undone.status, 'unavailable');
    assert.strictEqual(updates.length, 0);
    assert.strictEqual(rows.get(8)?.muted, true);
    assert.strictEqual(rows.get(9)?.muted, true);
    assert.strictEqual(rows.get(13)?.muted, true);
    assert.deepEqual(await ids(), []);
    assert.strictEqual((await request({ type: 'undoMuteOthers', tabId: 7 })).status, 'unavailable');

    rows.get(10)!.muted = false;
    rows.get(10)!.reason = undefined;
    rows.get(10)!.extensionId = undefined;
    const recorded = await request({ type: 'muteOthers', tabId: 7 });
    assert.strictEqual(recorded.undo, true);
    assert.deepEqual(await ids(), [10]);
    closed.add(10);
    updates.length = 0;
    const missing = await request({ type: 'undoMuteOthers', tabId: 7 });
    assert.strictEqual(missing.status, 'unavailable');
    assert.strictEqual(updates.length, 0);
    assert.strictEqual(rows.get(9)?.muted, true);

    rows.get(10)!.muted = false;
    closed.delete(10);
    await request({ type: 'muteOthers', tabId: 7 });
    assert.deepEqual(await ids(), [10]);
    failing.add(10);
    updates.length = 0;
    const restoreFailed = await request({ type: 'undoMuteOthers', tabId: 7 });
    assert.strictEqual(restoreFailed.status, 'failed');
    assert.deepEqual(updates, [{ id: 10, muted: false }]);
    assert.strictEqual(rows.get(10)?.muted, true);
    assert.deepEqual(await ids(), []);
    failing.delete(10);
    updates.length = 0;
    assert.strictEqual((await request({ type: 'undoMuteOthers', tabId: 7 })).status, 'unavailable');
    assert.strictEqual(updates.length, 0);

    const local = await fakeBrowser.storage.local.get(null);
    assert.strictEqual(Object.keys(local).includes(muteBatchKey), false);
    const blocked = await request({ type: 'muteOthers', tabId: 7 }, { id: fakeBrowser.runtime.id, url: 'https://example.com/watch', tab: { id: 7 } });
    assert.strictEqual(typeof blocked.error, 'string');
  } finally {
    query.mock.restore();
    get.mock.restore();
    update.mock.restore();
    fakeBrowser.reset();
  }
});
