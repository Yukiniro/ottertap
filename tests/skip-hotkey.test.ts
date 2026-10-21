import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { actionHintText, applySkipStep, commandForHotkey, createHotkeyInput, hotkeyFromKeyboard, isHotkeyAction } from '../lib/hotkey';
import type { MediaState } from '../lib/types';

const none = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false };
const media = { id: '1', paused: false, muted: false, volume: .5, maxVolume: 1, rate: 1 } as MediaState;

test('页内 J/L 与方向键使用调用方传入的步长', () => {
  const press = (key: string, code: string, skipSeconds?: number) => hotkeyFromKeyboard({ ...none, key, code }, { singleKey: true, skipSeconds });
  assert.deepEqual(press('j', 'KeyJ'), { type: 'skip', delta: -10 });
  assert.deepEqual(press('ArrowLeft', 'ArrowLeft', 5), { type: 'skip', delta: -5 });
  assert.deepEqual(press('l', 'KeyL', 15), { type: 'skip', delta: 15 });
  assert.deepEqual(press('ArrowRight', 'ArrowRight', 30), { type: 'skip', delta: 30 });
  assert.deepEqual(press('j', 'KeyJ', 7), { type: 'skip', delta: -10 }, '非法步长回落到 10');
  for (const delta of [-30, -15, -10, -5, 5, 10, 15, 30]) {
    assert.equal(isHotkeyAction({ type: 'skip', delta }), true, String(delta));
    assert.deepEqual(commandForHotkey({ type: 'skip', delta }, media), { type: 'skip', value: delta });
  }
  for (const delta of [-1, 1, 20, 0]) assert.equal(isHotkeyAction({ type: 'skip', delta }), false, String(delta));
  assert.deepEqual(commandForHotkey(applySkipStep({ type: 'skip', delta: -1 }, 15), media), { type: 'skip', value: -15 });
  assert.deepEqual(commandForHotkey(applySkipStep({ type: 'skip', delta: 1 }, 30), media), { type: 'skip', value: 30 });
  assert.deepEqual(commandForHotkey(applySkipStep({ type: 'skip', delta: 1 }, 8), media), { type: 'skip', value: 10 });
  assert.deepEqual(applySkipStep({ type: 'mute' }, 30), { type: 'mute' });
});

test('每次按键读取当前步长，提示显示实际秒数', async () => {
  const window = new Window({ url: 'https://example.com' });
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
  let frame: FrameRequestCallback | undefined;
  Object.defineProperty(window, 'requestAnimationFrame', { value: (callback: FrameRequestCallback) => { frame = callback; return 1; } });
  const sent: unknown[] = [];
  const input = createHotkeyInput(action => { sent.push(action); });
  const press = (skipSeconds: number) => {
    const event = new window.KeyboardEvent('keydown', { key: 'j', code: 'KeyJ', bubbles: true, cancelable: true });
    Object.assign(event, none);
    return input.key(event as unknown as KeyboardEvent & { preventDefault(): void; stopPropagation(): void }, { singleKey: true, skipSeconds });
  };
  try {
    assert.equal(press(5), true);
    frame?.(0);
    assert.equal(press(30), true);
    frame?.(0);
    assert.deepEqual(sent, [{ type: 'skip', delta: -5 }, { type: 'skip', delta: -30 }]);
    assert.equal(actionHintText('skipBack', 15), '后退 15 秒');
    assert.equal(actionHintText('skipForward', 5), '前进 5 秒');
    assert.equal(actionHintText('skipBack', 9), '后退 10 秒');
    assert.equal(actionHintText('play'), '播放');
    assert.equal(actionHintText('nope'), '');
  } finally {
    input.dispose();
    await window.happyDOM.close();
  }
});
