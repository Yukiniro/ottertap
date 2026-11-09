import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { autoMuteClockKey } from '../lib/auto-mute';
import { muteBatchKey } from '../lib/mute-batch';
import { defaultSettings } from '../lib/types';

const settingsKey = 'ottertap-settings-v1';

type Row = { id: number; title: string; audible: boolean; muted: boolean; active: boolean; volume: number; reason?: string; extensionId?: string };
type Entry = { tabId: number; previousMuted: boolean; writtenMuted: boolean };

test('活动标签上小獭控制的媒体开始播放时静音其他，空目标和失败不记成功，冷却挡住自动但不挡住手动', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  fakeBrowser.i18n.getMessage = (name: string) => name;
  const extensionId = fakeBrowser.runtime.id;
  let now = 1_700_000_000_000;
  const dateNow = mock.method(Date, 'now', () => now);
  const rows = new Map<number, Row>();
  const put = (row: Row) => rows.set(row.id, row);
  const failing = new Set<number>();
  let windows = [{ id: 3, focused: true }];
  const updates: Array<{ id: number; muted?: boolean; volume?: number }> = [];
  const snapshot = (row: Row) => ({
    id: row.id,
    windowId: 3,
    active: row.active,
    url: 'https://example.com/watch',
    title: row.title,
    audible: row.audible,
    mutedInfo: {
      muted: row.muted,
      ...(row.reason ? { reason: row.reason } : {}),
      ...(row.extensionId ? { extensionId: row.extensionId } : {}),
    },
  });
  const query = mock.method(fakeBrowser.tabs, 'query', async (info: { audible?: boolean; muted?: boolean }) => {
    return [...rows.values()].filter(row => info.audible ? row.audible : info.muted ? row.muted : false).map(snapshot);
  });
  const get = mock.method(fakeBrowser.tabs, 'get', async (id: number) => {
    const row = rows.get(id);
    if (!row) throw new Error('no tab');
    return snapshot(row);
  });
  const update = mock.method(fakeBrowser.tabs, 'update', async (id: number, props: { muted?: boolean }) => {
    updates.push({ id, muted: props.muted });
    if (failing.has(id)) throw new Error('mute failed');
    const row = rows.get(id);
    if (!row) throw new Error('no tab');
    if (props.muted !== undefined) {
      row.muted = props.muted;
      row.reason = 'extension';
      row.extensionId = extensionId;
    }
    return snapshot(row);
  });
  const getAllWindows = mock.method(fakeBrowser.windows, 'getAll', async () => windows.map(item => ({ ...item })));
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, message: { type?: string }) => {
    if (message?.type !== 'snapshot') return {};
    return {
      media: [{
        id: '1', title: '片', label: '片', host: 'example.com', kind: 'video',
        paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1,
        currentTime: 1, duration: 10, live: false, seekable: [], pip: false,
        pipAvailable: false, pipBlock: '', channel: 'stereo',
      }],
    };
  });
  try {
    await fakeBrowser.storage.local.set({ [settingsKey]: { ...defaultSettings, autoMuteOthers: false } });
    const background = await import('../entrypoints/background');
    background.default.main();
    const page = { id: extensionId, url: fakeBrowser.runtime.getURL('/popup.html') };
    const content = (tabId: number, frameId = 0) => ({
      id: extensionId,
      url: 'https://example.com/watch',
      tab: { id: tabId, windowId: 3, active: true, url: 'https://example.com/watch' },
      frameId,
    });
    const request = (message: object, sender: object) => new Promise<Record<string, unknown>>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, sender, resolve);
    });
    const batch = async () => (await fakeBrowser.storage.session.get(muteBatchKey))[muteBatchKey] as { entries?: Entry[] } | undefined;
    const clock = async () => (await fakeBrowser.storage.session.get(autoMuteClockKey))[autoMuteClockKey] as { until?: number } | undefined;
    const entries = async () => (await batch())?.entries ?? [];
    put({ id: 7, title: '当前', audible: false, muted: false, active: true, volume: 1 });
    put({ id: 8, title: '音乐', audible: true, muted: false, active: false, volume: 1 });

    await request({ type: 'playing', id: '1' }, content(7));
    const off = await request({ type: 'autoMute', id: '1' }, content(7));
    assert.strictEqual(off.ok, true);
    assert.strictEqual(updates.length, 0);
    assert.deepEqual(await entries(), []);
    assert.strictEqual(await clock(), undefined);
    const idleUndo = await request({ type: 'undoMuteOthers', tabId: 7 }, page);
    assert.strictEqual(idleUndo.status, 'unavailable');
    assert.strictEqual(await clock(), undefined, '没有批次的撤销不设冷却');

    await fakeBrowser.storage.local.set({ [settingsKey]: { ...defaultSettings, autoMuteOthers: true } });
    rows.get(7)!.active = false;
    const inactive = await request({ type: 'autoMute', id: '1' }, content(7));
    assert.strictEqual(inactive.ok, true);
    assert.strictEqual(updates.length, 0, '后台标签不触发');
    rows.get(7)!.active = true;
    windows = [{ id: 3, focused: false }, { id: 4, focused: true }];
    const blurred = await request({ type: 'autoMute', id: '1' }, content(7));
    assert.strictEqual(blurred.ok, true);
    assert.strictEqual(updates.length, 0, '另一个窗口在前台时，这个窗口不触发');
    windows = [{ id: 3, focused: true }];

    const otherMedia = await request({ type: 'autoMute', id: '2' }, content(7));
    assert.strictEqual(otherMedia.ok, true);
    assert.strictEqual(updates.length, 0, '不是当前控制的媒体');

    rows.get(8)!.audible = false;
    const empty = await request({ type: 'autoMute', id: '1' }, content(7));
    assert.strictEqual(empty.ok, true);
    assert.deepEqual(await entries(), []);
    assert.strictEqual(await clock(), undefined, '没有目标不算成功');
    assert.strictEqual(rows.get(7)?.volume, 1);
    rows.get(8)!.audible = true;

    failing.add(8);
    const failed = await request({ type: 'autoMute', id: '1' }, content(7));
    assert.strictEqual(failed.ok, true);
    assert.deepEqual(await entries(), [], '全部失败不替换批次');
    assert.strictEqual(await clock(), undefined);
    assert.strictEqual(rows.get(8)?.muted, false);
    failing.delete(8);
    updates.length = 0;

    const heard = await request({ type: 'autoMute', id: '1' }, content(7));
    assert.strictEqual(heard.ok, true);
    assert.deepEqual(updates, [{ id: 8, muted: true }]);
    assert.deepEqual(await entries(), [{ tabId: 8, previousMuted: false, writtenMuted: true }]);
    assert.strictEqual(rows.get(7)?.muted, false);
    assert.strictEqual(rows.get(7)?.volume, 1);
    const until = (await clock())?.until;
    assert.strictEqual(until, now + 5_000);

    put({ id: 15, title: '第二段', audible: true, muted: false, active: false, volume: 1 });
    updates.length = 0;
    const again = await request({ type: 'autoMute', id: '1' }, content(7));
    const fromFrame = await request({ type: 'autoMute', id: '9' }, content(7, 1));
    assert.strictEqual(again.ok, true);
    assert.strictEqual(fromFrame.ok, true);
    assert.strictEqual(updates.length, 0, '同一次开始的重复事件和别的 frame 不再静音');
    assert.strictEqual(rows.get(15)?.muted, false);

    now = until! - 1;
    const held = await request({ type: 'autoMute', id: '1' }, content(7));
    assert.strictEqual(held.ok, true);
    assert.strictEqual(updates.length, 0, '5 秒内不重复自动静音');
    now = until!;
    rows.get(8)!.muted = false;
    rows.get(8)!.audible = true;
    const boundary = await request({ type: 'autoMute', id: '1' }, content(7));
    assert.strictEqual(boundary.ok, true);
    assert.deepEqual(updates.map(item => item.id), [8, 15]);
    const refreshed = (await clock())?.until;
    assert.strictEqual(refreshed, now + 5_000);

    now += 10;
    updates.length = 0;
    const restored = await request({ type: 'undoMuteOthers', tabId: 7 }, page);
    assert.strictEqual(restored.status, 'restored');
    assert.strictEqual(rows.get(8)?.muted, false);
    assert.strictEqual(rows.get(15)?.muted, false);
    const afterUndoUntil = (await clock())?.until;
    assert.strictEqual(afterUndoUntil, now + 5_000, '撤销把自动静音再拦住 5 秒');
    assert.notStrictEqual(afterUndoUntil, refreshed);
    rows.get(8)!.audible = false;
    rows.get(15)!.audible = false;
    put({ id: 16, title: '撤销后', audible: true, muted: false, active: false, volume: 1 });
    updates.length = 0;
    now += 4_999;
    const afterUndo = await request({ type: 'autoMute', id: '1' }, content(7));
    assert.strictEqual(afterUndo.ok, true);
    assert.strictEqual(updates.length, 0, '撤销后的 5 秒内不自动重静音');
    const manual = await request({ type: 'muteOthers', tabId: 7 }, page);
    assert.strictEqual(manual.failed, false);
    assert.deepEqual(updates, [{ id: 16, muted: true }]);
    assert.strictEqual((await clock())?.until, afterUndoUntil, '手动静音其他不改自动冷却');

    updates.length = 0;
    const undone = await request({ type: 'undoMuteOthers', tabId: 7 }, page);
    assert.strictEqual(undone.status, 'restored');
    assert.strictEqual(rows.get(16)?.muted, false);
    const beforePage = updates.length;
    const pageSender = await request({ type: 'autoMute', id: '1' }, page);
    assert.strictEqual(pageSender.ok, true);
    assert.strictEqual(updates.length, beforePage, '扩展页自己发的自动静音不执行');
    assert.strictEqual(rows.get(16)?.muted, false);

    for (const row of rows.values()) row.audible = false;
    now = ((await clock())?.until ?? now);
    put({ id: 17, title: '多 frame', audible: true, muted: false, active: false, volume: 1 });
    updates.length = 0;
    await Promise.all([
      request({ type: 'autoMute', id: '1' }, content(7, 0)),
      request({ type: 'autoMute', id: '2' }, content(7, 1)),
    ]);
    assert.deepEqual(updates, [{ id: 17, muted: true }], '多个 frame 只记一批');
    assert.strictEqual((await entries()).length, 1);

    updates.length = 0;
    await request({ type: 'undoMuteOthers', tabId: 7 }, page);
    for (const row of rows.values()) row.audible = false;
    now = (await clock())?.until ?? now;
    put({ id: 21, title: '未选中', audible: false, muted: false, active: true, volume: 1 });
    await request({ type: 'register' }, content(21));
    put({ id: 22, title: '未选中旁的音乐', audible: true, muted: false, active: false, volume: 1 });
    updates.length = 0;
    const picked = await request({ type: 'autoMute', id: '1' }, content(21));
    assert.strictEqual(picked.ok, true);
    assert.deepEqual(updates, [{ id: 22, muted: true }], '还没有选中时，小獭会控制的那一条才触发');
    updates.length = 0;
    rows.get(22)!.muted = false;
    rows.get(22)!.audible = true;
    now = (await clock())?.until ?? now;
    const wrong = await request({ type: 'autoMute', id: '2' }, content(21));
    assert.strictEqual(wrong.ok, true);
    assert.strictEqual(updates.length, 0, '对不上小獭会控制的媒体时不静音');
    assert.strictEqual(rows.get(21)?.muted, false);

    for (const row of rows.values()) row.audible = false;
    now = (await clock())?.until ?? now;
    windows = [{ id: 3, focused: false }];
    put({ id: 23, title: '无焦点窗口旁的音乐', audible: true, muted: false, active: false, volume: 1 });
    updates.length = 0;
    const headless = await request({ type: 'autoMute', id: '1' }, content(7));
    assert.strictEqual(headless.ok, true);
    assert.deepEqual(updates, [{ id: 23, muted: true }], '没有聚焦窗口时，活动标签仍算当前');
  } finally {
    dateNow.mock.restore();
    query.mock.restore();
    get.mock.restore();
    update.mock.restore();
    getAllWindows.mock.restore();
    sendMessage.mock.restore();
    fakeBrowser.reset();
  }
});
