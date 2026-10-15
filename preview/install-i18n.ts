import text from '../locales/zh_CN.yml?raw';
import { readFlatMessages } from '../lib/message-catalog';

const messages = readFlatMessages(text);
Object.assign(globalThis, { chrome: { i18n: { getMessage: (name: string) => messages[name] ?? '' } } });
