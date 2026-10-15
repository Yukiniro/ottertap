import { i18n } from '#i18n';
import { browser } from 'wxt/browser';
import { extensionStore } from '../lib/extension-store';
import { isSiteEnabled } from '../lib/settings';
import { isMediaCommand } from '../lib/media';
import { isHotkeyAction, shownPercent } from '../lib/hotkey';
import { keptSelection, lockedMedia } from '../lib/media';
import type { MediaState } from '../lib/types';

export default defineBackground(() => {
  const frames = new Map<number, Map<number, number>>();
  const selectedIds = new Map<number, string>();
  const gestures = new Map<number, { id: string; percent: number; max: number; at: number }>();
  const pendingVolume = new Map<number, number>();
  const commandTails = new Map<number, Promise<void>>();
  const enqueueCommand = (tabId: number, task: () => Promise<unknown>) => {
    const prev = commandTails.get(tabId) ?? Promise.resolve();
    const run = prev.then(task);
    const done = run.then(() => {}, () => {});
    commandTails.set(tabId, done);
    done.then(() => { if (commandTails.get(tabId) === done) commandTails.delete(tabId); });
    return run;
  };
  const forget = (tabId: number) => { frames.delete(tabId); selectedIds.delete(tabId); gestures.delete(tabId); pendingVolume.delete(tabId); };
  browser.tabs.onRemoved.addListener(tabId => { forget(tabId); commandTails.delete(tabId); });
  browser.tabs.onUpdated.addListener((tabId, change) => { if (change.status === 'loading') forget(tabId); });
  const frameIds = (tabId: number) => {
    const known = frames.get(tabId) ?? new Map();
    return new Set([0, ...[...known].filter(([, time]) => Date.now() - time < 5000).map(([id]) => id)]);
  };
  const hasMedia = (tabId: number) => [...(frames.get(tabId)?.values() ?? [])].some(time => Date.now() - time < 5000);
  async function collect(tabId: number, host: string) {
    const frames = [...frameIds(tabId)];
    const results = await Promise.allSettled(frames.map(async frameId => {
      const response = await browser.tabs.sendMessage(tabId, { namespace: 'ottertap', type: 'snapshot' }, { frameId });
      const media: MediaState[] = response?.media ?? [];
      return media.map(item => ({ ...item, frameId, host, id: `${frameId}:${item.id}` }));
    }));
    const failed = new Set<number>();
    const media = results.flatMap((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      failed.add(frames[index]!);
      return [];
    });
    return { media, failed };
  }
  const lockedId = (tabId: number, media: MediaState[], failed: Set<number>) => {
    const selectedId = keptSelection(selectedIds.get(tabId) ?? '', media.map(item => item.id), failed);
    if (!selectedId) selectedIds.delete(tabId);
    return selectedId;
  };
  const reveal = (tabId: number, percent: number) => {
    void browser.tabs.sendMessage(tabId, { namespace: 'ottertap', type: 'reveal', percent }, { frameId: 0 }).catch(() => {});
  };
  async function applyVolume(tabId: number, host: string, delta: number) {
    let gesture = gestures.get(tabId);
    const selected = selectedIds.get(tabId);
    if (!gesture || gesture.id !== selected || Date.now() - gesture.at > 300) {
      const { media, failed } = await collect(tabId, host);
      const saved = lockedId(tabId, media, failed);
      if (saved && !media.some(item => item.id === saved)) return;
      const target = lockedMedia(media, saved);
      if (!target) return;
      gesture = { id: target.id, percent: shownPercent(target), max: target.maxVolume * 100, at: 0 };
      selectedIds.set(tabId, target.id);
      gestures.set(tabId, gesture);
    }
    const previous = gesture.percent;
    gesture.percent = Math.max(0, Math.min(gesture.max, previous + delta));
    gesture.at = Date.now();
    try { await deliver(tabId, gesture.id, 'command', { type: 'volume', value: gesture.percent / 100 }); }
    catch (error) { gesture.percent = previous; throw error; }
    return gesture.percent;
  }
  async function deliver(tabId: number, id: string, type: 'command' | 'highlight', command?: unknown) {
    const [frame, localId] = id.split(':');
    const message = type === 'highlight' ? { namespace: 'ottertap', type, id: localId } : { namespace: 'ottertap', type, id: localId, command };
    const result = await browser.tabs.sendMessage(tabId, message, { frameId: Number(frame) });
    if (result?.error) throw new Error(result.error);
  }
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id || !message || message.namespace !== 'ottertap') return;
    if (!['options', 'context', 'register', 'read', 'command', 'select', 'highlight', 'hotkey'].includes(message.type)) return;
    const tabId = sender.tab?.id ?? message.tabId;
    async function handle() {
      if (message.type === 'options') { await browser.runtime.openOptionsPage(); return { ok: true }; }
      if (!Number.isInteger(tabId)) return { error: i18n.t('noTab') };
      try {
        const [tab, settings] = await Promise.all([browser.tabs.get(tabId), extensionStore.load()]);
        if (!tab.url || !/^https?:\/\//.test(tab.url)) throw new Error(i18n.t('pageNotAllowed'));
        const enabled = isSiteEnabled(tab.url ?? '', settings);
        const host = tab.url ? new URL(tab.url).hostname : '';
        if (message.type === 'context') return { enabled, host, hasMedia: hasMedia(tabId) };
        if (message.type === 'register' && sender.tab) {
          if (!enabled) return;
          if (!frames.has(tabId)) frames.set(tabId, new Map());
          frames.get(tabId)!.set(sender.frameId ?? 0, Date.now());
          return;
        }
        // Only extension pages and this tab's content scripts can request controls.
        if (!sender.tab && !sender.url?.startsWith(browser.runtime.getURL('/'))) return;
        const mediaId = typeof message.id === 'string' && /^\d+:\d+$/.test(message.id) ? message.id : '';
        if (message.type === 'read') {
          if (!enabled) return { host, enabled, media: [], selectedId: '' };
          const { media, failed } = await collect(tabId, host);
          return { host, enabled, media, selectedId: lockedId(tabId, media, failed) };
        }
        if (!enabled) { pendingVolume.delete(tabId); throw new Error(i18n.t('siteDisabled')); }
        if (message.type === 'select') {
          if (!mediaId) throw new Error(i18n.t('invalidCommand'));
          if (gestures.get(tabId)?.id !== mediaId) gestures.delete(tabId);
          selectedIds.set(tabId, mediaId);
          return { ok: true };
        }
        if (message.type === 'highlight') {
          if (!mediaId) throw new Error(i18n.t('invalidCommand'));
          await deliver(tabId, mediaId, 'highlight');
          return { ok: true };
        }
        if (message.type === 'hotkey') {
          if (!isHotkeyAction(message.action)) throw new Error(i18n.t('invalidCommand'));
          let percent: number | undefined;
          while (pendingVolume.get(tabId)) {
            const delta = pendingVolume.get(tabId)!;
            pendingVolume.set(tabId, 0);
            const next = await applyVolume(tabId, host, delta);
            if (next === undefined) { pendingVolume.delete(tabId); return { handled: false }; }
            percent = next;
          }
          if (percent === undefined) return { handled: false };
          reveal(tabId, percent);
          return { handled: true, percent };
        }
        if (message.type === 'command') {
          if (!isMediaCommand(message.command) || !mediaId) throw new Error(i18n.t('invalidCommand'));
          if (message.command.type === 'volume' || message.command.type === 'mute') gestures.delete(tabId);
          await deliver(tabId, mediaId, 'command', message.command);
          return { ok: true };
        }
      } catch (error) { return { error: error instanceof Error ? error.message : i18n.t('pageUnavailable') }; }
    }
    // Chain before the first await so a later command cannot pass an earlier one.
    if (message.type === 'hotkey' && message.action?.type === 'volume' && Number.isInteger(tabId) && isHotkeyAction(message.action)) {
      pendingVolume.set(tabId, (pendingVolume.get(tabId) ?? 0) + message.action.delta);
    }
    const run = (message.type === 'command' || message.type === 'hotkey') && Number.isInteger(tabId) ? enqueueCommand(tabId, () => handle()) : handle();
    // Keep the channel open on Chromium versions without Promise listener support.
    void run.then(sendResponse, () => sendResponse({ error: i18n.t('extensionMessageFailed') }));
    return true;
  });
});
