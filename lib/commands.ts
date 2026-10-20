import type { HotkeyAction } from './hotkey';

// Chrome accepts at most four suggested shortcuts. These stay off Alt so they do not also run the on-page hotkeys.
export const extensionCommands = [
  { name: 'play-pause', message: 'cmdPlayPause', suggestedKey: { default: 'Ctrl+Shift+Space', mac: 'Command+Shift+Space' }, action: { type: 'toggle' } },
  { name: 'skip-back', message: 'cmdSkipBack', suggestedKey: { default: 'Ctrl+Shift+Comma', mac: 'Command+Shift+Comma' }, action: { type: 'skip', delta: -1 } },
  { name: 'skip-forward', message: 'cmdSkipForward', suggestedKey: { default: 'Ctrl+Shift+Period', mac: 'Command+Shift+Period' }, action: { type: 'skip', delta: 1 } },
  { name: 'mute', message: 'cmdMute', suggestedKey: { default: 'Ctrl+Shift+M', mac: 'Command+Shift+M' }, action: { type: 'mute' } },
  { name: 'volume-up', message: 'cmdVolumeUp', action: { type: 'volume', delta: 10 } },
  { name: 'volume-down', message: 'cmdVolumeDown', action: { type: 'volume', delta: -10 } },
  { name: 'rate-faster', message: 'cmdRateFaster', action: { type: 'rate', direction: 1 } },
  { name: 'rate-slower', message: 'cmdRateSlower', action: { type: 'rate', direction: -1 } },
  { name: 'rate-reset', message: 'cmdRateReset', action: { type: 'rate', direction: 0 } }
] as const satisfies ReadonlyArray<{ name: string; message: string; suggestedKey?: { default: string; mac: string }; action: HotkeyAction }>;

export type ExtensionCommandName = (typeof extensionCommands)[number]['name'];
export type ExtensionCommandMessage = (typeof extensionCommands)[number]['message'];

const shortcutTokens: Record<string, string> = { MacCtrl: 'Ctrl', Control: 'Ctrl', Comma: ',', Period: '.', Left: '←', Right: '→', Up: '↑', Down: '↓' };

export function actionForCommand(name: string): HotkeyAction | null {
  return extensionCommands.find(command => command.name === name)?.action ?? null;
}

export function manifestCommands() {
  return Object.fromEntries(extensionCommands.map(command => {
    const entry: { description: string; suggested_key?: { default: string; mac: string } } = { description: `__MSG_${command.message}__` };
    if ('suggestedKey' in command) entry.suggested_key = command.suggestedKey;
    return [command.name, entry];
  }));
}

export function formatCommandShortcut(shortcut: string) {
  const value = shortcut.trim();
  if (!value.includes('+')) return value;
  return value.split('+').map(part => shortcutTokens[part] ?? part).join(' + ');
}

export function shortcutsSettingsUrl(userAgent: string) {
  return /\bEdg\//.test(userAgent) ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts';
}

export function commandBindings(reported: ReadonlyArray<{ name?: string; shortcut?: string }>) {
  const shortcuts = new Map(reported.map(item => [item.name ?? '', item.shortcut ?? '']));
  return extensionCommands.map(command => ({
    name: command.name,
    message: command.message,
    shortcut: formatCommandShortcut(shortcuts.get(command.name) ?? '')
  }));
}

type CommandList = ReadonlyArray<{ name?: string; shortcut?: string }>;
type CommandApi = { getAll?: () => Promise<CommandList> | CommandList };
type TabApi = { create?: (createProperties: { url: string }) => Promise<unknown> | unknown };

export function extensionShortcutApis() {
  const root = globalThis as { browser?: { commands?: CommandApi; tabs?: TabApi }; chrome?: { commands?: CommandApi; tabs?: TabApi } };
  const source = root.browser ?? root.chrome;
  return { commands: source?.commands, tabs: source?.tabs };
}
