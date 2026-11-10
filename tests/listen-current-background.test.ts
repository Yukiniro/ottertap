import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { muteBatchKey } from '../lib/mute-batch';

type Row = { id: number; title: string; audible: boolean; muted: boolean; reason?: string; extensionId?: string };
type Entry = { tabId: number; previousMuted: boolean; writtenMuted: boolean };

test('只听当前复用静音批次，失败不覆盖，撤销只恢复仍能归属的前态', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  fakeBrowser.i18n.getMessage = (name: string) => name;
  const extensionId = fakeBrowser.runtime.id;
  const rows = new Map<number, Row>();
  const put = (row: Row) => rows.set(row.id, row);
  const failing = new Set<number>();
  const bare = new Set<number>();
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
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async () => ({ ok: true }));
  const query = mock.method(fakeBrowser.tabs, 'query', async (info: { audible?: boolean; muted?: boolean }) => {
    return [...rows.values()].filter(row => info.audible ? row.audible : info.muted ? row.muted : false).map(snapshot);
  });
  const get = mock.method(fakeBrowser.tabs, 'get', async (id: number) => {
    const row = rows.get(id);
    if (!row) throw new Error('no tab');
    return snapshot(row);
  });
  const update = mock.method(fakeBrowser.tabs, 'update', async (id: number, props: { muted?: boolean }) => {
    if (props.muted === undefined) return snapshot(rows.get(id)!);
    updates.push({ id, muted: props.muted });
    if (failing.has(id)) throw new Error('mute failed');
    const row = rows.get(id);
    if (!row) throw new Error('no tab');
    row.muted = props.muted;
    if (bare.has(id)) { row.reason = undefined; row.extensionId = undefined; }
    else { row.reason = 'extension'; row.extensionId = extensionId; }
    return snapshot(row);
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const page = { id: fakeBrowser.runtime.id, url: fakeBrowser.runtime.getURL('/popup.html') };
    const request = (message: object, sender: object = page) => new Promise<Record<string, unknown>>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, sender, resolve);
    });
    const batch = async () => (await fakeBrowser.storage.session.get(muteBatchKey))[muteBatchKey] as { entries?: Entry[] } | undefined;
    const entries = async () => (await batch())?.entries ?? [];
    put({ id: 7, title: '当前', audible: true, muted: false });
    put({ id: 8, title: '音乐', audible: true, muted: false });
    put({ id: 9, title: '原来就静音', audible: false, muted: true, reason: 'user' });

    const heard = await request({ type: 'listenCurrent', tabId: 7 });
    assert.strictEqual(heard.failed, false);
    assert.strictEqual(heard.unavailable, false);
    assert.strictEqual(heard.undo, true);
    assert.deepEqual(updates, [{ id: 8, muted: true }]);
    assert.deepEqual(await entries(), [{ tabId: 8, previousMuted: false, writtenMuted: true }]);
    assert.strictEqual(rows.get(7)?.muted, false);
    assert.strictEqual(rows.get(9)?.reason, 'user');
    assert.strictEqual((await request({ type: 'soundingTabs', tabId: 7 })).currentMuted, false);

    updates.length = 0;
    const idle = await request({ type: 'listenCurrent', tabId: 7 });
    assert.strictEqual(idle.failed, false);
    assert.strictEqual(idle.unavailable, true);
    assert.strictEqual(idle.undo, true);
    assert.strictEqual(updates.length, 0);
    assert.deepEqual(await entries(), [{ tabId: 8, previousMuted: false, writtenMuted: true }]);

    rows.get(7)!.muted = true;
    rows.get(7)!.reason = 'user';
    put({ id: 10, title: '会议', audible: true, muted: false });
    updates.length = 0;
    const withCurrent = await request({ type: 'listenCurrent', tabId: 7 });
    assert.strictEqual(withCurrent.failed, false);
    assert.strictEqual(withCurrent.undo, true);
    assert.deepEqual(updates.map(item => item.id), [7, 10]);
    assert.strictEqual(rows.get(7)?.muted, false);
    assert.strictEqual(rows.get(9)?.muted, true);
    assert.deepEqual(await entries(), [
      { tabId: 7, previousMuted: true, writtenMuted: false },
      { tabId: 10, previousMuted: false, writtenMuted: true },
    ]);

    updates.length = 0;
    const restored = await request({ type: 'undoMuteOthers', tabId: 7 });
    assert.strictEqual(restored.status, 'restored');
    assert.deepEqual(updates, [{ id: 7, muted: true }, { id: 10, muted: false }]);
    assert.strictEqual(rows.get(7)?.muted, true);
    assert.strictEqual(rows.get(8)?.muted, true);
    assert.strictEqual(rows.get(9)?.muted, true);
    assert.deepEqual(await entries(), []);

    rows.get(7)!.muted = true;
    rows.get(7)!.reason = 'user';
    rows.get(7)!.extensionId = undefined;
    rows.get(10)!.muted = false;
    rows.get(10)!.reason = undefined;
    rows.get(10)!.extensionId = undefined;
    put({ id: 14, title: '保留', audible: true, muted: false });
    updates.length = 0;
    const again = await request({ type: 'listenCurrent', tabId: 7 });
    assert.strictEqual(again.failed, false);
    assert.deepEqual((await entries()).map(entry => entry.tabId), [7, 10, 14]);
    rows.get(7)!.muted = true;
    rows.get(7)!.reason = 'user';
    rows.get(7)!.extensionId = undefined;
    updates.length = 0;
    const skippedCurrent = await request({ type: 'undoMuteOthers', tabId: 7 });
    assert.strictEqual(skippedCurrent.status, 'restored');
    assert.deepEqual(updates.map(item => item.id).sort((a, b) => a - b), [10, 14]);
    assert.strictEqual(rows.get(7)?.muted, true);
    assert.strictEqual(rows.get(10)?.muted, false);
    assert.strictEqual(rows.get(14)?.muted, false);

    rows.get(7)!.muted = true;
    rows.get(10)!.muted = false;
    rows.get(14)!.muted = true;
    put({ id: 11, title: '会失败', audible: true, muted: false });
    failing.add(11);
    updates.length = 0;
    const broke = await request({ type: 'listenCurrent', tabId: 7 });
    assert.strictEqual(broke.failed, true);
    assert.strictEqual(broke.unavailable, false);
    assert.strictEqual(rows.get(11)?.muted, false);
    assert.strictEqual(rows.get(7)?.muted, false);
    assert.deepEqual((await entries()).map(entry => entry.tabId).sort((a, b) => a - b), [7, 10]);
    const partial = await entries();
    failing.delete(11);

    rows.get(7)!.muted = true;
    rows.get(11)!.muted = true;
    put({ id: 12, title: '也会失败', audible: true, muted: false });
    failing.add(7);
    failing.add(12);
    updates.length = 0;
    const allFailed = await request({ type: 'listenCurrent', tabId: 7 });
    assert.strictEqual(allFailed.failed, true);
    assert.strictEqual(allFailed.undo, true);
    assert.deepEqual(await entries(), partial);
    assert.strictEqual(rows.get(7)?.muted, true);
    assert.strictEqual(rows.get(12)?.muted, false);
    failing.delete(7);
    failing.delete(12);

    bare.add(7);
    updates.length = 0;
    const unclear = await request({ type: 'listenCurrent', tabId: 7 });
    assert.strictEqual(unclear.failed, false);
    assert.strictEqual(rows.get(7)?.muted, false);
    assert.strictEqual(rows.get(7)?.reason, undefined);
    assert.strictEqual((await entries()).some(entry => entry.tabId === 7), false);
    assert.strictEqual((await entries()).some(entry => entry.tabId === 12), true);
    bare.delete(7);

    const recorded = (await entries()).find(entry => entry.tabId === 12);
    assert.ok(recorded);
    rows.get(12)!.reason = 'user';
    rows.get(12)!.extensionId = undefined;
    updates.length = 0;
    const later = await request({ type: 'undoMuteOthers', tabId: 7 });
    assert.strictEqual(later.status, 'unavailable');
    assert.strictEqual(updates.length, 0);
    assert.strictEqual(rows.get(12)?.muted, true);
    assert.deepEqual(await entries(), []);

    const local = await fakeBrowser.storage.local.get(null);
    assert.strictEqual(Object.keys(local).includes(muteBatchKey), false);
    const blocked = await request({ type: 'listenCurrent', tabId: 7 }, { id: fakeBrowser.runtime.id, url: 'https://example.com/watch', tab: { id: 7 } });
    assert.strictEqual(typeof blocked.error, 'string');
  } finally {
    query.mock.restore();
    sendMessage.mock.restore();
    get.mock.restore();
    update.mock.restore();
    fakeBrowser.reset();
  }
});
