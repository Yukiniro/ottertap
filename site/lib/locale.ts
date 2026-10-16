import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readFlatMessages } from '../../lib/message-catalog';

export const langs = ['zh', 'en'] as const;
export type Lang = (typeof langs)[number];

const files: Record<Lang, string> = { zh: 'zh_CN.yml', en: 'en.yml' };
// Next runs from the site package directory in both dev and build.
const read = (...path: string[]) => readFlatMessages(readFileSync(join(process.cwd(), ...path), 'utf8'));

export type T = (key: string) => string;

export const links = {
  repo: 'https://github.com/Yukiniro/ottertap',
  releases: 'https://github.com/Yukiniro/ottertap/releases',
  latest: 'https://github.com/Yukiniro/ottertap/releases/latest'
};

export function isLang(value: string): value is Lang { return (langs as readonly string[]).includes(value); }

export function loadMessages(lang: Lang) {
  return { site: read('locales', files[lang]), extension: read('..', 'locales', files[lang]) };
}
