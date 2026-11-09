import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { actionForCommand, extensionCommands, manifestCommands } from '../lib/commands';
import { actionHintText, commandForHotkey, createHotkeyInput, hotkeyFromKeyboard, isHotkeyAction } from '../lib/hotkey';
import { defaultKeybinds, keybindOwner, normalizeKeybinds } from '../lib/keybinds';
import { normalizeSettings } from '../lib/settings';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { defaultSettings, type MediaState, type Settings, type SettingsStore } from '../lib/types';

const none = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false };
const press = (key: string, code: string, extra: Partial<typeof none> = {}) => ({ ...none, ...extra, key, code });
const video = { id: '1', kind: 'video', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1 } as MediaState;

test('只听当前和撤销默认不占键，空键不算冲突', () => {
  assert.strictEqual(defaultKeybinds.listenCurrent, '');
  assert.strictEqual(defaultKeybinds.undoMuteOthers, '');
  assert.strictEqual(normalizeSettings({}).keybinds.listenCurrent, '');
  assert.strictEqual(normalizeSettings({}).keybinds.undoMuteOthers, '');
  assert.strictEqual(normalizeSettings({}).keybinds.toggle, 'k', '补上新键时不改已有默认键');
  assert.strictEqual(keybindOwner(defaultKeybinds, ''), null);
  assert.strictEqual(keybindOwner(defaultKeybinds, 'y'), null, '没人绑的键不报占用');
  assert.strictEqual(keybindOwner(defaultKeybinds, 'y', 'listenCurrent'), null);
  const bound = { ...defaultKeybinds, listenCurrent: 'y', undoMuteOthers: 'u' };
  assert.deepEqual(normalizeKeybinds(bound), bound);
  assert.strictEqual(keybindOwner(bound, 'y', 'undoMuteOthers'), 'listenCurrent');
  assert.strictEqual(keybindOwner(bound, 'u', 'listenCurrent'), 'undoMuteOthers');
  assert.strictEqual(keybindOwner(bound, 'k', 'listenCurrent'), 'toggle');
  assert.deepEqual(normalizeKeybinds({ ...defaultKeybinds, listenCurrent: 'y', undoMuteOthers: 'y' }), defaultKeybinds, '两个动作同一个键，整组回到默认');
  assert.deepEqual(normalizeKeybinds({ ...defaultKeybinds, listenCurrent: ',' }), defaultKeybinds, '不能占逐帧的默认键');
});

test('绑了键才触发，不需要单键模式；没绑的键留给网站', () => {
  assert.strictEqual(hotkeyFromKeyboard(press('y', 'KeyY')), null);
  assert.strictEqual(hotkeyFromKeyboard(press('y', 'KeyY'), { singleKey: true }), null);
  const keybinds = { ...defaultKeybinds, listenCurrent: 'y', undoMuteOthers: 'u' };
  assert.deepEqual(hotkeyFromKeyboard(press('y', 'KeyY'), { keybinds }), { type: 'listenCurrent' });
  assert.deepEqual(hotkeyFromKeyboard(press('u', 'KeyU'), { keybinds }), { type: 'undoMuteOthers' });
  assert.deepEqual(hotkeyFromKeyboard(press('н', 'KeyY'), { keybinds }), { type: 'listenCurrent' }, '非拉丁布局按物理键');
  for (const extra of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }] as const) {
    assert.strictEqual(hotkeyFromKeyboard(press('y', 'KeyY', extra), { keybinds }), null);
  }
  assert.strictEqual(isHotkeyAction({ type: 'listenCurrent' }), true);
  assert.strictEqual(isHotkeyAction({ type: 'undoMuteOthers' }), true);
  assert.strictEqual(isHotkeyAction({ type: 'listenCurrent', tabId: 1 }), true);
  assert.strictEqual(commandForHotkey({ type: 'listenCurrent' }, video), null, '只听当前不是发给当前媒体的指令');
  assert.strictEqual(commandForHotkey({ type: 'undoMuteOthers' }, video), null);
  assert.strictEqual(actionForCommand('listen-current') && commandForHotkey(actionForCommand('listen-current')!, video), null);
});

test('扩展命令有只听当前和撤销，不占建议键', () => {
  assert.deepEqual(actionForCommand('listen-current'), { type: 'listenCurrent' });
  assert.deepEqual(actionForCommand('undo-mute-others'), { type: 'undoMuteOthers' });
  assert.strictEqual(extensionCommands.filter(command => 'suggestedKey' in command).length, 4);
  const manifest = manifestCommands();
  for (const [name, message] of [['listen-current', 'cmdListenCurrent'], ['undo-mute-others', 'cmdUndoMuteOthers']] as const) {
    assert.strictEqual(manifest[name]?.suggested_key, undefined, name);
    assert.strictEqual(manifest[name]?.description, `__MSG_${message}__`, name);
  }
  const suggested = Object.values(manifest).filter(command => command.suggested_key).length;
  assert.strictEqual(suggested, 4);
});

