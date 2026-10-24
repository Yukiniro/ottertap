import { i18n } from '#i18n';
import { isChannelMode, maxGain } from './amplifier';
import { normalizeKeybinds } from './keybinds';
import { clampRate, formatRate, maxRate, minRate, normalizeRatePresets, normalizeRateStep, rateGrid } from './rate';
export { isRateStep } from './rate';
import { defaultSettings, floatingNotes, skipSteps, volumeSteps, wheelDirections, type FloatingNote, type MediaCommand, type Settings, type SitePref, type SkipSeconds, type VolumeStep, type WheelDirection } from './types';
const matchesSite = (host: string, site: string) => host === site || host.endsWith(`.${site}`);

export function isSkipSeconds(value: unknown): value is SkipSeconds {
  return typeof value === 'number' && (skipSteps as readonly number[]).includes(value);
}

export function normalizeSkipSeconds(value: unknown): SkipSeconds {
  return isSkipSeconds(value) ? value : 10;
}

export function isVolumeStep(value: unknown): value is VolumeStep {
  return typeof value === 'number' && (volumeSteps as readonly number[]).includes(value);
}

export function isFloatingNote(value: unknown): value is FloatingNote {
  return typeof value === 'string' && (floatingNotes as readonly string[]).includes(value);
}

export function normalizeVolumeStep(value: unknown): VolumeStep {
  return isVolumeStep(value) ? value : 10;
}

/** Shift+wheel step. Missing or unusable values stay at 20, so the coarse tier differs from the 10% volume step. */
export function normalizeCoarseStep(value: unknown): VolumeStep {
  return isVolumeStep(value) ? value : defaultSettings.coarseStep;
}

export function isWheelDirection(value: unknown): value is WheelDirection {
  return typeof value === 'string' && (wheelDirections as readonly string[]).includes(value);
}

/** Missing or unusable values stay scroll-up raises volume. */
export function normalizeWheelDirection(value: unknown): WheelDirection {
  return isWheelDirection(value) ? value : 'up';
}

/** `null` follows the page. Other finite numbers snap onto the 0.25 grid inside min–max. */
export function normalizeDefaultRate(value: unknown): number | null {
  if (value == null || typeof value !== 'number' || !Number.isFinite(value)) return null;
  const snapped = Number(formatRate(Math.round(clampRate(value) / rateGrid) * rateGrid));
  return snapped >= minRate && snapped <= maxRate ? snapped : null;
}

/** Temporary hold speed. Same 0.25 grid as the built-in presets. Missing or unusable values stay at 2×. */
export function normalizeHoldRate(value: unknown): number {
  return normalizeDefaultRate(value) ?? defaultSettings.holdBoostRate;
}

export function normalizeDomain(input: string): string {
  const text = input.trim().toLowerCase();
  if (!text) throw new Error(i18n.t('domainRequired'));
  const wildcard = text.startsWith('*.');
  const value = wildcard ? text.slice(2) : text;
  let url: URL;
  try { url = new URL(value.includes('://') ? value : `https://${value}`); }
  catch { throw new Error(i18n.t('domainInvalid')); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname || /[\s*]/.test(url.hostname)) {
    throw new Error(i18n.t('domainProtocol'));
  }
  return url.hostname.replace(/\.$/, '');
}

function normalizeDomains(value: unknown): string[] {
  const sites: string[] = [];
  if (Array.isArray(value)) for (const site of value) {
    if (typeof site !== 'string') continue;
    try { sites.push(normalizeDomain(site)); } catch { /* Ignore invalid saved entries. */ }
  }
  return [...new Set(sites)];
}

