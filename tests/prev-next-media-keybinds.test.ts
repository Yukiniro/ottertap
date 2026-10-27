import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { actionForCommand, extensionCommands, manifestCommands } from '../lib/commands';
import { createHotkeyInput, hotkeyFromKeyboard, isHotkeyAction } from '../lib/hotkey';
import { defaultKeybinds, keybindOwner, normalizeKeybinds } from '../lib/keybinds';
import { createMediaController, cycleMediaId } from '../lib/media';
import { normalizeSettings } from '../lib/settings';

const none = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false };
const press = (key: string, code: string, extra: Partial<typeof none> = {}) => ({ ...none, ...extra, key, code });

test('上一条和下一条默认不占键，空键不算冲突', () => {
  assert.equal(defaultKeybinds.mediaPrev, '');
  assert.equal(defaultKeybinds.mediaNext, '');
  assert.equal(keybindOwner(defaultKeybinds, ''), null);
  assert.equal(keybindOwner(defaultKeybinds, '['), null);
  assert.equal(normalizeSettings({}).keybinds.mediaPrev, '');
  assert.equal(normalizeSettings({}).keybinds.mediaNext, '');
  assert.equal(normalizeKeybinds({ toggle: 'p' }).mediaPrev, '');
  assert.equal(normalizeKeybinds({ toggle: 'p' }).mediaNext, '');
  assert.equal(normalizeKeybinds({ toggle: 'p' }).toggle, 'p');
  assert.deepEqual(normalizeKeybinds({ ...defaultKeybinds, mediaPrev: '[', mediaNext: ']' }), { ...defaultKeybinds, mediaPrev: '[', mediaNext: ']' });
  assert.deepEqual(normalizeKeybinds({ ...defaultKeybinds, mediaPrev: '[', mediaNext: '[' }), defaultKeybinds, '两个新动作同一个键，整组回到默认');
  assert.deepEqual(normalizeKeybinds({ ...defaultKeybinds, mediaNext: ',' }), defaultKeybinds, '不能占逐帧的默认键');
  assert.equal(keybindOwner({ ...defaultKeybinds, mediaPrev: '[', mediaNext: '' }, ''), null);
  assert.equal(keybindOwner({ ...defaultKeybinds, mediaNext: ']' }, ']', 'mediaNext'), null);
});

test('绑了键才切换媒体，不需要单键模式；没绑的键留给网站', () => {
  assert.equal(hotkeyFromKeyboard(press('[', 'BracketLeft')), null);
  assert.equal(hotkeyFromKeyboard(press(']', 'BracketRight'), { singleKey: true }), null);
  const bound = { ...defaultKeybinds, mediaPrev: '[', mediaNext: ']' };
  assert.deepEqual(hotkeyFromKeyboard(press('[', 'BracketLeft'), { keybinds: bound }), { type: 'media', direction: -1 });
  assert.deepEqual(hotkeyFromKeyboard(press(']', 'BracketRight'), { singleKey: false, keybinds: bound }), { type: 'media', direction: 1 });
  assert.equal(hotkeyFromKeyboard(press('k', 'KeyK'), { keybinds: bound }), null, '单键模式关着时，播放暂停仍不触发');
  assert.deepEqual(hotkeyFromKeyboard(press('х', 'BracketRight'), { keybinds: bound }), { type: 'media', direction: 1 }, '非拉丁布局按物理键');
  assert.equal(hotkeyFromKeyboard(press(']', 'BracketRight', { altKey: true }), { keybinds: bound }), null, 'Alt 组合仍不走页内改键');
  assert.equal(isHotkeyAction({ type: 'media', direction: 1 }), true);
  assert.equal(isHotkeyAction({ type: 'media', direction: -1 }), true);
  assert.equal(isHotkeyAction({ type: 'media', direction: 0 }), false);
});