test('按住只听当前或撤销不会连着触发', async () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true, writable: true });
  let frame: FrameRequestCallback | undefined;
  Object.defineProperty(window, 'requestAnimationFrame', { value: (callback: FrameRequestCallback) => { frame = callback; return 1; } });
  const sent: unknown[] = [];
  const input = createHotkeyInput(action => { sent.push(action); });
  const keybinds = { ...defaultKeybinds, listenCurrent: 'y', undoMuteOthers: 'u' };
  const event = (type: string, code: string, repeat = false) => input.key({ ...none, type, repeat, key: code === 'KeyY' ? 'y' : 'u', code, preventDefault() {}, stopPropagation() {} }, { keybinds });
  try {
    assert.strictEqual(event('keydown', 'KeyY'), true);
    assert.strictEqual(event('keydown', 'KeyY', true), true);
    assert.strictEqual(event('keyup', 'KeyY'), true);
    assert.strictEqual(event('keyup', 'KeyU'), true, '没有按下的松开不触发');
    frame?.(0);
    assert.deepEqual(sent, [{ type: 'listenCurrent' }]);
    assert.strictEqual(event('keydown', 'KeyU'), true);
    assert.strictEqual(event('keyup', 'KeyU'), true);
    frame?.(0);
    assert.deepEqual(sent, [{ type: 'listenCurrent' }, { type: 'undoMuteOthers' }]);
  } finally {
    input.dispose();
    await window.happyDOM.close();
  }
});

test('新键随导入导出往返，旧备份补成未绑定', () => {
  const bound = { ...defaultSettings, keybinds: { ...defaultKeybinds, listenCurrent: 'y', undoMuteOthers: 'u' } };
  const text = serializeSettings(bound, '1.9.0');
  assert.match(text, /"listenCurrent": "y"/);
  assert.match(text, /"undoMuteOthers": "u"/);
  const restored = parseSettingsBackup(text);
  assert.strictEqual(restored.ok && restored.settings.keybinds.listenCurrent, 'y');
  assert.strictEqual(restored.ok && restored.settings.keybinds.undoMuteOthers, 'u');
  assert.strictEqual(restored.ok && restored.settings.keybinds.toggle, 'k');
  assert.strictEqual(restored.ok && restored.settings.keybinds.mute, 'm');
  const older = parseSettingsBackup(JSON.stringify({ format: 'ottertap-settings', version: 1, extensionVersion: '1.8.0', settings: { theme: 'dark', keybinds: { toggle: 'p' } } }));
  assert.strictEqual(older.ok && older.settings.keybinds.listenCurrent, '');
  assert.strictEqual(older.ok && older.settings.keybinds.undoMuteOthers, '');
  assert.strictEqual(older.ok && older.settings.keybinds.toggle, 'p', '旧备份里的已有键保留');
  assert.strictEqual(older.ok && older.settings.keybinds.sleepStart, '');
});

test('无目标、无记录和失败沿用原来的短说明', () => {
  assert.strictEqual(actionHintText('listenCurrentFailed'), '没能改成只听当前。');
  assert.strictEqual(actionHintText('listenCurrentUnavailable'), '没有其他发声标签，当前标签也没有被静音。');
  assert.strictEqual(actionHintText('undoMuteOthersFailed'), '没能撤销静音其他标签页。');
  assert.strictEqual(actionHintText('undoMuteOthersUnavailable'), '这些标签页已经不能安全地取消静音。');
  assert.strictEqual(actionHintText('listenCurrent'), '');
  assert.strictEqual(actionHintText('undoMuteOthers'), '');
});

test('设置页能看见两个未绑定的动作', async () => {
  const window = new Window({ url: 'https://example.com/options' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'FocusEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { SettingsPage } = await import('../components/settings-page');
  let value: Settings = { ...defaultSettings };
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
    const shortcuts = host.querySelector('#shortcuts');
    assert.ok(shortcuts);
    const pageRows = [...shortcuts.querySelectorAll('dl[aria-label="页内快捷键"] > div')];
    const rowText = (row: (typeof pageRows)[number], part: 'dt' | 'dd') => row.querySelector(part)?.textContent ?? '';
    const listen = pageRows.find(row => rowText(row, 'dd') === '只听当前');
    const undo = pageRows.find(row => rowText(row, 'dd') === '撤销上一次静音其他');
    assert.ok(listen);
    assert.ok(undo);
    assert.strictEqual(rowText(listen, 'dt'), '未设置');
    assert.strictEqual(rowText(undo, 'dt'), '未设置');
    const labels = [...shortcuts.querySelectorAll('button')].map(button => button.getAttribute('aria-label') ?? '');
    assert.ok(labels.some(label => label.includes('只听当前') && label.includes('未设置')));
    assert.ok(labels.some(label => label.includes('撤销上一次静音其他') && label.includes('未设置')));
    const descriptions = [...shortcuts.querySelectorAll('dd')].map(node => node.textContent ?? '');
    assert.strictEqual(descriptions.filter(text => text === '只听当前').length, 2, '页内键和扩展命令各一行');
    assert.strictEqual(descriptions.filter(text => text === '撤销上一次静音其他').length, 2);
    assert.strictEqual(host.querySelector('#keybind-error'), null);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
