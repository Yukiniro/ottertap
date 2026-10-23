import { i18n } from '#i18n';
import { createHotkeySession, isTypingEvent, planHotkey, type HotkeyAction } from './hotkey';
import { createMediaController, lockedMedia } from './media';
import { createSitePrefSession, isSiteEnabled, normalizeSettings, withRememberedCommand } from './settings';
import { defaultSettings, type MediaClient, type Settings, type SettingsStore } from './types';

export function createDemoStore(key: string): SettingsStore {
  const listeners = new Set<(settings: Settings) => void>();
  return {
    async load() { try { return normalizeSettings(JSON.parse(localStorage.getItem(key) ?? 'null')); } catch { return normalizeSettings(null); } },
    async save(settings) { localStorage.setItem(key, JSON.stringify(settings)); for (const listener of listeners) listener(settings); },
    watch(callback) { listeners.add(callback); return () => { listeners.delete(callback); }; }
  };
}

export const demoUrl = 'https://bilibili.com/video/demo';
export const demoStartAt = 272;
export const demoVolume = .75;
export const demoRate = 1.25;

/** Silent local media driven by the real media controller, standing in for a page the extension controls. */
export function createDemo(document: Document, { src, title, store }: { src: string; title: string; store: SettingsStore }) {
  const create = (tag: 'video' | 'audio', label: string) => {
    const element = document.createElement(tag);
    element.src = src;
    element.preload = 'metadata';
    element.setAttribute('aria-label', label);
    element.hidden = true;
    document.body.append(element);
    return element;
  };
  const media = create('video', title);
  media.volume = demoVolume;
  media.playbackRate = demoRate;
  media.addEventListener('loadedmetadata', () => { media.currentTime = demoStartAt; });
  let second: HTMLAudioElement | null = null;
  const controller = createMediaController(document);
  const unwatchLock = store.watch(settings => controller.setLockRate(isSiteEnabled(demoUrl, settings) && settings.lockRate));
  void store.load().then(settings => controller.setLockRate(isSiteEnabled(demoUrl, settings) && settings.lockRate)).catch(() => {});
  const remembered = createSitePrefSession();
  const demoHost = new URL(demoUrl).host;
  let selectedId = '';
  const enabled = async () => isSiteEnabled(demoUrl, await store.load());
  const applyRemembered = async (id: string) => {
    const settings = await store.load();
    const commands = remembered.plan(demoHost, id, settings.sitePrefs, settings.defaultRate);
    for (const command of commands) {
      try { await controller.command(id, command); } catch { /* Once per visit. */ }
    }
    return commands.length > 0;
  };
  const client: MediaClient = {
    async read() {
      const on = await enabled();
      let items = on ? controller.snapshot() : [];
      if (selectedId && !items.some(item => item.id === selectedId)) selectedId = '';
      const target = on ? lockedMedia(items, selectedId) : undefined;
      if (target && await applyRemembered(target.id)) items = controller.snapshot();
      return { host: demoHost, enabled: on, media: items, selectedId };
    },
    async command(item, command) {
      if (!await enabled()) throw new Error(i18n.t('siteDisabled'));
      await controller.command(item.id, command);
      const settings = await store.load();
      const sitePrefs = withRememberedCommand(settings.sitePrefs, demoHost, command);
      if (sitePrefs) await store.save({ ...settings, sitePrefs });
    },
    async select(id) { selectedId = id; await applyRemembered(id); },
    async highlight(item) { controller.flash(item.id); }
  };
  const listenHotkeys = (window: Window) => {
    let on = true;
    let singleKey = false;
    let skipSeconds = defaultSettings.skipSeconds;
    let skipWithRate = defaultSettings.skipWithRate;
    let volumeStep = defaultSettings.volumeStep;
    let rateStep = defaultSettings.rateStep;
    let keybinds = defaultSettings.keybinds;
    const apply = (settings: Settings) => { on = isSiteEnabled(demoUrl, settings); singleKey = settings.singleKey; skipSeconds = settings.skipSeconds; skipWithRate = settings.skipWithRate; volumeStep = settings.volumeStep; rateStep = settings.rateStep; keybinds = settings.keybinds; };
    void store.load().then(apply);
    const unwatch = store.watch(apply);
    const hotkeys = createHotkeySession(async (action: HotkeyAction) => {
      const page = await client.read();
      const plan = planHotkey(page, action, controller.recallRate(), rateStep, skipWithRate);
      if (!plan) return;
      if (plan.media.id !== page.selectedId) await client.select(plan.media.id);
      await client.command(plan.media, plan.command);
    });
    const allow = () => on && controller.snapshot().length > 0;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Alt' || (allow() && !isTypingEvent(event))) hotkeys.key(event, { singleKey, skipSeconds, volumeStep, keybinds }); };
    const onWheel = (event: WheelEvent) => { if (allow()) hotkeys.wheel(event, undefined, volumeStep); };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => { unwatch(); hotkeys.dispose(); window.removeEventListener('keydown', onKey, true); window.removeEventListener('wheel', onWheel, true); };
  };
  return {
    media,
    client,
    listenHotkeys,
    async reset() { media.currentTime = demoStartAt; media.volume = demoVolume; media.playbackRate = demoRate; media.muted = false; await media.play(); },
    setSecond(label: string | null) {
      second?.remove();
      second = label === null ? null : create('audio', label);
    },
    destroy() { unwatchLock(); controller.destroy(); media.remove(); second?.remove(); }
  };
}
