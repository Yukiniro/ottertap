import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readFlatMessages } from '../../lib/message-catalog';
import { localeById, type Lang } from './site-locales';

export type { Lang, T } from './site-locales';
export { languageAlternates, links, listedStores, localeById, localeBySegment, locales, matchNavigatorLanguage, routedLocales, siteUrl } from './site-locales';

const read = (...path: string[]) => readFlatMessages(readFileSync(join(process.cwd(), ...path), 'utf8'));

export function loadMessages(lang: Lang) {
  const file = localeById(lang).file;
  return { site: read('locales', file), extension: read('..', 'locales', file) };
}
