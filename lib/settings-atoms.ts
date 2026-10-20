import { i18n } from '#i18n';
import { atom, createStore, type Atom, type WritableAtom } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { normalizeSettings } from './settings';
import { defaultSettings, type FloatingPosition, type Settings, type SettingsStore, type SiteMode, type SitePref, type Theme } from './types';

const readError = () => i18n.t('settingsReadError');
const writeError = () => i18n.t('settingsWriteError');
const samePosition = (a: FloatingPosition, b: FloatingPosition) => a.side === b.side && a.y === b.y;
const sameSites = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((site, index) => site === b[index]);
const samePresets = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((rate, index) => rate === b[index]);
const sameSitePref = (a: SitePref, b: SitePref) => a.volume === b.volume && a.rate === b.rate;
const sameSitePrefs = (a: Record<string, SitePref>, b: Record<string, SitePref>) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => !!b[key] && sameSitePref(a[key]!, b[key]!));
};
const sameSettings = (a: Settings, b: Settings) => a.theme === b.theme && a.floating === b.floating && a.lockRate === b.lockRate && a.hoverWheel === b.hoverWheel && a.singleKey === b.singleKey && a.siteMode === b.siteMode && samePosition(a.floatingPosition, b.floatingPosition) && sameSites(a.sites, b.sites) && sameSitePrefs(a.sitePrefs, b.sitePrefs) && samePresets(a.ratePresets, b.ratePresets);

function mergeSettings(current: Settings, update: Partial<Settings>): Settings {
  const next = normalizeSettings({ ...current, ...update });
  return {
    ...next,
    floatingPosition: samePosition(current.floatingPosition, next.floatingPosition) ? current.floatingPosition : next.floatingPosition,
    sites: sameSites(current.sites, next.sites) ? current.sites : next.sites,
    sitePrefs: sameSitePrefs(current.sitePrefs, next.sitePrefs) ? current.sitePrefs : next.sitePrefs,
    ratePresets: samePresets(current.ratePresets, next.ratePresets) ? current.ratePresets : next.ratePresets
  };
}

export interface SettingsAtoms {
  store: ReturnType<typeof createStore>;
  settingsAtom: Atom<Settings>;
  themeAtom: Atom<Theme>;
  floatingAtom: Atom<boolean>;
  lockRateAtom: Atom<boolean>;
  hoverWheelAtom: Atom<boolean>;
  singleKeyAtom: Atom<boolean>;
  floatingPositionAtom: Atom<FloatingPosition>;
  siteModeAtom: Atom<SiteMode>;
  sitesAtom: Atom<string[]>;
  sitePrefsAtom: Atom<Record<string, SitePref>>;
  ratePresetsAtom: Atom<number[]>;
  loadingAtom: Atom<boolean>;
  errorAtom: Atom<string>;
  writeSettingsAtom: WritableAtom<null, [Partial<Settings>], Promise<boolean>>;
  mount: () => () => void;
  ready: Promise<void>;
  settled: () => Promise<void>;
}

export function createSettingsAtoms(source: SettingsStore, options?: { initialLoading?: boolean }): SettingsAtoms {
  const store = createStore();
  const settingsAtom = atom(defaultSettings);
  const loadingAtom = atom(options?.initialLoading ?? true);
  const errorAtom = atom('');
  const themeAtom = selectAtom(settingsAtom, settings => settings.theme);
  const floatingAtom = selectAtom(settingsAtom, settings => settings.floating);
  const lockRateAtom = selectAtom(settingsAtom, settings => settings.lockRate);
  const hoverWheelAtom = selectAtom(settingsAtom, settings => settings.hoverWheel);
  const singleKeyAtom = selectAtom(settingsAtom, settings => settings.singleKey);
  const floatingPositionAtom = selectAtom(settingsAtom, settings => settings.floatingPosition);
  const siteModeAtom = selectAtom(settingsAtom, settings => settings.siteMode);
  const sitesAtom = selectAtom(settingsAtom, settings => settings.sites);
  const sitePrefsAtom = selectAtom(settingsAtom, settings => settings.sitePrefs);
  const ratePresetsAtom = selectAtom(settingsAtom, settings => settings.ratePresets);
  let writeQueue = Promise.resolve();
  let writeVersion = 0;
  let pendingWrites = 0;
  let idle = Promise.resolve();
  let resolveReady = () => {};
  const ready = new Promise<void>(resolve => { resolveReady = resolve; });
  let readySettled = false;
  const finishReady = () => { if (!readySettled) { readySettled = true; resolveReady(); } };

  const writeSettingsAtom = atom(null, (_get, _set, update: Partial<Settings>) => {
    const previous = store.get(settingsAtom);
    store.set(settingsAtom, mergeSettings(previous, update));
    const version = ++writeVersion;
    pendingWrites += 1;
    const task = writeQueue.then(async () => {
      let stored: Settings | undefined;
      try {
        stored = await source.load();
        const next = mergeSettings(stored, update);
        await source.save(next);
        if (version === writeVersion) {
          if (!sameSettings(store.get(settingsAtom), next)) store.set(settingsAtom, next);
          store.set(errorAtom, '');
        }
        return true;
      } catch {
        if (version === writeVersion) {
          store.set(settingsAtom, stored ?? previous);
          store.set(errorAtom, writeError());
        }
        return false;
      } finally { pendingWrites -= 1; }
    });
    writeQueue = task.then(() => undefined, () => undefined);
    return task;
  });

  function mount() {
    let active = true;
    let requested = false;
    let reading = false;
    let generation = 0;

    async function refresh() {
      if (reading) return;
      reading = true;
      try {
        while (requested && active) {
          const pending = writeQueue;
          await pending;
          if (!active) return;
          if (pendingWrites > 0) {
            if (writeQueue === pending) await new Promise(resolve => setTimeout(resolve, 0));
            continue;
          }
          requested = false;
          const readGeneration = generation;
          const readVersion = writeVersion;
          const stale = () => !active || readGeneration !== generation || readVersion !== writeVersion || pendingWrites > 0;
          try {
            const value = await source.load();
            if (stale()) { requested = true; continue; }
            if (!sameSettings(store.get(settingsAtom), value)) store.set(settingsAtom, value);
            store.set(loadingAtom, false);
            if (store.get(errorAtom) === readError()) store.set(errorAtom, '');
            finishReady();
          } catch {
            if (stale()) { requested = true; continue; }
            const firstLoad = store.get(loadingAtom);
            store.set(loadingAtom, false);
            if (firstLoad) store.set(errorAtom, readError());
            finishReady();
          }
        }
      } finally { reading = false; }
    }

    const requestRefresh = () => {
      generation += 1;
      requested = true;
      if (!reading) idle = refresh();
    };
    const unwatch = source.watch(() => requestRefresh());
    requestRefresh();
    return () => { active = false; unwatch(); };
  }

  return {
    store, settingsAtom, themeAtom, floatingAtom, lockRateAtom, hoverWheelAtom, singleKeyAtom, floatingPositionAtom, siteModeAtom, sitesAtom, sitePrefsAtom, ratePresetsAtom, loadingAtom, errorAtom, writeSettingsAtom, mount, ready,
    settled: () => idle
  };
}
