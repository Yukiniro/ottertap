import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { defaultSettings } from '../lib/types';

test('多个页面与多个标签的站点记忆共用写入队列，失败后仍可保存', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const key = 'ottertap-settings-v1';
  const messages = mock.method(fakeBrowser.i18n, 'getMessage', (key: string) => key);
  let saved = { ...structuredClone(defaultSettings), sitePrefs: { 'one.test': { volume: .5 }, 'two.test': { rate: 1.5 } } };
  let writes = 0;
  let release = () => {};
  let fail = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const get = mock.method(fakeBrowser.storage.local, 'get', async () => ({ [key]: structuredClone(saved) }));
  const set = mock.method(fakeBrowser.storage.local, 'set', async (items: Record<string, typeof saved>) => {
    writes++;
    if (writes === 1) await gate;
    if (fail) throw new Error('storage failed');
    saved = structuredClone(items[key]!);
    await fakeBrowser.storage.onChanged.trigger({ [key]: { newValue: saved } }, 'local');
  });
  const send = mock.method(fakeBrowser.tabs, 'sendMessage', async () => ({ ok: true }));
  const request = (message: object, sender: Parameters<Parameters<typeof fakeBrowser.runtime.onMessage.addListener>[0]>[1] = { id: fakeBrowser.runtime.id, url: fakeBrowser.runtime.getURL('/options.html') }) => new Promise<{ ok?: boolean; error?: string }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('后台没有响应')), 1000);
    void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', ...message }, sender, result => { clearTimeout(timer); resolve(result); });
  });
  const runtime = mock.method(fakeBrowser.runtime, 'sendMessage', (message: object) => request(message));
  const stops: (() => void)[] = [];
  try {
    (await import('../entrypoints/background')).default.main();
    const { createSettingsAtoms } = await import('../lib/settings-atoms');
    const { extensionStore } = await import('../lib/extension-store');
    const a = createSettingsAtoms(extensionStore), b = createSettingsAtoms(extensionStore);
    stops.push(a.mount(), b.mount());
    await Promise.all([a.ready, b.ready]);
    const one = await fakeBrowser.tabs.create({ url: 'https://one.test/' });
    const two = await fakeBrowser.tabs.create({ url: 'https://two.test/' });
    const tasks = [
      a.store.set(a.writeSettingsAtom, { theme: 'dark' }),
      b.store.set(b.writeSettingsAtom, { floating: false }),
      request({ type: 'command', id: '0:1', command: { type: 'volume', value: .8 } }, { id: fakeBrowser.runtime.id, tab: one }),
      request({ type: 'command', id: '0:1', command: { type: 'rate', value: 2 } }, { id: fakeBrowser.runtime.id, tab: two })
    ];
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(writes, 1, '第一笔写入完成前不能开始其他写入');
    release();
    const results = await Promise.all(tasks);
    assert.equal(results[0], true);
    assert.equal(results[1], true);
    assert.equal(saved.theme, 'dark');
    assert.equal(saved.floating, false);
    assert.deepEqual(saved.sitePrefs, { 'one.test': { volume: .8 }, 'two.test': { rate: 2 } });
    await Promise.all([a.settled(), b.settled()]);
    await Promise.all([
      a.store.set(a.writeSettingsAtom, { sites: ['one.test'], sitePrefs: { ...a.store.get(a.sitePrefsAtom), 'three.test': { volume: .3 } } }),
      b.store.set(b.writeSettingsAtom, { sites: ['two.test'], sitePrefs: { ...b.store.get(b.sitePrefsAtom), 'four.test': { rate: 1.25 } } })
    ]);
    assert.deepEqual([...saved.sites].sort(), ['one.test', 'two.test']);
    assert.deepEqual(Object.keys(saved.sitePrefs).sort(), ['four.test', 'one.test', 'three.test', 'two.test']);
    assert.ok((await request({ type: 'settings', settings: saved, previous: saved }, { id: fakeBrowser.runtime.id, url: 'https://untrusted.test' })).error);
    assert.ok((await request({ type: 'settings', settings: [], previous: saved })).error);
    const backup = structuredClone(defaultSettings);
    const replaced = await request({ type: 'settings', settings: backup, previous: backup, replace: true });
    assert.equal(replaced.ok, true);
    assert.deepEqual(saved, backup, '整份替换不受旧 UI 基线影响');
    fail = true;
    assert.equal(await a.store.set(a.writeSettingsAtom, { floating: true }), false);
    fail = false;
    assert.equal(await a.store.set(a.writeSettingsAtom, { floating: true }), true);
    assert.equal(saved.floating, true);
  } finally {
    release();
    stops.forEach(stop => stop());
    [get, set, send, runtime, messages].forEach(item => item.mock.restore());
    fakeBrowser.reset();
  }
});
