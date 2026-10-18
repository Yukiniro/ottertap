import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, mock } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { readFlatMessages } from '../lib/message-catalog';
import { maxEffectiveVolume, shouldReportVolume, volumeBadgeColor, volumeBadgeFromReports, volumeBadgeTtlMs, volumeReportIntervalMs } from '../lib/volume-badge';
import { defaultSettings } from '../lib/types';

const messages = readFlatMessages(readFileSync(new URL('../locales/zh_CN.yml', import.meta.url), 'utf8'));
const storageKey = 'ottertap-settings-v1';

test('超过 100% 出现角标，多 frame 取最大，过期和降回后清除', () => {
  assert.equal(volumeBadgeColor, '#e4572e');
  assert.equal(volumeReportIntervalMs, 1000);
  assert.ok(volumeBadgeTtlMs > volumeReportIntervalMs && volumeBadgeTtlMs <= 5000);
  const now = 10_000;
  const ttl = 3_000;
  assert.equal(volumeBadgeFromReports([{ volume: 1, at: now }, { volume: 0.5, at: now }], now, ttl), null);
  assert.equal(volumeBadgeFromReports([{ volume: 1.004, at: now }], now, ttl), null);
  assert.deepEqual(volumeBadgeFromReports([{ volume: 1.5, at: now }], now, ttl), { text: '150', percent: 150 });
  assert.deepEqual(volumeBadgeFromReports([{ volume: 2, at: now }], now, ttl), { text: '200', percent: 200 });
  assert.deepEqual(volumeBadgeFromReports([{ volume: 1.006, at: now }], now, ttl), { text: '101', percent: 101 });
  assert.deepEqual(volumeBadgeFromReports([
    { volume: 1.2, at: now },
    { volume: 1.8, at: now }
  ], now, ttl), { text: '180', percent: 180 });
  assert.deepEqual(volumeBadgeFromReports([
    { volume: 1.2, at: now },
    { volume: 1.8, at: now - ttl }
  ], now, ttl), { text: '120', percent: 120 });
  assert.equal(volumeBadgeFromReports([
    { volume: 1.5, at: now - ttl },
    { volume: 1.8, at: now - ttl - 1 }
  ], now, ttl), null);
  assert.equal(volumeBadgeFromReports([{ volume: 1, at: now }], now, ttl), null);
  assert.equal(maxEffectiveVolume([
    { volume: 0.4, paused: true },
    { volume: 1.5, paused: true, muted: true },
    { volume: 0.9, paused: false }
  ]), 1.5);
  assert.equal(maxEffectiveVolume([]), 0);
  assert.equal(shouldReportVolume(null, null), null);
  assert.equal(shouldReportVolume(Number.NaN, null), null);
  assert.deepEqual(shouldReportVolume(null, 0.4), { present: false });
  assert.deepEqual(shouldReportVolume(Number.NaN, 1), { present: false });
  assert.deepEqual(shouldReportVolume(0, null), { volume: 0 });
  assert.deepEqual(shouldReportVolume(0.5, null), { volume: 0.5 });
  assert.equal(shouldReportVolume(0.5, 0.5), null);
  assert.equal(shouldReportVolume(1, 1), null);
  assert.deepEqual(shouldReportVolume(0.8, 0.5), { volume: 0.8 });
  assert.deepEqual(shouldReportVolume(1.5, 1.2), { volume: 1.5 });
  assert.deepEqual(shouldReportVolume(1.5, 1.5), { volume: 1.5 });
  assert.deepEqual(shouldReportVolume(1.004, 1.004), { volume: 1.004 });
});

test('后台按标签页和 frame 设置角标，离开页面后清除', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const getMessage = fakeBrowser.i18n.getMessage;
  fakeBrowser.i18n.getMessage = (name: string) => messages[name] ?? '';
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch' });
  const other = await fakeBrowser.tabs.create({ url: 'https://videos.example/a' });
  const tabId = tab.id!;
  const otherId = other.id!;
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const request = (target: typeof tab, frameId: number, message: object) => new Promise<unknown>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, { id: fakeBrowser.runtime.id, tab: target, frameId }, resolve);
    });
    await request(tab, 0, { type: 'register', volume: 1.2 });
    await request(tab, 4, { type: 'register', volume: 1.5 });
    await request(other, 0, { type: 'register', volume: 1.1 });
    assert.equal(await fakeBrowser.action.getBadgeText({ tabId }), '150');
    assert.deepEqual(await fakeBrowser.action.getBadgeBackgroundColor({ tabId }), [0xe4, 0x57, 0x2e, 255]);
    assert.equal(await fakeBrowser.action.getTitle({ tabId }), '音量已放大到 150%');
    assert.equal(await fakeBrowser.action.getBadgeText({ tabId: otherId }), '110');
    await request(tab, 4, { type: 'register', volume: 1 });
    assert.equal(await fakeBrowser.action.getBadgeText({ tabId }), '120');
    assert.equal(await fakeBrowser.action.getBadgeText({ tabId: otherId }), '110');
    await request(tab, 0, { type: 'register', present: false });
    assert.equal(await fakeBrowser.action.getBadgeText({ tabId }), '');
    assert.equal(await fakeBrowser.action.getTitle({ tabId }), '');
    assert.equal(await fakeBrowser.action.getBadgeText({ tabId: otherId }), '110');
    await request(tab, 2, { type: 'register', volume: 2 });
    assert.equal(await fakeBrowser.action.getBadgeText({ tabId }), '200');
    await fakeBrowser.tabs.onUpdated.trigger(tabId, { status: 'loading' }, tab);
    assert.equal(await fakeBrowser.action.getBadgeText({ tabId }), '');
    assert.equal(await fakeBrowser.action.getBadgeText({ tabId: otherId }), '110');
  } finally {
    const removed = { isWindowClosing: false, windowId: tab.windowId };
    await fakeBrowser.tabs.onRemoved.trigger(tabId, removed);
    await fakeBrowser.tabs.onRemoved.trigger(otherId, removed);
    fakeBrowser.i18n.getMessage = getMessage;
    fakeBrowser.reset();
  }
});

