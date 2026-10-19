import { i18n } from '#i18n';
import { maxGain } from './amplifier';
import { maxRate, minRate, normalizeRatePresets } from './rate';
import { defaultSettings, type MediaCommand, type Settings, type SitePref } from './types';
const matchesSite = (host: string, site: string) => host === site || host.endsWith(`.${site}`);

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

export function normalizeSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') return { ...defaultSettings, sites: [], sitePrefs: {}, ratePresets: [...defaultSettings.ratePresets] };
  const source = value as Partial<Settings>;
  const sites: string[] = [];
  if (Array.isArray(source.sites)) for (const site of source.sites) {
    if (typeof site !== 'string') continue;
    try { sites.push(normalizeDomain(site)); } catch { /* Ignore invalid saved entries. */ }
  }
  const position = source.floatingPosition;
  const validPosition = !!position && typeof position === 'object' && ['left', 'right'].includes(position.side) && Number.isFinite(position.y) && position.y >= 0 && position.y <= 1;
  return {
    theme: ['light', 'dark', 'system'].includes(source.theme ?? '') ? source.theme! : 'system',
    floating: typeof source.floating === 'boolean' ? source.floating : true,
    floatingPosition: validPosition ? { side: position.side, y: position.y } : { ...defaultSettings.floatingPosition },
    siteMode: ['all', 'allow', 'exclude'].includes(source.siteMode ?? '') ? source.siteMode! : 'all',
    sites: [...new Set(sites)],
    sitePrefs: normalizeSitePrefs(source.sitePrefs),
    ratePresets: normalizeRatePresets(source.ratePresets)
  };
}

export function hostKey(host: string) {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

function sanitizeSitePref(value: unknown): SitePref {
  if (!value || typeof value !== 'object') return {};
  const source = value as { volume?: unknown; rate?: unknown };
  const pref: SitePref = {};
  if (typeof source.volume === 'number' && Number.isFinite(source.volume) && source.volume >= 0 && source.volume <= maxGain) pref.volume = source.volume;
  if (typeof source.rate === 'number' && Number.isFinite(source.rate) && source.rate >= minRate && source.rate <= maxRate) pref.rate = source.rate;
  return pref;
}

function normalizeSitePrefs(value: unknown): Record<string, SitePref> {
  if (!value || typeof value !== 'object') return {};
  const prefs: Record<string, SitePref> = {};
  for (const [key, raw] of Object.entries(value)) {
    let host: string;
    try { host = normalizeDomain(key); } catch { continue; }
    const pref = sanitizeSitePref(raw);
    if (pref.volume === undefined && pref.rate === undefined) continue;
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
  if (stored.volume === undefined && stored.rate === undefined) return prefs;
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

export function withRememberedCommand(prefs: Record<string, SitePref>, host: string, command: MediaCommand): Record<string, SitePref> | null {
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
    plan(host: string, mediaId: string, prefs: Record<string, SitePref>): MediaCommand[] {
      const name = hostKey(host);
      if (!name || !mediaId) return [];
      const key = `${name}\0${mediaId}`;
      if (applied.has(key)) return [];
      applied.add(key);
      const match = sitePrefFor(name, prefs);
      if (!match) return [];
      const commands: MediaCommand[] = [];
      if (match.pref.volume !== undefined) commands.push({ type: 'volume', value: match.pref.volume });
      if (match.pref.rate !== undefined) commands.push({ type: 'rate', value: match.pref.rate });
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
