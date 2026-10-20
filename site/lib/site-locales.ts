export const siteUrl = 'https://ottertap.vercel.app';

export const locales = [
  { id: 'en', segment: '', path: '/', htmlLang: 'en', hreflang: 'en', ogLocale: 'en_US', file: 'en.yml' },
  { id: 'zh', segment: 'zh', path: '/zh/', htmlLang: 'zh-CN', hreflang: 'zh-CN', ogLocale: 'zh_CN', file: 'zh_CN.yml' },
  { id: 'zh-tw', segment: 'zh-tw', path: '/zh-tw/', htmlLang: 'zh-TW', hreflang: 'zh-TW', ogLocale: 'zh_TW', file: 'zh_TW.yml' },
  { id: 'ja', segment: 'ja', path: '/ja/', htmlLang: 'ja', hreflang: 'ja', ogLocale: 'ja_JP', file: 'ja.yml' },
  { id: 'ko', segment: 'ko', path: '/ko/', htmlLang: 'ko', hreflang: 'ko', ogLocale: 'ko_KR', file: 'ko.yml' },
  { id: 'es', segment: 'es', path: '/es/', htmlLang: 'es', hreflang: 'es', ogLocale: 'es_ES', file: 'es.yml' },
  { id: 'fr', segment: 'fr', path: '/fr/', htmlLang: 'fr', hreflang: 'fr', ogLocale: 'fr_FR', file: 'fr.yml' },
  { id: 'de', segment: 'de', path: '/de/', htmlLang: 'de', hreflang: 'de', ogLocale: 'de_DE', file: 'de.yml' }
] as const;

export type Lang = (typeof locales)[number]['id'];
export type Locale = (typeof locales)[number];

const CHROME_WEB_STORE = 'https://chromewebstore.google.com/detail/%E5%B0%8F%E7%8D%AD-ottertap-%C2%B7-%E7%BD%91%E9%A1%B5%E5%AA%92%E4%BD%93%E6%8E%A7%E5%88%B6/ipcjiedocfmjiamcjnpmmjckpegannmn';
// Reserved until an Edge Add-ons listing exists. Empty hides the Edge button.
const EDGE_ADDONS = '';

function storeUrl(value: string) {
  const url = value.trim();
  if (!url) return '';
  try {
    return new URL(url).protocol === 'https:' ? url : '';
  } catch {
    return '';
  }
}

export const links = {
  repo: 'https://github.com/Yukiniro/ottertap',
  releases: 'https://github.com/Yukiniro/ottertap/releases',
  latest: 'https://github.com/Yukiniro/ottertap/releases/latest',
  chromeWebStore: storeUrl(CHROME_WEB_STORE),
  edgeAddons: storeUrl(EDGE_ADDONS)
};

export type T = (key: string) => string;

export const languageAlternates: Record<string, string> = {
  ...Object.fromEntries(locales.map(locale => [locale.hreflang, siteUrl + locale.path])),
  'x-default': siteUrl + '/'
};

export const routedLocales = locales.filter(locale => locale.segment !== '');

export function localeById(id: Lang) {
  const locale = locales.find(item => item.id === id);
  if (!locale) throw new Error(`Unknown locale: ${id}`);
  return locale;
}

export function localeBySegment(segment: string) {
  const locale = routedLocales.find(item => item.segment === segment);
  if (!locale) throw new Error(`Unknown locale segment: ${segment}`);
  return locale;
}

export function listedStores() {
  return [
    links.chromeWebStore ? { id: 'chrome' as const, href: links.chromeWebStore } : null,
    links.edgeAddons ? { id: 'edge' as const, href: links.edgeAddons } : null
  ].filter(item => item !== null);
}

const languageMatchers: { id: Lang; test: (tag: string) => boolean }[] = [
  { id: 'zh-tw', test: tag => tag.startsWith('zh-tw') || tag.startsWith('zh-hant') || tag === 'zh-hk' || tag === 'zh-mo' },
  { id: 'zh', test: tag => tag.startsWith('zh') },
  { id: 'ja', test: tag => tag.startsWith('ja') },
  { id: 'ko', test: tag => tag.startsWith('ko') },
  { id: 'es', test: tag => tag.startsWith('es') },
  { id: 'fr', test: tag => tag.startsWith('fr') },
  { id: 'de', test: tag => tag.startsWith('de') },
  { id: 'en', test: tag => tag.startsWith('en') }
];

export function matchNavigatorLanguage(languages: readonly string[]): Lang | null {
  for (const language of languages) {
    const tag = language.toLowerCase();
    const match = languageMatchers.find(item => item.test(tag));
    if (match) return match.id;
  }
  return null;
}
