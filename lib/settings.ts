import { defaultSettings, type Settings } from './types';

export function normalizeDomain(input: string): string {
  const text = input.trim().toLowerCase();
  if (!text) throw new Error('请输入网站域名。');
  const wildcard = text.startsWith('*.');
  const value = wildcard ? text.slice(2) : text;
  let url: URL;
  try { url = new URL(value.includes('://') ? value : `https://${value}`); }
  catch { throw new Error('请输入有效的域名，例如 bilibili.com。'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname || /[\s*]/.test(url.hostname)) {
    throw new Error('仅支持 HTTP / HTTPS 网站域名。');
  }
  return url.hostname.replace(/\.$/, '');
}

export function normalizeSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') return { ...defaultSettings, sites: [] };
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
    sites: [...new Set(sites)]
  };
}

export function isSiteEnabled(url: string, settings: Settings) {
  let host: string;
  try { const parsed = new URL(url); if (!['https:', 'http:'].includes(parsed.protocol)) return false; host = parsed.hostname.toLowerCase().replace(/\.$/, ''); }
  catch { return false; }
  const matches = settings.sites.some(site => host === site || host.endsWith(`.${site}`));
  return settings.siteMode === 'all' || (settings.siteMode === 'allow' ? matches : !matches);
}
