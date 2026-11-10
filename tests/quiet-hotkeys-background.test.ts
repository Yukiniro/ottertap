import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { muteBatchKey } from '../lib/mute-batch';
import { defaultSettings } from '../lib/types';

const settingsKey = 'ottertap-settings-v1';
type Row = { id: number; url: string; audible: boolean; muted: boolean; active: boolean; reason?: string; extensionId?: string };
type Entry = { tabId: number; previousMuted: boolean; writtenMuted: boolean };
type Hint = { type?: string; key?: string; tabId?: number };

test('页内键和扩展命令走同一只听当前与撤销，没有明确的当前标签时不动', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const listeners: Array<(command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void> = [];
  const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string, tab?: { id?: number; url?: string }) => Promise<unknown> | void): void } };
  commands.onCommand = { addListener(callback) { listeners.push(callback); } };
  const extensionId = fakeBrowser.runtime.id;
  const rows = new Map<number, Row>();
  const put = (row: Row) => rows.set(row.id, row);
  const failing = new Set<number>();
  const updates: Array<{ id: number; muted: boolean }> = [];
  const sent: Hint[] = [];
  let typing = false;
  const snapshot = (row: Row) => ({
    id: row.id,
    windowId: 3,
    url: row.url,
    active: row.active,
    audible: row.audible,
    mutedInfo: {
      muted: row.muted,
      ...(row.reason ? { reason: row.reason } : {}),
      ...(row.extensionId ? { extensionId: row.extensionId } : {}),
    },
  });
  const query = mock.method(fakeBrowser.tabs, 'query', async (info: { audible?: boolean; muted?: boolean; active?: boolean }) => {
    return [...rows.values()].filter(row => info.audible ? row.audible : info.muted ? row.muted : info.active ? row.active : false).map(snapshot);
  });
  const get = mock.method(fakeBrowser.tabs, 'get', async (id: number) => {
    const row = rows.get(id);
    if (!row) throw new Error('no tab');
    return snapshot(row);
  });
  const update = mock.method(fakeBrowser.tabs, 'update', async (id: number, props: { muted?: boolean }) => {
    const row = rows.get(id);
    if (!row || props.muted === undefined) return snapshot(row!);
    updates.push({ id, muted: props.muted });
    if (failing.has(id)) throw new Error('mute failed');
    row.muted = props.muted;
    row.audible = !props.muted;
    row.reason = 'extension';
    row.extensionId = extensionId;
    return snapshot(row);
  });
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (tabId: number, message: Hint) => {
    sent.push({ ...message, tabId });
    if (message.type === 'snapshot' && tabId === 9) {
      return { typing, media: [{ id: '1', kind: 'video', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1, pip: true }] };
    }
    if (message.type === 'snapshot') return { typing, media: [] };
    return { ok: true };
  });
  const windows = mock.method(fakeBrowser.windows, 'getAll', async () => [{ id: 3, focused: true }]);
  put({ id: 7, url: 'https://example.com/watch', audible: true, muted: false, active: true });
  put({ id: 8, url: 'https://example.com/music', audible: true, muted: false, active: false });
  put({ id: 9, url: 'https://example.com/pip', audible: true, muted: false, active: false });
  const hints = () => sent.filter(item => item.type === 'actionHint').map(item => item.key);
  const batch = async () => ((await fakeBrowser.storage.session.get(muteBatchKey))[muteBatchKey] as { entries?: Entry[] } | undefined)?.entries ?? [];
  const ask = (tabId: number, message: object) => new Promise<{ handled?: boolean }>(resolve => {
    const row = rows.get(tabId);
    const sender = { id: extensionId, tab: { id: tabId, url: row?.url, active: row?.active === true }, frameId: 0 };
    void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, sender as never, resolve);
  });
  const fire = (name: string, tab?: { id?: number; url?: string }) => Promise.all(listeners.map(listener => listener(name, tab)));
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    await ask(9, { type: 'register', present: true });

    await fire('listen-current', { id: 7, url: 'https://example.com/watch' });
    assert.deepEqual(updates.map(item => item.id).sort((a, b) => a - b), [8, 9], '画中画标签不是当前标签，扩展命令仍静音其他出声标签');
    assert.strictEqual(rows.get(7)?.muted, false);
    assert.deepEqual((await batch()).map(entry => entry.tabId).sort((a, b) => a - b), [8, 9]);
    assert.deepEqual(hints(), ['listenCurrentHint'], '真实成功后给出短提示');
    assert.deepEqual(sent.filter(item => item.type === 'actionHint').map(item => item.tabId), [7], '提示留在来源页，不发到画中画所在的标签');

    updates.length = 0;
    assert.deepEqual(await ask(7, { type: 'hotkey', action: { type: 'undoMuteOthers' } }), { handled: true });
    assert.deepEqual(updates.map(item => item.id).sort((a, b) => a - b), [8, 9]);
    assert.strictEqual(rows.get(8)?.muted, false);
    assert.strictEqual(rows.get(9)?.muted, false);
    assert.strictEqual((await batch()).length, 0);
    assert.deepEqual(hints(), ['listenCurrentHint', 'undoMuteOthersHint']);

    updates.length = 0;
    assert.deepEqual(await ask(7, { type: 'hotkey', action: { type: 'listenCurrent' } }), { handled: true });
    assert.deepEqual(updates.map(item => item.id).sort((a, b) => a - b), [8, 9], '页内键和扩展命令静音同一批标签');
    await fire('undo-mute-others', { id: 7, url: 'https://example.com/watch' });
    assert.deepEqual(hints().slice(-2), ['listenCurrentHint', 'undoMuteOthersHint'], '扩展命令同样提示');
    assert.strictEqual(rows.get(8)?.muted, false);
    assert.strictEqual((await batch()).length, 0);

    updates.length = 0;
    rows.get(8)!.audible = false;
    rows.get(8)!.muted = true;
    rows.get(9)!.audible = false;
    rows.get(9)!.muted = true;
    assert.deepEqual(await ask(7, { type: 'hotkey', action: { type: 'listenCurrent' } }), { handled: true });
    assert.strictEqual(updates.length, 0);
    assert.deepEqual(hints().slice(-1), ['listenCurrentUnavailable'], '没有目标不显示成功');
    assert.strictEqual((await batch()).length, 0, '没有目标时不覆盖批次');

    assert.deepEqual(await ask(7, { type: 'hotkey', action: { type: 'undoMuteOthers' } }), { handled: true });
    assert.deepEqual(hints().at(-1), 'undoMuteOthersUnavailable');
    assert.strictEqual(updates.length, 0);

    rows.get(8)!.audible = true;
    rows.get(8)!.muted = false;
    rows.get(8)!.reason = undefined;
    rows.get(8)!.extensionId = undefined;
    failing.add(8);
    const beforeFail = updates.length;
    await fire('listen-current', { id: 7, url: 'https://example.com/watch' });
    assert.strictEqual(rows.get(8)?.muted, false);
    assert.ok(updates.length > beforeFail);
    assert.strictEqual((await batch()).some(entry => entry.tabId === 8), false, '失败的标签不进批次');
    assert.deepEqual(hints().at(-1), 'listenCurrentFailed');
    failing.delete(8);

    typing = true;
    const quiet = updates.length;
    const quietHints = hints().length;
    await fire('listen-current', { id: 7, url: 'https://example.com/watch' });
    await fire('undo-mute-others', { id: 7, url: 'https://example.com/watch' });
    assert.strictEqual(updates.length, quiet, '输入框聚焦时扩展命令不静音也不撤销');
    assert.strictEqual(hints().length, quietHints);
    typing = false;

    const idle = updates.length;
    assert.deepEqual(await ask(8, { type: 'hotkey', action: { type: 'listenCurrent' } }), { handled: false });
    assert.strictEqual(updates.length, idle, '非当前标签的页内键不静音');

    rows.get(7)!.active = false;
    await fire('listen-current');
    assert.strictEqual(updates.length, idle, '没有活动标签时不调用只听当前');
    rows.get(7)!.active = true;
    await fire('listen-current', { id: 4, url: 'chrome://newtab' });
    assert.strictEqual(updates.length, idle, '不是网页的标签不静音');

    const shown = hints().length;
    await fakeBrowser.storage.local.set({ [settingsKey]: { ...defaultSettings, siteMode: 'exclude', sites: ['example.com'] } });
    await new Promise(resolve => setTimeout(resolve, 0));
    await fire('listen-current', { id: 7, url: 'https://example.com/watch' });
    assert.strictEqual(updates.length, idle, '站点被禁用时扩展命令不动');
    assert.strictEqual(hints().length, shown, '站点被禁用时不显示任何提示');
  } finally {
    query.mock.restore();
    get.mock.restore();
    update.mock.restore();
    sendMessage.mock.restore();
    windows.mock.restore();
    fakeBrowser.reset();
  }
});
