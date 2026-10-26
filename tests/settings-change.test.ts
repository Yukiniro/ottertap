import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeSettingsChange, normalizeSettings } from '../lib/settings';
import { createDemoStore } from '../lib/demo';
import { Window } from 'happy-dom';

test('设置差异合并保留并发字段，删除与新增只作用于调用方改动，不改输入', () => {
  const previous = normalizeSettings({ sitePrefs: { 'one.test': { volume: .5, channel: 'mono' } }, sites: ['old.test'] });
  const current = normalizeSettings({ ...previous, theme: 'dark', sitePrefs: { 'one.test': { volume: .5, rate: 2, channel: 'mono' }, 'new.test': { rate: 1.5 } }, sites: ['old.test', 'new.test'] });
  const next = normalizeSettings({ ...previous, sitePrefs: { 'one.test': { volume: .8 } }, sites: ['added.test'], ratePresets: [2, 1] });
  const snapshot = structuredClone(current);
  const merged = mergeSettingsChange(current, previous, next);
  assert.equal(merged.theme, 'dark');
  assert.deepEqual(merged.sitePrefs, { 'one.test': { volume: .8, rate: 2 }, 'new.test': { rate: 1.5 } });
  assert.deepEqual(merged.sites, ['new.test', 'added.test']);
  assert.deepEqual(merged.ratePresets, [2, 1]);
  assert.deepEqual(current, snapshot);
  assert.deepEqual(mergeSettingsChange(current, previous, previous), current);
});

test('官网演示存储也按导入要求整份替换', async () => {
  const view = new Window({ url: 'https://demo.test' });
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: view.localStorage, configurable: true });
  try {
    const initial = normalizeSettings({ theme: 'light', sites: ['old.test'] });
    const current = normalizeSettings({ theme: 'dark', sites: ['new.test'] });
    const store = createDemoStore('settings');
    view.localStorage.setItem('settings', JSON.stringify(current));
    await store.save(initial, initial, true);
    assert.deepEqual(await store.load(), initial);
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    await view.happyDOM.close();
  }
});
