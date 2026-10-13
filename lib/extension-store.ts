import { browser } from 'wxt/browser';
import { normalizeSettings } from './settings';
import type { SettingsStore } from './types';

// Keep the storage key so the rename preserves existing user preferences.
const key = 'suibo-settings-v1';
export const extensionStore: SettingsStore = {
  async load() { return normalizeSettings((await browser.storage.local.get(key))[key]); },
  async save(settings) { await browser.storage.local.set({ [key]: normalizeSettings(settings) }); },
  watch(callback) {
    const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes[key]) callback(normalizeSettings(changes[key].newValue));
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }
};
