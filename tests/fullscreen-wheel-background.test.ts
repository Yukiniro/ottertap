import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defineBackground } from 'wxt/utils/define-background';
import { defaultSettings } from '../lib/types';

test('context 带上全屏滚轮开关，缺省是关，不改变悬停滚轮默认值', async () => {
  Object.defineProperty(globalThis, 'browser', { value: fakeBrowser, configurable: true });
  Object.defineProperty(globalThis, 'defineBackground', { value: defineBackground, configurable: true });
  const commands = fakeBrowser.commands as { onCommand: { addListener(callback: (command: string) => void): void } };
  const original = commands.onCommand;
  commands.onCommand = { addListener() {} };
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url: 'https://example.com/watch', active: true });
  try {
    const background = await import('../entrypoints/background');
    background.default.main();
    const sender = { id: fakeBrowser.runtime.id, tab, frameId: 0 };
    const context = () => new Promise<{ fullscreenWheel?: boolean; hoverWheel?: boolean }>(resolve => {
      void fakeBrowser.runtime.onMessage.trigger({ namespace: 'ottertap', type: 'context' }, sender, resolve);
    });
    const initial = await context();
    assert.equal(initial.fullscreenWheel, false);
    assert.equal(initial.hoverWheel, true);

    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': { ...defaultSettings, fullscreenWheel: true } });
    const enabled = await context();
    assert.equal(enabled.fullscreenWheel, true);
    assert.equal(enabled.hoverWheel, true);

    const legacy = { ...defaultSettings } as Partial<typeof defaultSettings>;
    delete legacy.fullscreenWheel;
    await fakeBrowser.storage.local.set({ 'ottertap-settings-v1': legacy });
    const missing = await context();
    assert.equal(missing.fullscreenWheel, false, '旧设置没有这一项时仍然关闭');
    assert.equal(missing.hoverWheel, true);
  } finally {
    commands.onCommand = original;
    fakeBrowser.reset();
  }
});
