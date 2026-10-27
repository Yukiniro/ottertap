import { i18n } from '#i18n';
import { atom, createStore, type Atom, type WritableAtom } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { sameKeybinds, type Keybinds } from './keybinds';
import { mergeSettingsChange, normalizeSettings } from './settings';
import { defaultSettings, type FloatingNote, type FloatingPosition, type RateStep, type Settings, type SettingsStore, type SiteMode, type SitePref, type SkipSeconds, type Theme, type VolumeStep, type WheelDirection } from './types';

const readError = () => i18n.t('settingsReadError');
const writeError = () => i18n.t('settingsWriteError');
const samePosition = (a: FloatingPosition, b: FloatingPosition) => a.side === b.side && a.y === b.y;
const sameSites = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((site, index) => site === b[index]);
const samePresets = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((rate, index) => rate === b[index]);
const sameSitePref = (a: SitePref, b: SitePref) => a.volume === b.volume && a.rate === b.rate && a.channel === b.channel;
const sameSitePrefs = (a: Record<string, SitePref>, b: Record<string, SitePref>) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => !!b[key] && sameSitePref(a[key]!, b[key]!));
};
const sameSettings = (a: Settings, b: Settings) => a.theme === b.theme && a.floating === b.floating && a.floatingNote === b.floatingNote && a.floatingWhilePlaying === b.floatingWhilePlaying && a.followPlaying === b.followPlaying && sameSites(a.floatingHiddenSites, b.floatingHiddenSites) && a.defaultRate === b.defaultRate && a.lockRate === b.lockRate && a.holdBoost === b.holdBoost && a.holdBoostRate === b.holdBoostRate && a.holdSkip === b.holdSkip && a.hoverWheel === b.hoverWheel && a.fullscreenWheel === b.fullscreenWheel && a.singleKey === b.singleKey && a.skipSeconds === b.skipSeconds && a.skipWithRate === b.skipWithRate && a.volumeStep === b.volumeStep && a.coarseStep === b.coarseStep && a.fineWheel === b.fineWheel && a.wheelDirection === b.wheelDirection && a.rateStep === b.rateStep && a.siteMode === b.siteMode && samePosition(a.floatingPosition, b.floatingPosition) && sameSites(a.sites, b.sites) && sameSitePrefs(a.sitePrefs, b.sitePrefs) && samePresets(a.ratePresets, b.ratePresets) && sameKeybinds(a.keybinds, b.keybinds);

function mergeSettings(current: Settings, update: Partial<Settings>): Settings {
  const next = normalizeSettings({ ...current, ...update });
  return {
    ...next,
    floatingPosition: samePosition(current.floatingPosition, next.floatingPosition) ? current.floatingPosition : next.floatingPosition,
    floatingHiddenSites: sameSites(current.floatingHiddenSites, next.floatingHiddenSites) ? current.floatingHiddenSites : next.floatingHiddenSites,
    sites: sameSites(current.sites, next.sites) ? current.sites : next.sites,
    sitePrefs: sameSitePrefs(current.sitePrefs, next.sitePrefs) ? current.sitePrefs : next.sitePrefs,
    ratePresets: samePresets(current.ratePresets, next.ratePresets) ? current.ratePresets : next.ratePresets,
    keybinds: sameKeybinds(current.keybinds, next.keybinds) ? current.keybinds : next.keybinds
  };
}

