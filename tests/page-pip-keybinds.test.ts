import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { actionForCommand, extensionCommands, manifestCommands } from '../lib/commands';
import { commandForHotkey, createHotkeyInput, hotkeyFromKeyboard, isHotkeyAction, planHotkey } from '../lib/hotkey';
import { defaultKeybinds, keybindOwner, normalizeKeybinds } from '../lib/keybinds';
import { normalizeSettings } from '../lib/settings';
import type { MediaState } from '../lib/types';

const none = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false };
const press = (key: string, code: string, extra: Partial<typeof none> = {}) => ({ ...none, ...extra, key, code });
const video = { id: '1', kind: 'video', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1, pip: false } as MediaState;

test('画中画默认不占键，空键不算冲突', () => {
  assert.equal(defaultKeybinds.pip, '');
  assert.equal(keybindOwner(defaultKeybinds, ''), null);
  assert.equal(keybindOwner(defaultKeybinds, 'p'), null);
  assert.equal(keybindOwner(defaultKeybinds, 'p', 'pip'), null);
  assert.equal(normalizeSettings({}).keybinds.pip, '');
  assert.equal(normalizeKeybinds({ toggle: 'b' }).pip, '');
  assert.equal(normalizeKeybinds({ toggle: 'b' }).toggle, 'b');
  assert.deepEqual(normalizeKeybinds({ ...defaultKeybinds, pip: 'p' }), { ...defaultKeybinds, pip: 'p' });
  assert.deepEqual(normalizeKeybinds({ ...defaultKeybinds, pip: 'p', mirror: 'p' }), defaultKeybinds, '画中画和镜像同一个键，整组回到默认');
  assert.deepEqual(normalizeKeybinds({ ...defaultKeybinds, pip: ',' }), defaultKeybinds, '不能占逐帧的默认键');
  assert.equal(keybindOwner({ ...defaultKeybinds, pip: 'p' }, 'p'), 'pip');
  assert.equal(keybindOwner({ ...defaultKeybinds, pip: 'p' }, 'p', 'pip'), null);
  assert.equal(keybindOwner({ ...defaultKeybinds, pip: '', mirror: '' }, ''), null);
});

test('绑了键才切换画中画，不需要单键模式；没绑的键留给网站', () => {
  assert.equal(hotkeyFromKeyboard(press('p', 'KeyP')), null);
  assert.equal(hotkeyFromKeyboard(press('p', 'KeyP'), { singleKey: true }), null);
  const bound = { ...defaultKeybinds, pip: 'p' };
  assert.deepEqual(hotkeyFromKeyboard(press('p', 'KeyP'), { keybinds: bound }), { type: 'pip' });
  assert.deepEqual(hotkeyFromKeyboard(press('p', 'KeyP'), { singleKey: false, keybinds: bound }), { type: 'pip' });
  assert.equal(hotkeyFromKeyboard(press('k', 'KeyK'), { keybinds: bound }), null, '单键模式关着时，播放暂停仍不触发');
  assert.deepEqual(hotkeyFromKeyboard(press('з', 'KeyP'), { keybinds: bound }), { type: 'pip' }, '非拉丁布局按物理键');
  assert.equal(hotkeyFromKeyboard(press('p', 'KeyP', { altKey: true }), { keybinds: bound }), null, 'Alt 组合仍不走页内改键');
  assert.equal(hotkeyFromKeyboard(press('p', 'KeyP', { ctrlKey: true }), { keybinds: bound }), null, 'Ctrl 留给扩展命令');
  assert.equal(hotkeyFromKeyboard(press('p', 'KeyP', { metaKey: true }), { keybinds: bound }), null, 'Meta 留给扩展命令');
  assert.deepEqual(commandForHotkey({ type: 'pip' }, video), { type: 'pip' });
  assert.deepEqual(commandForHotkey({ type: 'pip' }, { ...video, pip: true }), { type: 'pip' });
  assert.equal(isHotkeyAction({ type: 'pip' }), true);
  const page = { host: 'example.com', enabled: true, media: [video], selectedId: '1' };
  assert.deepEqual(planHotkey(page, { type: 'pip' })?.command, { type: 'pip' });
});

test('扩展命令画中画仍在，且不占建议键', () => {
  assert.deepEqual(actionForCommand('pip'), { type: 'pip' });
  assert.equal(extensionCommands.filter(command => 'suggestedKey' in command).length, 4);
  const command = extensionCommands.find(item => item.name === 'pip');
  assert.ok(command);
  assert.equal('suggestedKey' in command, false);
  const manifest = manifestCommands();
  assert.equal(manifest.pip?.suggested_key, undefined);
  assert.equal(manifest.pip?.description, `__MSG_${command.message}__`);
});

test('按住画中画键不会连着触发', async () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true, writable: true });
  let frame: FrameRequestCallback | undefined;
  Object.defineProperty(window, 'requestAnimationFrame', { value: (callback: FrameRequestCallback) => { frame = callback; return 1; } });
  const sent: unknown[] = [];
  const input = createHotkeyInput(action => { sent.push(action); });
  const keybinds = { ...defaultKeybinds, pip: 'p' };
  const event = (type: string, key: string, code: string, repeat = false) => {
    let prevented = false;
    const handled = input.key({ ...none, type, repeat, key, code, preventDefault() { prevented = true; }, stopPropagation() {} }, { keybinds });
    return { handled, prevented };
  };
  try {
    assert.deepEqual(event('keydown', 'p', 'KeyP'), { handled: true, prevented: true });
    assert.deepEqual(event('keydown', 'p', 'KeyP', true), { handled: true, prevented: true });
    assert.deepEqual(event('keyup', 'p', 'KeyP'), { handled: true, prevented: true });
    frame?.(0);
    assert.deepEqual(sent, [{ type: 'pip' }]);
  } finally {
    input.dispose();
    await window.happyDOM.close();
  }
});