test('register 复用内存里的设置，有标签地址时不再读存储或 tabs.get', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const getMessage = fakeBrowser.i18n.getMessage;
  fakeBrowser.i18n.getMessage = (name: string) => messages[name] ?? '';
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch' });
  const tabId = tab.id!;
  let reads = 0;
  const storage = fakeBrowser.storage.local;
  const originalGet = storage.get.bind(storage);
  storage.get = (async (...args: Parameters<typeof storage.get>) => { reads += 1; return originalGet(...args); }) as typeof storage.get;
  const originalTabsGet = fakeBrowser.tabs.get.bind(fakeBrowser.tabs);
  const tabsGet = mock.method(fakeBrowser.tabs, 'get', (tabId: number) => originalTabsGet(tabId));
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const request = (message: object, source = tab) => new Promise<unknown>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, { id: fakeBrowser.runtime.id, tab: source, frameId: 0 }, resolve);
    });
    await request({ type: 'register', volume: 1.5 });
    await request({ type: 'register', volume: 1.5 });
    await request({ type: 'context' });
    assert.equal(await fakeBrowser.action.getBadgeText({ tabId }), '150');
    await request({ type: 'register', volume: 1.2 });
    assert.equal(reads, 1, '多次 register 只在缓存未就绪时读一次存储');
    assert.equal(tabsGet.mock.calls.length, 0);
    assert.equal(await fakeBrowser.action.getBadgeText({ tabId }), '120');
    await fakeBrowser.storage.local.set({ [storageKey]: { ...defaultSettings, siteMode: 'exclude', sites: ['example.com'] } });
    await request({ type: 'register', volume: 1.5 });
    assert.equal(reads, 1, 'storage.onChanged 刷新缓存，register 不再读存储');
    assert.equal(await fakeBrowser.action.getBadgeText({ tabId }), '');
    const bare = { ...tab, url: undefined };
    await request({ type: 'register', volume: 1.1 }, bare);
    assert.equal(tabsGet.mock.calls.length, 1);
    assert.equal(reads, 1);
  } finally {
    storage.get = originalGet;
    tabsGet.mock.restore();
    fakeBrowser.i18n.getMessage = getMessage;
    await fakeBrowser.tabs.onRemoved.trigger(tabId, { isWindowClosing: false, windowId: tab.windowId });
    fakeBrowser.reset();
  }
});

test('service worker 重启后仍记得 iframe，快捷键找得到它', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch' });
  await fakeBrowser.storage.session.set({ 'ottertap-frames-v1': { [String(tab.id)]: [4] } });
  const seen: number[] = [];
  const sendMessage = mock.method(fakeBrowser.tabs, 'sendMessage', async (_tabId: number, _message: { type: string }, options?: { frameId?: number }) => {
    seen.push(options?.frameId ?? 0);
    return { media: [{ id: '7', volume: 1, maxVolume: 1, muted: false, paused: false, rate: 1 }] };
  });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const result = await new Promise<{ media?: Array<{ id: string }> }>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger(
        { namespace: 'ottertap', type: 'read', tabId: tab.id },
        { id: fakeBrowser.runtime.id, url: fakeBrowser.runtime.getURL('/popup.html') },
        resolve
      );
    });
    assert.deepEqual(seen.filter(id => id === 4), [4]);
    assert.ok(result.media?.some(item => item.id === '4:7'));
  } finally {
    sendMessage.mock.restore();
    await fakeBrowser.tabs.onRemoved.trigger(tab.id!, { isWindowClosing: false, windowId: tab.windowId });
    fakeBrowser.reset();
  }
});
