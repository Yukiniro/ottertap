import { i18n } from '#i18n';
import { browser } from 'wxt/browser';
import { extensionStore } from '../lib/extension-store';
import { createSitePrefSession, isSiteEnabled, withRememberedCommand } from '../lib/settings';
import { frameFailureKey, isMediaCommand, pipFailureKey } from '../lib/media';
import { actionForCommand } from '../lib/commands';
import { actionHintKey, applySkipStep, applyVolumeStep, isHotkeyAction, planHotkey, shownPercent, type HotkeyAction } from '../lib/hotkey';
import { nextRate } from '../lib/rate';
import { steppedVolume } from '../lib/volume';
import { volumeBadgeColor, volumeBadgeFromReports, volumeBadgeTtlMs } from '../lib/volume-badge';
import { keptSelection, lockedMedia } from '../lib/media';
import { soundingTabs } from '../lib/tabs';
import type { MediaCommand, MediaState, Settings, SitePref } from '../lib/types';

export default defineBackground(() => {
  const frames = new Map<number, Set<number>>();
  const mediaKnown = new Map<number, boolean>();
  const framesKey = 'ottertap-frames-v1';
  const persistFrames = () => {
    const area = browser.storage.session;
    if (!area) return;
    const stored: Record<string, number[]> = {};
    for (const [tabId, ids] of frames) if (ids.size) stored[String(tabId)] = [...ids];
    void area.set({ [framesKey]: stored }).catch(() => {});
  };
  const framesReady: Promise<void> = browser.storage.session ? browser.storage.session.get(framesKey).then(data => {
    if (frames.size) return;
    const stored = data[framesKey];
    if (!stored || typeof stored !== 'object') return;
    for (const [id, raw] of Object.entries(stored as Record<string, unknown>)) {
      if (!Array.isArray(raw)) continue;
      const ids = raw.filter((value): value is number => Number.isInteger(value));
      if (!ids.length) continue;
      const tabId = Number(id);
      frames.set(tabId, new Set(ids));
      mediaKnown.set(tabId, true);
    }
  }).catch(() => undefined) : Promise.resolve();
  let settingsCache: Settings | undefined;
  let settingsLoad: Promise<Settings> | undefined;
  const currentSettings = () => {
    if (settingsCache) return Promise.resolve(settingsCache);
    settingsLoad ??= extensionStore.load().then(value => (settingsCache ??= value)).catch(error => { settingsLoad = undefined; throw error; });
    return settingsLoad;
  };
  extensionStore.watch(value => { settingsCache = value; });
  const selectedIds = new Map<number, string>();
  const gestures = new Map<number, { id: string; percent: number; max: number; at: number }>();
  const commandTails = new Map<number, Promise<void>>();
  const enqueueCommand = (tabId: number, task: () => Promise<unknown>) => {
    const prev = commandTails.get(tabId) ?? Promise.resolve();
    const run = prev.then(task);
    const done = run.then(() => {}, () => {});
    commandTails.set(tabId, done);
    done.then(() => { if (commandTails.get(tabId) === done) commandTails.delete(tabId); });
    return run;
  };
  const volumes = new Map<number, Map<number, { volume: number; at: number }>>();
  const volumeTimers = new Map<number, ReturnType<typeof setTimeout>>();
  const clearVolumeTimer = (tabId: number) => {
    const timer = volumeTimers.get(tabId);
    if (!timer) return;
    clearTimeout(timer);
    volumeTimers.delete(tabId);
  };
  const paintBadge = (tabId: number, now: number) => {
    const badge = volumeBadgeFromReports(volumes.get(tabId)?.values() ?? [], now);
    const title = badge ? i18n.t('volumeBoosted', { percent: badge.percent }) : '';
    try {
      void browser.action.setBadgeText({ text: badge?.text ?? '', tabId }).catch(() => {});
      void browser.action.setBadgeBackgroundColor({ color: volumeBadgeColor, tabId }).catch(() => {});
      void browser.action.setTitle({ title, tabId }).catch(() => {});
    } catch { /* The build verifier does not provide the action API. */ }
  };
  const armVolumeTimer = (tabId: number, now: number) => {
    clearVolumeTimer(tabId);
    const tab = volumes.get(tabId);
    if (!tab?.size) return;
    let expiry = Infinity;
    for (const sample of tab.values()) expiry = Math.min(expiry, sample.at + volumeBadgeTtlMs);
    volumeTimers.set(tabId, setTimeout(() => {
      volumeTimers.delete(tabId);
      const current = volumes.get(tabId);
      const time = Date.now();
      if (current) {
        for (const [frameId, sample] of current) if (time - sample.at >= volumeBadgeTtlMs) current.delete(frameId);
        if (!current.size) volumes.delete(tabId);
      }
      paintBadge(tabId, time);
      armVolumeTimer(tabId, time);
    }, Math.max(0, expiry - now)));
  };
  const rememberVolume = (tabId: number, frameId: number, volume: number) => {
    const now = Date.now();
    const tab = volumes.get(tabId) ?? new Map();
    for (const [id, sample] of tab) if (now - sample.at >= volumeBadgeTtlMs) tab.delete(id);
    if (volume > 1) tab.set(frameId, { volume, at: now });
    else tab.delete(frameId);
    if (tab.size) volumes.set(tabId, tab);
    else volumes.delete(tabId);
    armVolumeTimer(tabId, now);
    paintBadge(tabId, now);
  };
  const sitePrefSessions = new Map<number, ReturnType<typeof createSitePrefSession>>();
  const sitePrefSession = (tabId: number) => {
    let session = sitePrefSessions.get(tabId);
    if (!session) sitePrefSessions.set(tabId, session = createSitePrefSession());
    return session;
  };
  const holdTargets = new Map<number, string>();
  const holdsKey = 'ottertap-holds-v1';
  const persistHolds = async () => {
    const area = browser.storage.session;
    if (!area) return;
    const stored: Record<string, string> = {};
    for (const [tabId, id] of holdTargets) stored[String(tabId)] = id;
    try { await area.set({ [holdsKey]: stored }); }
    catch { /* This worker can still release from memory. The next start writes the target again. */ }
  };
  // A suspended worker loses the map. The held media id has to be in session storage before keyup arrives at the replacement worker.
  const holdsReady: Promise<void> = browser.storage.session ? browser.storage.session.get(holdsKey).then(data => {
    if (holdTargets.size) return;
    const stored = data[holdsKey];
    if (!stored || typeof stored !== 'object') return;
    for (const [id, raw] of Object.entries(stored as Record<string, unknown>)) {
      if (typeof raw !== 'string' || !/^\d+:\d+$/.test(raw)) continue;
      const tabId = Number(id);
      if (!Number.isInteger(tabId)) continue;
      holdTargets.set(tabId, raw);
    }
  }).catch(() => undefined) : Promise.resolve();
  const sessionReady = Promise.all([framesReady, holdsReady]);
  const forget = (tabId: number) => {
    frames.delete(tabId); mediaKnown.delete(tabId); selectedIds.delete(tabId); gestures.delete(tabId); sitePrefSessions.delete(tabId);
    const held = holdTargets.delete(tabId);
    volumes.delete(tabId); clearVolumeTimer(tabId); paintBadge(tabId, Date.now()); persistFrames();
    return held ? persistHolds() : undefined;
  };
  async function rememberCommand(host: string, command: MediaCommand) {
    if (command.type !== 'volume' && command.type !== 'rate' && command.type !== 'channel') return;
    try {
      const latest = await currentSettings();
      const sitePrefs = withRememberedCommand(latest.sitePrefs, host, command);
      if (sitePrefs) { const next = { ...latest, sitePrefs }; await extensionStore.save(next); settingsCache = next; }
    } catch { /* The control already applied; the next adjustment can store it. */ }
  }
  async function applySitePref(tabId: number, host: string, mediaId: string, prefs: Record<string, SitePref>, defaultRate: number | null) {
    const commands = sitePrefSession(tabId).plan(host, mediaId, prefs, defaultRate);
    if (!commands.length) return false;
    let applied = false;
    await enqueueCommand(tabId, async () => {
      for (const command of commands) {
        try { await deliver(tabId, mediaId, 'command', command); applied = true; }
        catch { /* Once per visit. A rejected value is not written again. */ }
      }
    });
    return applied;
  }
  browser.tabs.onRemoved.addListener(tabId => sessionReady.then(() => { const pending = forget(tabId); commandTails.delete(tabId); return pending; }));
  browser.tabs.onUpdated.addListener((tabId, change) => change.status === 'loading' ? sessionReady.then(() => forget(tabId)) : undefined);
  const frameIds = (tabId: number) => new Set([0, ...(frames.get(tabId) ?? [])]);
  const publishSelection = (tabId: number) => {
    const send = browser.tabs.sendMessage;
    if (typeof send !== 'function') return;
    const selected = selectedIds.get(tabId) ?? '';
    const [frame, local] = selected.split(':');
    const owner = selected ? Number(frame) : NaN;
    for (const frameId of frameIds(tabId)) {
      const here = frameId === owner;
      void send(tabId, { namespace: 'ottertap', type: 'selected', id: here ? local ?? '' : '' }, { frameId }).catch(() => {});
    }
  };
  const rememberSelection = (tabId: number, id: string) => {
    if (selectedIds.get(tabId) === id) return;
    selectedIds.set(tabId, id);
    publishSelection(tabId);
  };
  const clearSelection = (tabId: number) => {
    if (!selectedIds.has(tabId)) return;
    selectedIds.delete(tabId);
    publishSelection(tabId);
  };
  const localSelection = (tabId: number, frameId: number) => {
    const selected = selectedIds.get(tabId) ?? '';
    const [frame, local] = selected.split(':');
    const here = selected !== '' && frame === String(frameId);
    return { selectedLocalId: here ? local ?? '' : '' };
  };
  const hasMedia = (tabId: number) => (frames.get(tabId)?.size ?? 0) > 0;
  const publishMedia = (tabId: number) => {
    const present = hasMedia(tabId);
    if (mediaKnown.get(tabId) === present) return;
    if (present) mediaKnown.set(tabId, true);
    else mediaKnown.delete(tabId);
    const send = browser.tabs.sendMessage;
    if (typeof send !== 'function') return;
    void send(tabId, { namespace: 'ottertap', type: 'tabMedia', hasMedia: present }, { frameId: 0 }).catch(() => {});
  };
  async function collect(tabId: number, host: string) {
    const frames = [...frameIds(tabId)];
    const recall = new Map<number, number | null>();
    const results = await Promise.allSettled(frames.map(async frameId => {
      const response = await browser.tabs.sendMessage(tabId, { namespace: 'ottertap', type: 'snapshot' }, { frameId });
      const media: MediaState[] = response?.media ?? [];
      const remembered = response?.recallRate;
      recall.set(frameId, typeof remembered === 'number' && Number.isFinite(remembered) ? remembered : null);
      return media.map(item => ({ ...item, frameId, host, id: `${frameId}:${item.id}` }));
    }));
    const failed = new Set<number>();
    const media = results.flatMap((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      failed.add(frames[index]!);
      return [];
    });
    return { media, failed, recall };
  }
  const lockedId = (tabId: number, media: MediaState[], failed: Set<number>) => {
    const selectedId = keptSelection(selectedIds.get(tabId) ?? '', media.map(item => item.id), failed);
    if (!selectedId) clearSelection(tabId);
    return selectedId;
  };
  const reveal = (tabId: number, percent: number) => {
    void browser.tabs.sendMessage(tabId, { namespace: 'ottertap', type: 'reveal', percent }, { frameId: 0 }).catch(() => {});
  };
  const showRate = (tabId: number, rate: number) => {
    void browser.tabs.sendMessage(tabId, { namespace: 'ottertap', type: 'rateHint', rate }, { frameId: 0 }).catch(() => {});
  };
  const showAction = (tabId: number, key: string, seconds?: number) => {
    void browser.tabs.sendMessage(tabId, { namespace: 'ottertap', type: 'actionHint', key, seconds }, { frameId: 0 }).catch(() => {});
  };
  const showRateLock = (tabId: number) => {
    void browser.tabs.sendMessage(tabId, { namespace: 'ottertap', type: 'rateLockHint' }, { frameId: 0 }).catch(() => {});
  };
  const showHold = (tabId: number, rate: number | null) => {
    void browser.tabs.sendMessage(tabId, { namespace: 'ottertap', type: 'holdHint', rate }, { frameId: 0 }).catch(() => {});
  };
  async function startHold(tabId: number, host: string, rate: number) {
    const { media, failed } = await collect(tabId, host);
    const saved = lockedId(tabId, media, failed);
    if (saved && !media.some(item => item.id === saved)) return false;
    const target = lockedMedia(media, saved);
    if (!target) return false;
    rememberSelection(tabId, target.id);
    holdTargets.set(tabId, target.id);
    await persistHolds();
    await deliver(tabId, target.id, 'hold', { phase: 'start', rate });
    showHold(tabId, rate);
    return true;
  }
  async function endHold(tabId: number) {
    await holdsReady;
    const id = holdTargets.get(tabId);
    if (holdTargets.delete(tabId)) await persistHolds();
    showHold(tabId, null);
    if (!id) return false;
    try { await deliver(tabId, id, 'hold', { phase: 'end' }); }
    catch { /* The frame navigated away before the key came up. */ }
    return true;
  }
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
      rememberSelection(tabId, target.id);
      gestures.set(tabId, gesture);
    }
    const previous = gesture.percent;
    gesture.percent = steppedVolume(previous, delta, gesture.max);
    gesture.at = Date.now();
    try { await deliver(tabId, gesture.id, 'command', { type: 'volume', value: gesture.percent / 100 }); }
    catch (error) { gesture.percent = previous; throw error; }
    await rememberCommand(host, { type: 'volume', value: gesture.percent / 100 });
    return gesture.percent;
  }
  async function applyRate(tabId: number, host: string, direction: 1 | -1 | 0) {
    const { media, failed, recall } = await collect(tabId, host);
    const saved = lockedId(tabId, media, failed);
    if (saved && !media.some(item => item.id === saved)) return;
    const target = lockedMedia(media, saved);
    if (!target) return;
    rememberSelection(tabId, target.id);
    const frameId = Number(target.id.split(':')[0]);
    const settings = await currentSettings();
    const next = nextRate(target.rate, direction, recall.get(frameId) ?? null, settings.rateStep);
    if (next === target.rate) return target.rate;
    const result = await deliver(tabId, target.id, 'command', { type: 'rate', value: next });
    await rememberCommand(host, { type: 'rate', value: next });
    const reported = result && typeof result === 'object' && 'rate' in result ? result.rate : undefined;
    return typeof reported === 'number' && Number.isFinite(reported) ? reported : next;
  }
  async function applyTransport(tabId: number, host: string, action: HotkeyAction) {
    const { media, failed } = await collect(tabId, host);
    const saved = lockedId(tabId, media, failed);
    if (saved && !media.some(item => item.id === saved)) return false;
    const settings = await currentSettings();
    const plan = planHotkey({ host, enabled: true, media, selectedId: saved }, action, undefined, undefined, settings.skipWithRate);
    if (!plan) return false;
    rememberSelection(tabId, plan.media.id);
    if (plan.command.type === 'mute') gestures.delete(tabId);
    try {
      await deliver(tabId, plan.media.id, 'command', plan.command);
    } catch (error) {
      if (plan.command.type === 'pip' && error instanceof Error) {
        const key = pipFailureKey(error.message);
        if (key) { showAction(tabId, key); return true; }
      }
      if (plan.command.type === 'frame' && error instanceof Error) {
        const key = frameFailureKey(error.message);
        if (key) { showAction(tabId, key); return true; }
      }
      throw error;
    }
    const key = actionHintKey(action, plan.media);
    const jumped = plan.command.type === 'skip' ? Math.abs(plan.command.value) : undefined;
    if (key) showAction(tabId, key, action.type === 'skip' ? jumped : undefined);
    return true;
  }
  async function performHotkey(tabId: number, host: string, action: HotkeyAction) {
    if (action.type === 'rate') {
      const rate = await applyRate(tabId, host, action.direction);
      if (rate === undefined) return { handled: false as const };
      showRate(tabId, rate);
      return { handled: true as const, rate };
    }
    if (action.type === 'volume') {
      const percent = await applyVolume(tabId, host, action.delta);
      if (percent === undefined) return { handled: false as const };
      reveal(tabId, percent);
      return { handled: true as const, percent };
    }
    return { handled: await applyTransport(tabId, host, action) };
  }
  async function runExtensionCommand(name: string, source?: { id?: number; url?: string }) {
    const raw = actionForCommand(name);
    if (!raw) return;
    try {
      let tabId = source?.id;
      let url = source?.url;
      if (typeof tabId !== 'number') {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        tabId = tab?.id;
        url = tab?.url;
      }
      if (typeof tabId !== 'number' || !Number.isInteger(tabId) || tabId < 0) return;
      if (!url) url = (await browser.tabs.get(tabId))?.url;
      if (!url || !/^https?:\/\//.test(url)) return;
      const pageUrl = url;
      await framesReady;
      const settings = await currentSettings();
      if (!isSiteEnabled(pageUrl, settings)) return;
      const action = applyVolumeStep(applySkipStep(raw, settings.skipSeconds), settings.volumeStep);
      await enqueueCommand(tabId, () => performHotkey(tabId, new URL(pageUrl).hostname, action));
    } catch { /* The active page has no controllable media. */ }
  }
  const extensionPage = (url?: string) => typeof url === 'string' && url.startsWith(browser.runtime.getURL('/'));
  async function listSounding(currentTabId?: number) {
    const [audible, muted] = await Promise.all([browser.tabs.query({ audible: true }), browser.tabs.query({ muted: true })]);
    return { tabs: soundingTabs([...audible, ...muted], currentTabId) };
  }
  async function focusTab(tabId: number) {
    const updated = await browser.tabs.update(tabId, { active: true });
    const windowId = updated?.windowId ?? (await browser.tabs.get(tabId)).windowId;
    if (typeof windowId === 'number' && windowId >= 0) await browser.windows.update(windowId, { focused: true });
    return { ok: true };
  }
  async function muteTab(tabId: number, muted: boolean) {
    const updated = await browser.tabs.update(tabId, { muted });
    return { ok: true, muted: updated?.mutedInfo?.muted === true };
  }
  async function deliver(tabId: number, id: string, type: 'command' | 'highlight' | 'hold', command?: unknown) {
    const [frame, localId] = id.split(':');
    const message = type === 'highlight'
      ? { namespace: 'ottertap', type, id: localId }
      : type === 'hold'
        ? { namespace: 'ottertap', type, id: localId, ...(command as { phase: 'start' | 'end'; rate?: number }) }
        : { namespace: 'ottertap', type, id: localId, command };
    const result = await browser.tabs.sendMessage(tabId, message, { frameId: Number(frame) });
    if (result?.error) throw new Error(result.error);
    return result;
  }
  try {
    browser.commands?.onCommand?.addListener((command, tab) => runExtensionCommand(command, tab));
  } catch { /* The build verifier does not provide the commands API. */ }
  async function openToolbarPopup(windowId: number | undefined) {
    const open = browser.action?.openPopup;
    if (typeof open !== 'function') return false;
    try {
      await open(typeof windowId === 'number' ? { windowId } : undefined);
      return true;
    } catch {
      return false;
    }
  }
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id || !message || message.namespace !== 'ottertap') return;
    if (message.type === 'altUsed') {
      if (sender.tab?.id !== undefined) void browser.tabs.sendMessage(sender.tab.id, { namespace: 'ottertap', type: 'altUsed' }).catch(() => {});
      return;
    }
    if (!['options', 'context', 'register', 'read', 'command', 'select', 'highlight', 'hotkey', 'holdRate', 'soundingTabs', 'focusTab', 'muteTab', 'rateLock', 'openPopup'].includes(message.type)) return;
    const tabId = sender.tab?.id ?? message.tabId;
    async function handle() {
      if (message.type === 'openPopup') {
        const tab = sender.tab;
        const id = tab?.id;
        if (typeof id !== 'number') return { ok: false };
        const mediaId = typeof message.id === 'string' && /^\d+:\d+$/.test(message.id) ? message.id : '';
        if (mediaId) rememberSelection(id, mediaId);
        return { ok: await openToolbarPopup(typeof tab?.windowId === 'number' ? tab.windowId : undefined) };
      }
      if (message.type === 'options') { await browser.runtime.openOptionsPage(); return { ok: true }; }
      if (message.type === 'soundingTabs' || message.type === 'focusTab' || message.type === 'muteTab') {
        if (!extensionPage(sender.url)) return { error: i18n.t('extensionMessageFailed') };
        try {
          const targetId = message.tabId;
          if (message.type === 'soundingTabs') return await listSounding(Number.isInteger(targetId) ? targetId : undefined);
          if (!Number.isInteger(targetId) || targetId < 0) return { error: i18n.t('invalidCommand') };
          if (message.type === 'focusTab') return await focusTab(targetId);
          if (typeof message.muted !== 'boolean') return { error: i18n.t('invalidCommand') };
          return await muteTab(targetId, message.muted);
        } catch (error) { return { error: error instanceof Error ? error.message : i18n.t('pageUnavailable') }; }
      }
      if (!Number.isInteger(tabId)) return { error: i18n.t('noTab') };
      try {
        await sessionReady;
        const url = sender.tab?.url || (await browser.tabs.get(tabId))?.url;
        if (!url || !/^https?:\/\//.test(url)) throw new Error(i18n.t('pageNotAllowed'));
        const settings = await currentSettings();
        const enabled = isSiteEnabled(url, settings);
        const host = new URL(url).hostname;
        if (message.type === 'context') return { enabled, host, url, hasMedia: hasMedia(tabId), lockRate: settings.lockRate, holdBoost: settings.holdBoost, holdBoostRate: settings.holdBoostRate, holdSkip: settings.holdSkip, singleKey: settings.singleKey, hoverWheel: settings.hoverWheel, skipSeconds: settings.skipSeconds, volumeStep: settings.volumeStep, keybinds: settings.keybinds, ...localSelection(tabId, sender.frameId ?? 0) };
        if (message.type === 'rateLock') { showRateLock(tabId); return { ok: true }; }
        if (message.type === 'register' && sender.tab) {
          const frameId = sender.frameId ?? 0;
          if (!enabled) { frames.delete(tabId); volumes.delete(tabId); clearVolumeTimer(tabId); paintBadge(tabId, Date.now()); publishMedia(tabId); persistFrames(); return; }
          if (message.present === false) {
            const known = frames.get(tabId);
            const removed = known?.delete(frameId) === true;
            if (known && !known.size) frames.delete(tabId);
            rememberVolume(tabId, frameId, 0);
            publishMedia(tabId);
            if (removed) persistFrames();
            return;
          }
          const known = frames.get(tabId) ?? new Set<number>();
          const added = !known.has(frameId);
          known.add(frameId);
          frames.set(tabId, known);
          if (typeof message.volume === 'number' && Number.isFinite(message.volume)) rememberVolume(tabId, frameId, message.volume);
          publishMedia(tabId);
          if (added) persistFrames();
          return;
        }
        // Only extension pages and this tab's content scripts can request controls.
        if (!sender.tab && !sender.url?.startsWith(browser.runtime.getURL('/'))) return;
        const mediaId = typeof message.id === 'string' && /^\d+:\d+$/.test(message.id) ? message.id : '';
        if (message.type === 'read') {
          if (!enabled) return { host, enabled, media: [], selectedId: '' };
          const { media, failed } = await collect(tabId, host);
          const selectedId = lockedId(tabId, media, failed);
          const target = lockedMedia(media, selectedId);
          if (target && await applySitePref(tabId, host, target.id, settings.sitePrefs, settings.defaultRate)) {
            const refreshed = await collect(tabId, host);
            return { host, enabled, media: refreshed.media, selectedId: lockedId(tabId, refreshed.media, refreshed.failed) };
          }
          return { host, enabled, media, selectedId };
        }
        if (message.type === 'holdRate' && message.phase === 'end') { await endHold(tabId); return { ok: true }; }
        if (!enabled) throw new Error(i18n.t('siteDisabled'));
        if (message.type === 'select') {
          if (!mediaId) throw new Error(i18n.t('invalidCommand'));
          if (gestures.get(tabId)?.id !== mediaId) gestures.delete(tabId);
          rememberSelection(tabId, mediaId);
          await applySitePref(tabId, host, mediaId, settings.sitePrefs, settings.defaultRate);
          return { ok: true };
        }
        if (message.type === 'highlight') {
          if (!mediaId) throw new Error(i18n.t('invalidCommand'));
          await deliver(tabId, mediaId, 'highlight');
          return { ok: true };
        }
        if (message.type === 'holdRate') {
          if (!settings.holdBoost) return { handled: false };
          return { handled: await startHold(tabId, host, settings.holdBoostRate) };
        }
        if (message.type === 'hotkey') {
          if (!isHotkeyAction(message.action)) throw new Error(i18n.t('invalidCommand'));
          // Hover and focus gestures act on the media under them, and that media becomes the locked one.
          if (sender.tab && typeof message.target === 'string' && /^\d+$/.test(message.target)) {
            const pointed = `${sender.frameId ?? 0}:${message.target}`;
            if (selectedIds.get(tabId) !== pointed) { rememberSelection(tabId, pointed); gestures.delete(tabId); }
          }
          return await performHotkey(tabId, host, message.action);
        }
        if (message.type === 'command') {
          if (!isMediaCommand(message.command) || !mediaId) throw new Error(i18n.t('invalidCommand'));
          if (message.command.type === 'volume' || message.command.type === 'mute') gestures.delete(tabId);
          await deliver(tabId, mediaId, 'command', message.command);
          await rememberCommand(host, message.command);
          return { ok: true };
        }
      } catch (error) { return { error: error instanceof Error ? error.message : i18n.t('pageUnavailable') }; }
    }
    // Chain before the first await so a later command cannot pass an earlier one.
    const run = (message.type === 'command' || message.type === 'hotkey' || message.type === 'holdRate') && Number.isInteger(tabId) ? enqueueCommand(tabId, () => handle()) : handle();
    // Keep the channel open on Chromium versions without Promise listener support.
    void run.then(sendResponse, () => sendResponse({ error: i18n.t('extensionMessageFailed') }));
    return true;
  });
});
