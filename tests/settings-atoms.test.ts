import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';
import { createSettingsAtoms } from '../lib/settings-atoms';

function memoryStore(initial: Settings, failSave = false) {
  let value = initial;
  let fail = failSave;
  const listeners = new Set<(settings: Settings) => void>();
  const gates: Array<() => void> = [];
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) {
      await new Promise<void>(resolve => gates.push(resolve));
      if (fail) throw new Error('storage failed');
      value = next;
      listeners.forEach(listener => listener(next));
    },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  return {
    store,
    listeners,
    pending: () => gates.length,
    release: () => gates.shift()?.(),
    read: () => value,
    fail(next: boolean) { fail = next; }
  };
}

async function until(ready: () => boolean) {
  for (let attempt = 0; attempt < 30 && !ready(); attempt += 1) await Promise.resolve();
  assert.equal(ready(), true);
}

test('局部写入排队合并，过期的存储通知不会盖掉更新的乐观值，失败回滚', async () => {
  const memory = memoryStore({ ...defaultSettings, theme: 'light', sites: ['bilibili.com'] });
  const atoms = createSettingsAtoms(memory.store);
  const unmount = atoms.mount();
  try {
    await atoms.ready;
    assert.equal(atoms.store.get(atoms.settingsAtom).theme, 'light');
    assert.deepEqual(atoms.store.get(atoms.sitesAtom), ['bilibili.com']);
    const theme = atoms.store.set(atoms.writeSettingsAtom, { theme: 'dark' });
    const floating = atoms.store.set(atoms.writeSettingsAtom, { floating: false });
    assert.equal(atoms.store.get(atoms.floatingAtom), false);
    assert.equal(atoms.store.get(atoms.themeAtom), 'dark');
    await until(() => memory.pending() === 1);
    memory.release();
    await until(() => memory.pending() === 1);
    assert.equal(atoms.store.get(atoms.floatingAtom), false);
    memory.release();
    assert.equal(await theme, true);
    assert.equal(await floating, true);
    await atoms.settled();
    assert.equal(memory.read().theme, 'dark');
    assert.equal(memory.read().floating, false);
    assert.deepEqual(memory.read().sites, ['bilibili.com']);
    memory.fail(true);
    const mode = atoms.store.set(atoms.writeSettingsAtom, { siteMode: 'allow' });
    await until(() => memory.pending() === 1);
    memory.release();
    assert.equal(await mode, false);
    assert.equal(memory.read().siteMode, 'all');
    assert.equal(atoms.store.get(atoms.siteModeAtom), 'all');
    assert.equal(atoms.store.get(atoms.themeAtom), 'dark');
    assert.equal(atoms.store.get(atoms.errorAtom), '设置未保存，请重试。');
    assert.equal(memory.listeners.size, 1);
  } finally { unmount(); }
  assert.equal(memory.listeners.size, 0);
});

test('首次读取失败时保留默认设置并结束加载', async () => {
  const store: SettingsStore = {
    async load() { throw new Error('read failed'); },
    async save() {},
    watch() { return () => {}; }
  };
  const atoms = createSettingsAtoms(store);
  const unmount = atoms.mount();
  try {
    await atoms.ready;
    assert.equal(atoms.store.get(atoms.loadingAtom), false);
    assert.equal(atoms.store.get(atoms.errorAtom), '设置读取失败，请重试。');
    assert.equal(atoms.store.get(atoms.floatingAtom), true);
    assert.equal(atoms.store.get(atoms.themeAtom), 'system');
  } finally { unmount(); }
});
