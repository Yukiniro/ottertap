import { i18n } from '#i18n';
import { browser } from 'wxt/browser';
import type { MediaClient } from './types';

export function createExtensionClient(tabId?: number): MediaClient {
  async function request(message: object) {
    const result = await browser.runtime.sendMessage({ namespace: 'ottertap', tabId, ...message });
    if (!result || result.error) throw new Error(result?.error || i18n.t('extensionDisconnected'));
    return result;
  }
  return {
    read: () => request({ type: 'read' }),
    async command(media, command) { await request({ type: 'command', id: media.id, command }); },
    async select(id) { await request({ type: 'select', id }); },
    async highlight(media) { await request({ type: 'highlight', id: media.id }); }
  };
}
