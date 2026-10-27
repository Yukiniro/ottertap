import { i18n } from '#i18n';
import { browser } from 'wxt/browser';
import { soundingTabChanged, type SoundingTabsClient } from './tabs';
import type { MediaClient } from './types';

async function request(tabId: number | undefined, message: object) {
  const result = await browser.runtime.sendMessage({ namespace: 'ottertap', tabId, ...message });
  if (!result || result.error) throw new Error(result?.error || i18n.t('extensionDisconnected'));
  return result;
}

export function createExtensionClient(tabId?: number): MediaClient {
  return {
    read: () => request(tabId, { type: 'read' }),
    async command(media, command) { await request(tabId, { type: 'command', id: media.id, command }); },
    async select(id, manual) { await request(tabId, manual ? { type: 'select', id, manual: true } : { type: 'select', id }); },
    async highlight(media) { await request(tabId, { type: 'highlight', id: media.id }); }
  };
}

export function createSoundingTabsClient(tabId?: number): SoundingTabsClient {
  return {
    async list() {
      const result = await request(tabId, { type: 'soundingTabs' });
      return Array.isArray(result.tabs) ? result.tabs : [];
    },
    async focus(id) { await request(tabId, { type: 'focusTab', tabId: id }); },
    async mute(id, muted) { await request(tabId, { type: 'muteTab', tabId: id, muted }); },
    watch(onChange) {
      const updated: Parameters<typeof browser.tabs.onUpdated.addListener>[0] = (_id, change) => { if (soundingTabChanged(change)) onChange(); };
      const removed = () => onChange();
      browser.tabs.onUpdated.addListener(updated);
      browser.tabs.onRemoved.addListener(removed);
      return () => {
        browser.tabs.onUpdated.removeListener(updated);
        browser.tabs.onRemoved.removeListener(removed);
      };
    }
  };
}
