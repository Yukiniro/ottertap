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
const video = { id: '1', kind: 'video', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1, currentTime: 12 } as MediaState;

test('镜像和标记默认不占键，空键不算冲突', () => {
  assert.equal(defaultKeybinds.mirror, '');
  assert.equal(defaultKeybinds.markSet, '');
  assert.equal(defaultKeybinds.markJump, '');
  assert.equal(keybindOwner(defaultKeybinds, ''), null);
  assert.equal(keybindOwner(defaultKeybinds, 'h'), null);
  assert.equal(keybindOwner(defaultKeybinds, 'h', 'mirror'), null);
  assert.equal(normalizeSettings({}).keybinds.mirror, '');
  assert.equal(normalizeSettings({}).keybinds.markSet, '');
  assert.equal(normalizeSettings({}).keybinds.markJump, '');
  assert.equal(normalizeKeybinds({ toggle: 'p' }).mirror, '');
  assert.equal(normalizeKeybinds({ toggle: 'p' }).toggle, 'p');
  assert.deepEqual(normalizeKeybinds({ ...defaultKeybinds, mirror: 'h', markSet: 'b', markJump: 'n' }), { ...defaultKeybinds, mirror: 'h', markSet: 'b', markJump: 'n' });
  assert.deepEqual(normalizeKeybinds({ ...defaultKeybinds, mirror: 'h', markSet: 'h' }), defaultKeybinds, '两个新动作同一个键，整组回到默认');
  assert.deepEqual(normalizeKeybinds({ ...defaultKeybinds, mirror: ',' }), defaultKeybinds, '不能占逐帧的默认键');
  assert.equal(keybindOwner({ ...defaultKeybinds, mirror: 'h' }, 'h'), 'mirror');
  assert.equal(keybindOwner({ ...defaultKeybinds, mirror: 'h' }, 'h', 'mirror'), null);
  assert.equal(keybindOwner({ ...defaultKeybinds, markSet: 'b', markJump: '' }, ''), null);
});

test('绑了键才触发，不需要单键模式；没绑的键留给网站', () => {
  assert.equal(hotkeyFromKeyboard(press('h', 'KeyH')), null);
  assert.equal(hotkeyFromKeyboard(press('b', 'KeyB'), { singleKey: true }), null);
  assert.equal(hotkeyFromKeyboard(press('n', 'KeyN')), null);
  const bound = { ...defaultKeybinds, mirror: 'h', markSet: 'b', markJump: 'n' };
  assert.deepEqual(hotkeyFromKeyboard(press('h', 'KeyH'), { keybinds: bound }), { type: 'mirror' });
  assert.deepEqual(hotkeyFromKeyboard(press('b', 'KeyB'), { singleKey: false, keybinds: bound }), { type: 'mark', action: 'set' });
  assert.deepEqual(hotkeyFromKeyboard(press('n', 'KeyN'), { keybinds: bound }), { type: 'mark', action: 'jump' });
  assert.equal(hotkeyFromKeyboard(press('k', 'KeyK'), { keybinds: bound }), null, '单键模式关着时，播放暂停仍不触发');
  assert.deepEqual(hotkeyFromKeyboard(press('.', 'Period'), { keybinds: bound }), { type: 'frame', direction: 1 });
  assert.deepEqual(hotkeyFromKeyboard(press('р', 'KeyH'), { keybinds: bound }), { type: 'mirror' }, '非拉丁布局按物理键');
  assert.equal(hotkeyFromKeyboard(press('h', 'KeyH', { altKey: true }), { keybinds: bound }), null, 'Alt 组合仍不走页内改键');
  assert.deepEqual(commandForHotkey({ type: 'mirror' }, video), { type: 'mirror', value: true });
  assert.deepEqual(commandForHotkey({ type: 'mirror' }, { ...video, mirrored: true }), { type: 'mirror', value: false });
  assert.deepEqual(commandForHotkey({ type: 'mirror' }, { ...video, kind: 'audio' }), { type: 'mirror', value: true });
  assert.deepEqual(commandForHotkey({ type: 'mark', action: 'set' }, video), { type: 'mark', action: 'set' });
  assert.deepEqual(commandForHotkey({ type: 'mark', action: 'jump' }, video), { type: 'mark', action: 'jump' });
  assert.equal(isHotkeyAction({ type: 'mirror' }), true);
  assert.equal(isHotkeyAction({ type: 'mark', action: 'set' }), true);
  assert.equal(isHotkeyAction({ type: 'mark', action: 'jump' }), true);
  assert.equal(isHotkeyAction({ type: 'mark', action: 'clear' }), false, '清除不走快捷键');
  const page = { host: 'example.com', enabled: true, media: [video], selectedId: '1' };
  assert.deepEqual(planHotkey(page, { type: 'mirror' })?.command, { type: 'mirror', value: true });
  assert.deepEqual(planHotkey(page, { type: 'mark', action: 'jump' })?.command, { type: 'mark', action: 'jump' });
});

test('扩展命令覆盖镜像、设标记、跳到标记，且不占建议键', () => {
  assert.deepEqual(actionForCommand('mirror'), { type: 'mirror' });
  assert.deepEqual(actionForCommand('mark-set'), { type: 'mark', action: 'set' });
  assert.deepEqual(actionForCommand('mark-jump'), { type: 'mark', action: 'jump' });
  assert.equal(extensionCommands.filter(command => 'suggestedKey' in command).length, 4);
  const manifest = manifestCommands();
  for (const name of ['mirror', 'mark-set', 'mark-jump']) {
    const command = extensionCommands.find(item => item.name === name);
    assert.ok(command);
    assert.equal('suggestedKey' in command, false);
    assert.equal(manifest[name]?.suggested_key, undefined);
    assert.equal(manifest[name]?.description, `__MSG_${command.message}__`);
  }
});

test('按住镜像或标记键不会连着触发', async () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true, writable: true });
  let frame: FrameRequestCallback | undefined;
  Object.defineProperty(window, 'requestAnimationFrame', { value: (callback: FrameRequestCallback) => { frame = callback; return 1; } });
  const sent: unknown[] = [];
  const input = createHotkeyInput(action => { sent.push(action); });
  const keybinds = { ...defaultKeybinds, mirror: 'h', markSet: 'b' };
  const event = (type: string, key: string, code: string, repeat = false) => {
    let prevented = false;
    const handled = input.key({ ...none, type, repeat, key, code, preventDefault() { prevented = true; }, stopPropagation() {} }, { keybinds });
    return { handled, prevented };
  };
  try {
    assert.deepEqual(event('keydown', 'h', 'KeyH'), { handled: true, prevented: true });
    assert.deepEqual(event('keydown', 'h', 'KeyH', true), { handled: true, prevented: true });
    assert.deepEqual(event('keyup', 'h', 'KeyH'), { handled: true, prevented: true });
    assert.deepEqual(event('keydown', 'b', 'KeyB'), { handled: true, prevented: true });
    assert.deepEqual(event('keydown', 'b', 'KeyB', true), { handled: true, prevented: true });
    frame?.(0);
    assert.deepEqual(sent, [{ type: 'mirror' }, { type: 'mark', action: 'set' }]);
  } finally {
    input.dispose();
    await window.happyDOM.close();
  }
});
