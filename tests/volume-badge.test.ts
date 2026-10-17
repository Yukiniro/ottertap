import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { readFlatMessages } from '../lib/message-catalog';
import { maxEffectiveVolume, volumeBadgeColor, volumeBadgeFromReports, volumeBadgeTtlMs, volumeReportIntervalMs } from '../lib/volume-badge';

const messages = readFlatMessages(readFileSync(new URL('../locales/zh_CN.yml', import.meta.url), 'utf8'));

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
