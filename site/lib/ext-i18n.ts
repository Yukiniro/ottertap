import { translate } from '../../lib/message-catalog';

// One static page render holds one locale. Providers sets this before the hero panel reads it.
let messages: Record<string, string> = {};

export function setExtensionMessages(next: Record<string, string>) { messages = next; }

export const i18n = { t: (key: string, substitutions?: Record<string, string | number>) => translate(messages, key, substitutions) };