export function normalizeSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') return { ...defaultSettings, floatingHiddenSites: [], sites: [], sitePrefs: {}, ratePresets: [...defaultSettings.ratePresets], keybinds: { ...defaultSettings.keybinds } };
  const source = value as Partial<Settings>;
  const position = source.floatingPosition;
  const validPosition = !!position && typeof position === 'object' && ['left', 'right'].includes(position.side) && Number.isFinite(position.y) && position.y >= 0 && position.y <= 1;
  return {
    theme: ['light', 'dark', 'system'].includes(source.theme ?? '') ? source.theme! : 'system',
    floating: typeof source.floating === 'boolean' ? source.floating : true,
    floatingPosition: validPosition ? { side: position.side, y: position.y } : { ...defaultSettings.floatingPosition },
    floatingNote: isFloatingNote(source.floatingNote) ? source.floatingNote : 'volume',
    floatingWhilePlaying: source.floatingWhilePlaying === true,
    floatingHiddenSites: normalizeDomains(source.floatingHiddenSites),
    siteMode: ['all', 'allow', 'exclude'].includes(source.siteMode ?? '') ? source.siteMode! : 'all',
    sites: normalizeDomains(source.sites),
    sitePrefs: normalizeSitePrefs(source.sitePrefs),
    ratePresets: normalizeRatePresets(source.ratePresets),
    defaultRate: normalizeDefaultRate(source.defaultRate),
    lockRate: source.lockRate === true,
    holdBoost: source.holdBoost === true,
    holdBoostRate: normalizeHoldRate(source.holdBoostRate),
    holdSkip: source.holdSkip === true,
    hoverWheel: typeof source.hoverWheel === 'boolean' ? source.hoverWheel : true,
    fullscreenWheel: source.fullscreenWheel === true,
    singleKey: source.singleKey === true,
    skipSeconds: normalizeSkipSeconds(source.skipSeconds),
    skipWithRate: source.skipWithRate === true,
    volumeStep: normalizeVolumeStep(source.volumeStep),
    coarseStep: normalizeCoarseStep(source.coarseStep),
    fineWheel: typeof source.fineWheel === 'boolean' ? source.fineWheel : true,
    wheelDirection: normalizeWheelDirection(source.wheelDirection),
    rateStep: normalizeRateStep(source.rateStep),
    keybinds: normalizeKeybinds(source.keybinds)
  };
}