test('扩展命令覆盖上一条和下一条，且不占建议键', () => {
  assert.deepEqual(actionForCommand('media-prev'), { type: 'media', direction: -1 });
  assert.deepEqual(actionForCommand('media-next'), { type: 'media', direction: 1 });
  assert.equal(extensionCommands.filter(command => 'suggestedKey' in command).length, 4);
  const manifest = manifestCommands();
  for (const name of ['media-prev', 'media-next']) {
    const command = extensionCommands.find(item => item.name === name);
    assert.ok(command);
    assert.equal('suggestedKey' in command, false);
    assert.equal(manifest[name]?.suggested_key, undefined);
    assert.equal(manifest[name]?.description, `__MSG_${command.message}__`);
  }
});

test('按页面顺序循环，跳过已经不在列表里的 id', () => {
  const order = [{ id: '0:3' }, { id: '0:1' }, { id: '0:2' }];
  assert.equal(cycleMediaId(order, '0:3', 1), '0:1');
  assert.equal(cycleMediaId(order, '0:1', 1), '0:2');
  assert.equal(cycleMediaId(order, '0:2', 1), '0:3', '下一条从最后一条回到第一条');
  assert.equal(cycleMediaId(order, '0:3', -1), '0:2', '上一条从第一条回到最后一条');
  assert.equal(cycleMediaId(order, '0:9', 1), null, '不在列表里的 id 不是落点');
  assert.equal(cycleMediaId(order, '0:9', -1), null);
  assert.equal(cycleMediaId([{ id: '0:1' }], '0:1', 1), null, '只有一条时不能移动');
  assert.equal(cycleMediaId([], '0:1', -1), null);
});

test('已从文档卸下的媒体不进入循环', () => {
  const window = new Window({ url: 'https://example.com/feed' });
  const document = window.document;
  const first = document.createElement('video');
  const ghost = document.createElement('video');
  const last = document.createElement('video');
  first.setAttribute('aria-label', 'First');
  ghost.setAttribute('aria-label', 'Ghost');
  last.setAttribute('aria-label', 'Last');
  document.body.append(first, ghost, last);
  const detached = document.createElement('video');
  detached.setAttribute('aria-label', 'Detached');
  const controller = createMediaController(document as unknown as Document);
  try {
    const before = controller.snapshot();
    assert.deepEqual(before.map(item => item.label), ['First', 'Ghost', 'Last']);
    const ghostId = before[1]!.id;
    ghost.remove();
    const live = controller.snapshot();
    assert.deepEqual(live.map(item => item.label), ['First', 'Last']);
    assert.equal(live.some(item => item.id === ghostId), false);
    assert.equal(cycleMediaId(live, live[0]!.id, 1), live[1]!.id);
    assert.equal(cycleMediaId(live, live[1]!.id, 1), live[0]!.id);
    assert.equal(cycleMediaId(live, ghostId, 1), null);
  } finally {
    controller.destroy();
  }
});

test('按住上一条或下一条不会连着触发', async () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true, writable: true });
  let frame: FrameRequestCallback | undefined;
  Object.defineProperty(window, 'requestAnimationFrame', { value: (callback: FrameRequestCallback) => { frame = callback; return 1; } });
  const sent: unknown[] = [];
  const input = createHotkeyInput(action => { sent.push(action); });
  const keybinds = { ...defaultKeybinds, mediaPrev: '[', mediaNext: ']' };
  const event = (type: string, key: string, code: string, repeat = false) => {
    let prevented = false;
    const handled = input.key({ ...none, type, repeat, key, code, preventDefault() { prevented = true; }, stopPropagation() {} }, { keybinds });
    return { handled, prevented };
  };
  try {
    assert.deepEqual(event('keydown', ']', 'BracketRight'), { handled: true, prevented: true });
    assert.deepEqual(event('keydown', ']', 'BracketRight', true), { handled: true, prevented: true });
    assert.deepEqual(event('keyup', ']', 'BracketRight'), { handled: true, prevented: true });
    assert.deepEqual(event('keydown', '[', 'BracketLeft'), { handled: true, prevented: true });
    assert.deepEqual(event('keydown', '[', 'BracketLeft', true), { handled: true, prevented: true });
    frame?.(0);
    assert.deepEqual(sent, [{ type: 'media', direction: 1 }, { type: 'media', direction: -1 }]);
  } finally {
    input.dispose();
    await window.happyDOM.close();
  }
});
