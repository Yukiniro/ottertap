import { browser } from 'wxt/browser';
import { extensionStore } from '../lib/extension-store';
import { isSiteEnabled } from '../lib/settings';
import { isMediaCommand } from '../lib/media';
import type { MediaState } from '../lib/types';

export default defineBackground(() => {
  const frames = new Map<number, Map<number, number>>();
  const commandTails = new Map<number, Promise<void>>();
  const enqueueCommand = (tabId: number, task: () => Promise<unknown>) => {
    const prev = commandTails.get(tabId) ?? Promise.resolve();
    const run = prev.then(task);
    const done = run.then(() => {}, () => {});
    commandTails.set(tabId, done);
    done.then(() => { if (commandTails.get(tabId) === done) commandTails.delete(tabId); });
    return run;
  };
  browser.tabs.onRemoved.addListener(tabId => { frames.delete(tabId); commandTails.delete(tabId); });
  browser.tabs.onUpdated.addListener((tabId, change) => { if (change.status === 'loading') frames.delete(tabId); });
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id || !message || message.namespace !== 'ottertap') return;
    if (!['options', 'context', 'register', 'read', 'command'].includes(message.type)) return;
    const tabId = sender.tab?.id ?? message.tabId;
    async function handle() {
      if (message.type === 'options') { await browser.runtime.openOptionsPage(); return { ok: true }; }
      if (!Number.isInteger(tabId)) return { error: '找不到当前页面。' };
      try {
        const [tab, settings] = await Promise.all([browser.tabs.get(tabId), extensionStore.load()]);
        if (!tab.url || !/^https?:\/\//.test(tab.url)) throw new Error('此页面不允许媒体控制，请切换到含有音视频的网页。');
        const enabled = isSiteEnabled(tab.url ?? '', settings);
        const host = tab.url ? new URL(tab.url).hostname : '';
        if (message.type === 'context') return { enabled, host };
        if (message.type === 'register' && sender.tab) {
          if (!enabled) return;
          if (!frames.has(tabId)) frames.set(tabId, new Map());
          frames.get(tabId)!.set(sender.frameId ?? 0, Date.now());
          return;
        }
        // Only extension pages and this tab's content scripts can request controls.
        if (!sender.tab && !sender.url?.startsWith(browser.runtime.getURL('/'))) return;
        if (message.type === 'read') {
          if (!enabled) return { host, enabled, media: [] };
          const known = frames.get(tabId) ?? new Map();
          const frameIds = new Set([0, ...[...known].filter(([, time]) => Date.now() - time < 5000).map(([id]) => id)]);
          const results = await Promise.allSettled([...frameIds].map(async frameId => {
            const response = await browser.tabs.sendMessage(tabId, { namespace: 'ottertap', type: 'snapshot' }, { frameId });
            const media: MediaState[] = response?.media ?? [];
            return media.map(item => ({ ...item, frameId, host, id: `${frameId}:${item.id}` }));
          }));
          return { host, enabled, media: results.flatMap(result => result.status === 'fulfilled' ? result.value : []) };
        }
        if (message.type === 'command') {
          if (!enabled) throw new Error('当前网站已停用小獭。');
          if (!isMediaCommand(message.command) || typeof message.id !== 'string' || !/^\d+:\d+$/.test(message.id)) throw new Error('无效的控制指令。');
          const [frame, id] = message.id.split(':');
          const result = await browser.tabs.sendMessage(tabId, { namespace: 'ottertap', type: 'command', id, command: message.command }, { frameId: Number(frame) });
          if (result?.error) throw new Error(result.error);
          return { ok: true };
        }
      } catch (error) { return { error: error instanceof Error ? error.message : '当前页面暂时无法控制，请刷新后重试。' }; }
    }
    // Chain before the first await so a later command cannot pass an earlier one.
    const run = message.type === 'command' && Number.isInteger(tabId) ? enqueueCommand(tabId, () => handle()) : handle();
    // Keep the channel open on Chromium versions without Promise listener support.
    void run.then(sendResponse, () => sendResponse({ error: '扩展通信失败，请刷新网页后重试。' }));
    return true;
  });
});
