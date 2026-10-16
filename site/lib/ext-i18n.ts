import { translate } from '../../lib/message-catalog';

// Client-only: extension components are rendered with `ssr: false`, so one page holds one locale.
let messages: Record<string, string> = {};

export function setExtensionMessages(next: Record<string, string>) { messages = next; }

export const i18n = { t: (key: string, substitutions?: Record<string, string | number>) => translate(messages, key, substitutions) };
