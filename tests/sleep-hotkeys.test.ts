import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { actionForCommand, extensionCommands, manifestCommands } from '../lib/commands';
import { commandForHotkey, createHotkeyInput, hotkeyFromKeyboard, isHotkeyAction } from '../lib/hotkey';
import { defaultKeybinds, keybindOwner, normalizeKeybinds } from '../lib/keybinds';
import { mergeSettingsChange, normalizeSettings } from '../lib/settings';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { defaultSettings, type MediaState, type Settings, type SettingsStore } from '../lib/types';

const none = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false };
const press = (key: string, code: string, extra: Partial<typeof none> = {}) => ({ ...none, ...extra, key, code });
const video = { id: '1', kind: 'video', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1 } as MediaState;

test('睡眠两个动作默认不占键，空键不算冲突', () => {
  assert.equal(defaultKeybinds.sleepStart, '');
  assert.equal(defaultKeybinds.sleepCancel, '');
  assert.equal(normalizeSettings({}).keybinds.sleepStart, '');
  assert.equal(keybindOwner(defaultKeybinds, ''), null);
  assert.equal(keybindOwner(defaultKeybinds, 'z'), null, '没人绑的键不报占用');
  assert.equal(keybindOwner(defaultKeybinds, 'z', 'sleepStart'), null);
  const bound = { ...defaultKeybinds, sleepStart: 'z', sleepCancel: 'x' };
  assert.deepEqual(normalizeKeybinds(bound), bound);
  assert.equal(keybindOwner(bound, 'z', 'pip'), 'sleepStart');
  assert.equal(keybindOwner(bound, 'x', 'mirror'), 'sleepCancel');
  assert.equal(keybindOwner(bound, 'k', 'sleepStart'), 'toggle', '录到播放暂停的 K 仍提示被占用');
  assert.deepEqual(normalizeKeybinds({ ...defaultKeybinds, sleepStart: 'z', sleepCancel: 'z' }), defaultKeybinds, '两个睡眠动作同一个键，整组回到默认');
  assert.deepEqual(normalizeKeybinds({ ...defaultKeybinds, sleepCancel: '.' }), defaultKeybinds, '不能占逐帧的默认键');
});

test('绑了键才触发睡眠，不需要单键模式；没绑的键留给网站', () => {
  assert.equal(hotkeyFromKeyboard(press('z', 'KeyZ')), null);
  assert.equal(hotkeyFromKeyboard(press('z', 'KeyZ'), { singleKey: true }), null);
  const keybinds = { ...defaultKeybinds, sleepStart: 'z', sleepCancel: 'x' };
  assert.deepEqual(hotkeyFromKeyboard(press('z', 'KeyZ'), { keybinds }), { type: 'sleep', action: 'start' });
  assert.deepEqual(hotkeyFromKeyboard(press('x', 'KeyX'), { keybinds }), { type: 'sleep', action: 'cancel' });
  assert.deepEqual(hotkeyFromKeyboard(press('я', 'KeyZ'), { keybinds }), { type: 'sleep', action: 'start' }, '非拉丁布局按物理键');
  assert.equal(hotkeyFromKeyboard(press('z', 'KeyZ', { altKey: true }), { keybinds }), null);
  assert.equal(hotkeyFromKeyboard(press('z', 'KeyZ', { ctrlKey: true }), { keybinds }), null, 'Ctrl 留给扩展命令');
  assert.equal(isHotkeyAction({ type: 'sleep', action: 'start' }), true);
  assert.equal(isHotkeyAction({ type: 'sleep', action: 'cancel' }), true);
  assert.equal(isHotkeyAction({ type: 'sleep', action: 'extend' }), false);
  assert.equal(isHotkeyAction({ type: 'sleep' }), false);
  assert.equal(commandForHotkey({ type: 'sleep', action: 'start' }, video), null, '睡眠不是发给媒体的指令');
});

test('扩展命令有开始和取消睡眠，不占建议键', () => {
  assert.deepEqual(actionForCommand('sleep-start'), { type: 'sleep', action: 'start' });
  assert.deepEqual(actionForCommand('sleep-cancel'), { type: 'sleep', action: 'cancel' });
  assert.equal(extensionCommands.filter(command => 'suggestedKey' in command).length, 4);
  const manifest = manifestCommands();
  for (const [name, message] of [['sleep-start', 'cmdSleepStart'], ['sleep-cancel', 'cmdSleepCancel']] as const) {
    assert.equal(manifest[name]?.suggested_key, undefined, name);
    assert.equal(manifest[name]?.description, `__MSG_${message}__`, name);
  }
});

