import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { autoMuteClockKey } from '../lib/auto-mute';
import { defaultSettings } from '../lib/types';

const settingsKey = 'ottertap-settings-v1';
type Row = { id: number; audible: boolean; muted: boolean; active: boolean; reason?: string; extensionId?: string };
type Sent = { tabId: number; type?: string; key?: string };

test('面板和自动路径只在真实成功后给出短提示，空批次、无目标和失败不显示成功，自动失败提示按 5 秒去重', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  fakeBrowser.i18n.getMessage = (name: string) => name;
  const extensionId = fakeBrowser.runtime.id;
  let now = 1_700_000_000_000;
  const dateNow = mock.method(Date, 'now', () => now);
  const rows = new Map<number, Row>();
  const put = (row: Row) => rows.set(row.id, row);
  const failing = new Set<number>();
  const sent: Sent[] = [];
  const snapshot = (row: Row) => ({
    id: row.id,
    windowId: 3,
    active: row.active,
    url: 'https://example.com/watch',
    title: `tab ${row.id}`,
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
    if (failing.has(id)) throw new Error('mute failed');
    const row = rows.get(id);
    if (!row) throw new Error('no tab');
    if (props.muted !== undefined) {
      row.muted = props.muted;
      row.audible = !props.muted;
      row.reason = 'extension';
      row.extensionId = extensionId;
    }
    return snapshot(row);
  });
  const getAllWindows = mock.method(fakeBrowser.windows, 'getAll', async () => [{ id: 3, focused: true }]);
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (tabId: number, message: { type?: string; key?: string }) => {
    if (message?.type === 'actionHint') sent.push({ tabId, type: message.type, key: message.key });
    if (message?.type !== 'snapshot') return { ok: true };
    return {
      media: [{
        id: '1', title: '片', label: '片', host: 'example.com', kind: 'video',
        paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1,
        currentTime: 1, duration: 10, live: false, seekable: [], pip: false,
        pipAvailable: false, pipBlock: '', channel: 'stereo',
      }],
    };
  });
  const hints = () => sent.map(item => `${item.tabId}:${item.key}`);
  try {
    await fakeBrowser.storage.local.set({ [settingsKey]: { ...defaultSettings, autoMuteOthers: false } });
    const background = await import('../entrypoints/background');
    background.default.main();
    const page = { id: extensionId, url: fakeBrowser.runtime.getURL('/popup.html') };
    const content = (tabId: number) => ({
      id: extensionId,
      url: 'https://example.com/watch',
      tab: { id: tabId, windowId: 3, active: true, url: 'https://example.com/watch' },
      frameId: 0,
    });
    const request = (message: object, sender: object) => new Promise<Record<string, unknown>>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, sender, resolve);
    });
    const clock = async () => (await fakeBrowser.storage.session.get(autoMuteClockKey))[autoMuteClockKey] as { until?: number } | undefined;
    put({ id: 7, audible: true, muted: false, active: true });

    await request({ type: 'muteOthers', tabId: 7 }, page);
    await request({ type: 'listenCurrent', tabId: 7 }, page);
    await request({ type: 'undoMuteOthers', tabId: 7 }, page);
    assert.deepEqual(hints(), [], '没有其他发声标签、没有记录时，三个面板动作都不显示成功');

    put({ id: 8, audible: true, muted: false, active: false });
    put({ id: 9, audible: false, muted: true, active: false, reason: 'user' });
    const muted = await request({ type: 'muteOthers', tabId: 7 }, page);
    assert.strictEqual(muted.failed, false);
    assert.deepEqual(hints(), ['7:muteOthersHint'], '面板静音其他成功后在来源页提示');

    await request({ type: 'muteOthers', tabId: 7 }, page);
    assert.deepEqual(hints(), ['7:muteOthersHint'], '没有新静音的重复点击不再提示');

    await request({ type: 'undoMuteOthers', tabId: 7 }, page);
    assert.deepEqual(hints().slice(-1), ['7:undoMuteOthersHint'], '撤销成功后提示');
    await request({ type: 'undoMuteOthers', tabId: 7 }, page);
    assert.strictEqual(hints().length, 2, '没有记录时再撤销不显示成功');

    await request({ type: 'listenCurrent', tabId: 7 }, page);
    assert.deepEqual(hints().slice(-1), ['7:listenCurrentHint'], '面板只听当前成功后提示');
    await request({ type: 'undoMuteOthers', tabId: 7 }, page);

    sent.length = 0;
    failing.add(8);
    const failed = await request({ type: 'listenCurrent', tabId: 7 }, page);
    assert.strictEqual(failed.failed, true);
    const failedMute = await request({ type: 'muteOthers', tabId: 7 }, page);
    assert.strictEqual(failedMute.failed, true);
    assert.deepEqual(hints(), [], '失败由面板自己说明，页面不显示成功');
    failing.delete(8);

    const noTab = await request({ type: 'muteOthers' }, page);
    assert.strictEqual(noTab.failed, false);
    assert.deepEqual(hints(), [], '没有来源标签时不发提示');
    await request({ type: 'undoMuteOthers', tabId: 7 }, page);
    sent.length = 0;

    for (const row of rows.values()) { row.muted = false; row.audible = false; row.reason = undefined; row.extensionId = undefined; }
    await fakeBrowser.storage.local.set({ [settingsKey]: { ...defaultSettings, autoMuteOthers: true } });
    await request({ type: 'playing', id: '1' }, content(7));

    const undoHold = (await clock())?.until;
    now = (undoHold ?? now) + 1;
    await request({ type: 'autoMute', id: '1' }, content(7));
    assert.deepEqual(hints(), [], '自动没有目标时不显示成功，也不起冷却');
    assert.strictEqual((await clock())?.until, undoHold);

    put({ id: 10, audible: true, muted: false, active: false });
    await request({ type: 'autoMute', id: '1' }, content(7));
    assert.deepEqual(hints(), ['7:muteOthersHint'], '自动静音成功后提示');
    const until = (await clock())?.until;
    assert.strictEqual(until, now + 5_000);

    put({ id: 11, audible: true, muted: false, active: false });
    now += 1_000;
    await request({ type: 'autoMute', id: '1' }, content(7));
    await request({ type: 'autoMute', id: '1' }, content(7));
    assert.deepEqual(hints(), ['7:muteOthersHint'], '冷却内的重复事件不再静音也不再提示');

    now = until!;
    await request({ type: 'autoMute', id: '1' }, content(7));
    assert.strictEqual(hints().length, 2, '冷却结束后下一次真实成功可以再提示');
    await request({ type: 'undoMuteOthers', tabId: 7 }, page);
    assert.deepEqual(hints().slice(-1), ['7:undoMuteOthersHint']);

    sent.length = 0;
    for (const row of rows.values()) { row.muted = false; row.audible = false; row.reason = undefined; row.extensionId = undefined; }
    const before = (await clock())?.until;
    now = before ?? now;
    put({ id: 12, audible: true, muted: false, active: false });
    failing.add(12);
    await request({ type: 'autoMute', id: '1' }, content(7));
    assert.deepEqual(hints(), ['7:muteOthersFailed'], '自动失败用现有短说明');
    assert.strictEqual((await clock())?.until, before, '失败不起冷却');
    now += 4_999;
    await request({ type: 'autoMute', id: '1' }, content(7));
    await request({ type: 'autoMute', id: '1' }, content(7));
    assert.strictEqual(hints().length, 1, '5 秒内重复失败不刷屏');
    now += 1;
    await request({ type: 'autoMute', id: '1' }, content(7));
    assert.deepEqual(hints(), ['7:muteOthersFailed', '7:muteOthersFailed'], '过了 5 秒可以再说明一次');
    assert.ok(!hints().includes('7:muteOthersHint'), '失败不会被说成成功');
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
