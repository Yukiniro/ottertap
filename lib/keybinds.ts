/** One key per action. An empty string is unbound and is not taken. Alt shortcuts, the mouse wheel, and the single-key arrows stay fixed. */
export const keybindActions = ['toggle', 'skipBack', 'skipForward', 'rateUp', 'rateDown', 'mute', 'holdBoost', 'frameBack', 'frameForward', 'mirror', 'markSet', 'markJump'] as const;
export type KeybindAction = (typeof keybindActions)[number];
export type Keybinds = Record<KeybindAction, string>;

export const defaultKeybinds: Keybinds = { toggle: 'k', skipBack: 'j', skipForward: 'l', rateUp: '>', rateDown: '<', mute: 'm', holdBoost: 's', frameBack: ',', frameForward: '.', mirror: '', markSet: '', markJump: '' };

/** Single-key mode arrows. They can't be rebound, so a custom key may not take them. */
export const fixedKeys = { ArrowLeft: 'skipBack', ArrowRight: 'skipForward', ArrowUp: 'volumeUp', ArrowDown: 'volumeDown' } as const;
export type KeybindOwner = KeybindAction | (typeof fixedKeys)[keyof typeof fixedKeys];

const namedKeys = new Set(['Space', 'Enter', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown', ...Object.keys(fixedKeys)]);

export interface KeyPress { key: string; code?: string; altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }

const shifted: Record<string, [string, string]> = {
  Comma: [',', '<'], Period: ['.', '>'], Slash: ['/', '?'], Semicolon: [';', ':'], Quote: ["'", '"'], BracketLeft: ['[', '{'], BracketRight: [']', '}'],
  Backslash: ['\\', '|'], Minus: ['-', '_'], Equal: ['=', '+'], Backquote: ['`', '~'],
  Digit0: ['0', ')'], Digit1: ['1', '!'], Digit2: ['2', '@'], Digit3: ['3', '#'], Digit4: ['4', '$'], Digit5: ['5', '%'], Digit6: ['6', '^'], Digit7: ['7', '&'], Digit8: ['8', '*'], Digit9: ['9', '(']
};

/** What the key prints on a US layout. */
function physicalKey(code: string | undefined, shift: boolean) {
  if (!code) return null;
  if (/^Key[A-Z]$/.test(code)) return shift ? code.slice(3) : code.slice(3).toLowerCase();
  const pair = shifted[code];
  return pair ? pair[shift ? 1 : 0] : null;
}

/**
 * Letter case follows Shift, so Caps Lock does not change the key and Shift + K is its own key.
 * Shift with a named key (Shift + Space, Shift + ←) never matches, so those stay with the page.
 */
function typedKey(event: KeyPress) {
  const key = event.key === ' ' ? 'Space' : event.key;
  if ([...key].length !== 1) return event.shiftKey ? `Shift+${key}` : key;
  if (key.toLowerCase() === key.toUpperCase()) return key;
  return event.shiftKey ? key.toUpperCase() : key.toLowerCase();
}

export function isKeybindKey(value: unknown): value is string {
  return typeof value === 'string' && ([...value].length === 1 ? value.trim() !== '' : namedKeys.has(value));
}

/**
 * The typed glyph wins when a binding uses it, so AZERTY keeps its printed keys.
 * Otherwise the physical key stands in, so non-Latin layouts still reach the defaults.
 */
export function pressedKey(event: KeyPress, keybinds: Keybinds) {
  const typed = typedKey(event);
  if (Object.hasOwn(fixedKeys, typed) || Object.values(keybinds).includes(typed)) return typed;
  return physicalKey(event.code, event.shiftKey) ?? typed;
}

/** The key to store when recording, or null when it can't be bound. */
export function recordedKey(event: KeyPress) {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  const typed = typedKey(event);
  if (isKeybindKey(typed)) return typed;
  const physical = physicalKey(event.code, event.shiftKey);
  return physical && isKeybindKey(physical) ? physical : null;
}

export function keybindOwner(keybinds: Keybinds, key: string, except?: KeybindAction): KeybindOwner | null {
  if (!isKeybindKey(key)) return null;
  if (Object.hasOwn(fixedKeys, key)) return fixedKeys[key as keyof typeof fixedKeys];
  return keybindActions.find(action => action !== except && keybinds[action] === key) ?? null;
}

/** A broken or clashing set falls back to the defaults as a whole. Empty strings stay unbound and do not clash with each other. */
export function normalizeKeybinds(value: unknown): Keybinds {
  const source = value && typeof value === 'object' ? value as Partial<Record<KeybindAction, unknown>> : {};
  const next = { ...defaultKeybinds };
  for (const action of keybindActions) {
    const key = source[action];
    if (isKeybindKey(key)) next[action] = key;
  }
  const clash = keybindActions.some(action => keybindOwner(next, next[action], action) !== null);
  return clash ? { ...defaultKeybinds } : next;
}

export const sameKeybinds = (a: Keybinds, b: Keybinds) => keybindActions.every(action => a[action] === b[action]);

const arrows: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };

/** `space` is the localized name for the space bar. */
export function keyLabel(key: string, space: string) {
  if (key === 'Space') return space;
  if (arrows[key]) return arrows[key];
  if ([...key].length !== 1 || key.toLowerCase() === key.toUpperCase()) return key;
  return key === key.toUpperCase() ? `Shift + ${key}` : key.toUpperCase();
}