export function hostKey(host: string) {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

function sanitizeSitePref(value: unknown): SitePref {
  if (!value || typeof value !== 'object') return {};
  const source = value as { volume?: unknown; rate?: unknown; channel?: unknown };
  const pref: SitePref = {};
  if (typeof source.volume === 'number' && Number.isFinite(source.volume) && source.volume >= 0 && source.volume <= maxGain) pref.volume = source.volume;
  if (typeof source.rate === 'number' && Number.isFinite(source.rate) && source.rate >= minRate && source.rate <= maxRate) pref.rate = source.rate;
  if (isChannelMode(source.channel) && source.channel !== 'stereo') pref.channel = source.channel;
  return pref;
}

const emptyPref = (pref: SitePref) => pref.volume === undefined && pref.rate === undefined && pref.channel === undefined;

function normalizeSitePrefs(value: unknown): Record<string, SitePref> {
  if (!value || typeof value !== 'object') return {};
  const prefs: Record<string, SitePref> = {};
  for (const [key, raw] of Object.entries(value)) {
    let host: string;
    try { host = normalizeDomain(key); } catch { continue; }
    const pref = sanitizeSitePref(raw);
    if (emptyPref(pref)) continue;
    prefs[host] = pref;
  }
  return prefs;
}

export function sitePrefFor(host: string, prefs: Record<string, SitePref>): { host: string; pref: SitePref } | null {
  const name = hostKey(host);
  if (!name) return null;
  let best: { host: string; pref: SitePref } | null = null;
  for (const [site, pref] of Object.entries(prefs)) {
    if (!matchesSite(name, site)) continue;
    if (!best || site.length > best.host.length) best = { host: site, pref };
  }
  return best;
}

export function rememberSite(prefs: Record<string, SitePref>, host: string, pref: SitePref): Record<string, SitePref> {
  let key: string;
  try { key = normalizeDomain(hostKey(host)); } catch { return prefs; }
  const stored = sanitizeSitePref(pref);
  if (emptyPref(stored)) return prefs;
  return { ...prefs, [key]: stored };
}

export function forgetMatchingSites(prefs: Record<string, SitePref>, host: string): Record<string, SitePref> {
  const name = hostKey(host);
  if (!name) return prefs;
  let changed = false;
  const next: Record<string, SitePref> = {};
  for (const [site, pref] of Object.entries(prefs)) {
    if (matchesSite(name, site)) { changed = true; continue; }
    next[site] = pref;
  }
  return changed ? next : prefs;
}

export function forgetSitePref(prefs: Record<string, SitePref>, site: string): Record<string, SitePref> {
  if (!(site in prefs)) return prefs;
  const next = { ...prefs };
  delete next[site];
  return next;
}

export function isFloatingHidden(host: string, sites: readonly string[]) {
  const name = hostKey(host);
  return !!name && sites.some(site => matchesSite(name, site));
}

export function hideFloating(sites: string[], host: string): string[] {
  if (isFloatingHidden(host, sites)) return sites;
  let key: string;
  try { key = normalizeDomain(hostKey(host)); } catch { return sites; }
  return [...sites, key];
}

/** Removes every entry covering `host`, including a parent domain, so the entry really comes back. */
export function showFloating(sites: string[], host: string): string[] {
  const name = hostKey(host);
  const next = sites.filter(site => !matchesSite(name, site));
  return next.length === sites.length ? sites : next;
}

export function withRememberedCommand(prefs: Record<string, SitePref>, host: string, command: MediaCommand): Record<string, SitePref> | null {
  if (command.type === 'channel') {
    const match = sitePrefFor(host, prefs);
    if (!match || !isChannelMode(command.value) || (match.pref.channel ?? 'stereo') === command.value) return null;
    const pref: SitePref = { ...match.pref };
    if (command.value === 'stereo') delete pref.channel;
    else pref.channel = command.value;
    if (emptyPref(pref)) return forgetSitePref(prefs, match.host);
    return { ...prefs, [match.host]: pref };
  }
  if (command.type !== 'volume' && command.type !== 'rate') return null;
  const match = sitePrefFor(host, prefs);
  if (!match) return null;
  const stored = sanitizeSitePref(command.type === 'volume' ? { volume: command.value } : { rate: command.value });
  const value = command.type === 'volume' ? stored.volume : stored.rate;
  if (value === undefined || match.pref[command.type] === value) return null;
  return { ...prefs, [match.host]: { ...match.pref, [command.type]: value } };
}

export function createSitePrefSession() {
  const applied = new Set<string>();
  return {
    reset() { applied.clear(); },
    plan(host: string, mediaId: string, prefs: Record<string, SitePref>, defaultRate: number | null = null): MediaCommand[] {
      const name = hostKey(host);
      if (!name || !mediaId) return [];
      const key = `${name}\0${mediaId}`;
      if (applied.has(key)) return [];
      applied.add(key);
      const match = sitePrefFor(name, prefs);
      const commands: MediaCommand[] = [];
      if (match?.pref.volume !== undefined) commands.push({ type: 'volume', value: match.pref.volume });
      const rate = match?.pref.rate !== undefined ? match.pref.rate : defaultRate;
      if (rate != null) commands.push({ type: 'rate', value: rate });
      if (match?.pref.channel !== undefined) commands.push({ type: 'channel', value: match.pref.channel });
      return commands;
    }
  };
}

export function disableSite(host: string, settings: Settings): { label: string; settings: Partial<Settings> } {
  if (settings.siteMode === 'allow') {
    const matched = settings.sites.filter(site => matchesSite(host, site));
    return { label: i18n.t('disableSite', { host: matched.join(i18n.t('listSeparator')) || host }), settings: { siteMode: 'allow', sites: settings.sites.filter(site => !matched.includes(site)) } };
  }
  const sites = settings.sites.includes(host) ? settings.sites : [...settings.sites, host];
  return { label: i18n.t('disableSite', { host }), settings: { siteMode: 'exclude', sites } };
}

export function enableSite(host: string, settings: Settings): { label: string; settings: Partial<Settings> | null } {
  if (settings.siteMode === 'allow') {
    const sites = settings.sites.includes(host) ? settings.sites : [...settings.sites, host];
    return { label: i18n.t('enableSite', { host }), settings: { sites } };
  }
  if (settings.siteMode === 'exclude' && settings.sites.includes(host)) return { label: i18n.t('enableSite', { host }), settings: { sites: settings.sites.filter(site => site !== host) } };
  return { label: i18n.t('manageSites'), settings: null };
}

export function isSiteEnabled(url: string, settings: Settings) {
  let host: string;
  try { const parsed = new URL(url); if (!['https:', 'http:'].includes(parsed.protocol)) return false; host = parsed.hostname.toLowerCase().replace(/\.$/, ''); }
  catch { return false; }
  const matches = settings.sites.some(site => matchesSite(host, site));
  return settings.siteMode === 'all' || (settings.siteMode === 'allow' ? matches : !matches);
}