export interface SettingsAtoms {
  store: ReturnType<typeof createStore>;
  settingsAtom: Atom<Settings>;
  themeAtom: Atom<Theme>;
  floatingAtom: Atom<boolean>;
  floatingNoteAtom: Atom<FloatingNote>;
  floatingWhilePlayingAtom: Atom<boolean>;
  followPlayingAtom: Atom<boolean>;
  floatingHiddenSitesAtom: Atom<string[]>;
  defaultRateAtom: Atom<number | null>;
  lockRateAtom: Atom<boolean>;
  holdBoostAtom: Atom<boolean>;
  holdBoostRateAtom: Atom<number>;
  holdSkipAtom: Atom<boolean>;
  hoverWheelAtom: Atom<boolean>;
  fullscreenWheelAtom: Atom<boolean>;
  singleKeyAtom: Atom<boolean>;
  skipSecondsAtom: Atom<SkipSeconds>;
  skipWithRateAtom: Atom<boolean>;
  volumeStepAtom: Atom<VolumeStep>;
  coarseStepAtom: Atom<VolumeStep>;
  fineWheelAtom: Atom<boolean>;
  wheelDirectionAtom: Atom<WheelDirection>;
  rateStepAtom: Atom<RateStep>;
  floatingPositionAtom: Atom<FloatingPosition>;
  siteModeAtom: Atom<SiteMode>;
  sitesAtom: Atom<string[]>;
  sitePrefsAtom: Atom<Record<string, SitePref>>;
  ratePresetsAtom: Atom<number[]>;
  keybindsAtom: Atom<Keybinds>;
  loadingAtom: Atom<boolean>;
  errorAtom: Atom<string>;
  writeSettingsAtom: WritableAtom<null, [Partial<Settings>, boolean?], Promise<boolean>>;
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
  const floatingNoteAtom = selectAtom(settingsAtom, settings => settings.floatingNote);
  const floatingWhilePlayingAtom = selectAtom(settingsAtom, settings => settings.floatingWhilePlaying);
  const followPlayingAtom = selectAtom(settingsAtom, settings => settings.followPlaying);
  const floatingHiddenSitesAtom = selectAtom(settingsAtom, settings => settings.floatingHiddenSites);
  const defaultRateAtom = selectAtom(settingsAtom, settings => settings.defaultRate);
  const lockRateAtom = selectAtom(settingsAtom, settings => settings.lockRate);
  const holdBoostAtom = selectAtom(settingsAtom, settings => settings.holdBoost);
  const holdBoostRateAtom = selectAtom(settingsAtom, settings => settings.holdBoostRate);
  const holdSkipAtom = selectAtom(settingsAtom, settings => settings.holdSkip);
  const hoverWheelAtom = selectAtom(settingsAtom, settings => settings.hoverWheel);
  const fullscreenWheelAtom = selectAtom(settingsAtom, settings => settings.fullscreenWheel);
  const singleKeyAtom = selectAtom(settingsAtom, settings => settings.singleKey);
  const skipSecondsAtom = selectAtom(settingsAtom, settings => settings.skipSeconds);
  const skipWithRateAtom = selectAtom(settingsAtom, settings => settings.skipWithRate);
  const volumeStepAtom = selectAtom(settingsAtom, settings => settings.volumeStep);
  const coarseStepAtom = selectAtom(settingsAtom, settings => settings.coarseStep);
  const fineWheelAtom = selectAtom(settingsAtom, settings => settings.fineWheel);
  const wheelDirectionAtom = selectAtom(settingsAtom, settings => settings.wheelDirection);
  const rateStepAtom = selectAtom(settingsAtom, settings => settings.rateStep);
  const floatingPositionAtom = selectAtom(settingsAtom, settings => settings.floatingPosition);
  const siteModeAtom = selectAtom(settingsAtom, settings => settings.siteMode);
  const sitesAtom = selectAtom(settingsAtom, settings => settings.sites);
  const sitePrefsAtom = selectAtom(settingsAtom, settings => settings.sitePrefs);
  const ratePresetsAtom = selectAtom(settingsAtom, settings => settings.ratePresets);
  const keybindsAtom = selectAtom(settingsAtom, settings => settings.keybinds);
  let writeQueue = Promise.resolve();
  let writeVersion = 0;
  let pendingWrites = 0;
  let idle = Promise.resolve();
  let resolveReady = () => {};
  const ready = new Promise<void>(resolve => { resolveReady = resolve; });
  let readySettled = false;
  const finishReady = () => { if (!readySettled) { readySettled = true; resolveReady(); } };

  const writeSettingsAtom = atom(null, (_get, _set, update: Partial<Settings>, replace: boolean = false) => {
    const previous = store.get(settingsAtom);
    store.set(settingsAtom, mergeSettings(previous, update));
    const version = ++writeVersion;
    pendingWrites += 1;
    const task = writeQueue.then(async () => {
      let stored: Settings | undefined;
      try {
        stored = await source.load();
        const next = replace ? normalizeSettings(update) : mergeSettingsChange(stored, previous, mergeSettings(previous, update));
        await source.save(next, stored, replace);
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
    store, settingsAtom, themeAtom, floatingAtom, floatingNoteAtom, floatingWhilePlayingAtom, followPlayingAtom, floatingHiddenSitesAtom, defaultRateAtom, lockRateAtom, holdBoostAtom, holdBoostRateAtom, holdSkipAtom, hoverWheelAtom, fullscreenWheelAtom, singleKeyAtom, skipSecondsAtom, skipWithRateAtom, volumeStepAtom, coarseStepAtom, fineWheelAtom, wheelDirectionAtom, rateStepAtom, floatingPositionAtom, siteModeAtom, sitesAtom, sitePrefsAtom, ratePresetsAtom, keybindsAtom, loadingAtom, errorAtom, writeSettingsAtom, mount, ready,
    settled: () => idle
  };
}
