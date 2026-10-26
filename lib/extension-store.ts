import { browser } from 'wxt/browser';
import { i18n } from '#i18n';
import { normalizeSettings } from './settings';
import type { SettingsStore } from './types';

export const settingsKey = 'ottertap-settings-v1';
export const extensionStore: SettingsStore = {
  async load() { return normalizeSettings((await browser.storage.local.get(settingsKey))[settingsKey]); },
  async save(settings, previous, replace = false) {
    const result = await browser.runtime.sendMessage({ namespace: 'ottertap', type: 'settings', settings, previous, replace });
    if (!result?.ok) throw new Error(result?.error || i18n.t('settingsWriteError'));
  },
  watch(callback) {
    const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes[settingsKey]) callback(normalizeSettings(changes[settingsKey].newValue));
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }
};