test('按住睡眠键不会连着触发', async () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true, writable: true });
  let frame: FrameRequestCallback | undefined;
  Object.defineProperty(window, 'requestAnimationFrame', { value: (callback: FrameRequestCallback) => { frame = callback; return 1; } });
  const sent: unknown[] = [];
  const input = createHotkeyInput(action => { sent.push(action); });
  const keybinds = { ...defaultKeybinds, sleepStart: 'z' };
  const event = (type: string, repeat = false) => input.key({ ...none, type, repeat, key: 'z', code: 'KeyZ', preventDefault() {}, stopPropagation() {} }, { keybinds });
  try {
    assert.equal(event('keydown'), true);
    assert.equal(event('keydown', true), true);
    assert.equal(event('keyup'), true);
    frame?.(0);
    assert.deepEqual(sent, [{ type: 'sleep', action: 'start' }]);
  } finally {
    input.dispose();
    await window.happyDOM.close();
  }
});

test('默认睡眠档出厂 30 分钟，只收面板档位，导出导入带上', () => {
  assert.equal(defaultSettings.sleepDefaultMinutes, 30);
  assert.equal(normalizeSettings({}).sleepDefaultMinutes, 30);
  assert.equal(normalizeSettings({ sleepDefaultMinutes: 45 }).sleepDefaultMinutes, 45);
  for (const bad of [0, 7, 90, 181, '30', null, 30.5]) assert.equal(normalizeSettings({ sleepDefaultMinutes: bad }).sleepDefaultMinutes, 30, String(bad));
  const text = serializeSettings({ ...defaultSettings, sleepDefaultMinutes: 60 }, '1.9.0');
  assert.match(text, /"sleepDefaultMinutes": 60/);
  const restored = parseSettingsBackup(text);
  assert.equal(restored.ok && restored.settings.sleepDefaultMinutes, 60);
  const older = parseSettingsBackup(JSON.stringify({ format: 'ottertap-settings', version: 1, extensionVersion: '1.8.0', settings: { theme: 'dark' } }));
  assert.equal(older.ok && older.settings.sleepDefaultMinutes, 30, '旧备份没有这个键时用 30 分钟');
  const merged = mergeSettingsChange(defaultSettings, defaultSettings, { ...defaultSettings, sleepDefaultMinutes: 15 });
  assert.equal(merged.sleepDefaultMinutes, 15);
  assert.equal(merged.sleepSoonHint, true);
});

test('设置页可选默认睡眠档，快捷键表里两个睡眠动作显示未设置', async () => {
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
    const group = host.querySelector('[role="group"][aria-labelledby="sleep-default-label"]');
    assert.ok(group, '播放区应有默认睡眠档');
    assert.equal(host.querySelector('#sleep-default-label')?.textContent, '快捷键睡眠时长');
    const pressed = () => [...group!.querySelectorAll('button[aria-pressed="true"]')].map(node => node.textContent);
    assert.deepEqual([...group!.querySelectorAll('button')].map(node => node.textContent), ['15 分', '30 分', '45 分', '60 分']);
    assert.deepEqual(pressed(), ['30 分']);
    const forty = [...group!.querySelectorAll('button')].find(node => node.textContent === '45 分') as unknown as { click(): void };
    await act(async () => { forty.click(); });
    assert.equal(value.sleepDefaultMinutes, 45);
    assert.deepEqual(pressed(), ['45 分']);
    assert.equal(value.sleepSoonHint, true, '改档不动别的播放设置');
    const rows = [...host.querySelectorAll('dl[aria-label="页内快捷键"] > div')].map(row => [row.querySelector('dt')?.textContent, row.querySelector('dd')?.textContent]);
    assert.deepEqual(rows.filter(([, label]) => /睡眠定时/.test(label ?? '')), [['未设置', '按默认时长开始睡眠定时'], ['未设置', '取消睡眠定时']]);
    assert.match(host.querySelector('#shortcuts')?.textContent ?? '', /取消睡眠定时/);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
