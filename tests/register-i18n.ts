import { readFileSync } from 'node:fs';
import { readFlatMessages } from '../lib/message-catalog';

const messages = readFlatMessages(readFileSync(new URL('../locales/zh_CN.yml', import.meta.url), 'utf8'));
Object.assign(globalThis, { chrome: { i18n: { getMessage: (name: string) => messages[name] ?? '' } } });
