import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { actionForCommand } from '../lib/commands';
import { applyVolumeStep, commandForHotkey, createHotkeyInput, hotkeyFromKeyboard, wheelVolumeDelta } from '../lib/hotkey';
import type { MediaState } from '../lib/types';

const none = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false };
const media = { id: '1', paused: false, muted: false, volume: .5, maxVolume: 2, rate: 1 } as MediaState;

test('滚轮和单键方向键使用调用方传入的音量步长', () => {
  assert.equal(wheelVolumeDelta(-100, 0), 10);
  assert.equal(wheelVolumeDelta(-100, 0, 5), 5);
  assert.equal(wheelVolumeDelta(100, 0, 20), -20);
  assert.equal(wheelVolumeDelta(4, 0, 5), -.2);
  assert.equal(wheelVolumeDelta(1, 1, 20), -20);
  assert.equal(wheelVolumeDelta(-100, 0, 15), 10, '非法步长回落到 10');
  const press = (key: string, volumeStep?: number) => hotkeyFromKeyboard({ ...none, key, code: key }, { singleKey: true, onMedia: true, volumeStep });
  assert.deepEqual(press('ArrowUp'), { type: 'volume', delta: 10 });
  assert.deepEqual(press('ArrowDown', 5), { type: 'volume', delta: -5 });
  assert.deepEqual(press('ArrowUp', 20), { type: 'volume', delta: 20 });
  assert.deepEqual(press('ArrowDown', 7), { type: 'volume', delta: -10 }, '非法步长回落到 10');
  assert.equal(hotkeyFromKeyboard({ ...none, key: 'ArrowUp', code: 'ArrowUp' }, { singleKey: true, volumeStep: 5 }), null, '不在视频上时方向键仍留给页面');
});

test('扩展命令只表示方向，步长和跨过 100% 的停靠在应用时发生', () => {
  assert.deepEqual(actionForCommand('volume-up'), { type: 'volume', delta: 1 });
  assert.deepEqual(actionForCommand('volume-down'), { type: 'volume', delta: -1 });
  assert.deepEqual(applyVolumeStep(actionForCommand('volume-up')!, 5), { type: 'volume', delta: 5 });
  assert.deepEqual(applyVolumeStep(actionForCommand('volume-down')!, 20), { type: 'volume', delta: -20 });
  assert.deepEqual(applyVolumeStep(actionForCommand('volume-up')!, 15), { type: 'volume', delta: 10 });
  assert.deepEqual(applyVolumeStep({ type: 'mute' }, 20), { type: 'mute' });
  assert.deepEqual(commandForHotkey(applyVolumeStep(actionForCommand('volume-up')!, 20), { ...media, volume: .95 }), { type: 'volume', value: 1 });
  assert.deepEqual(commandForHotkey(applyVolumeStep(actionForCommand('volume-up')!, 20), { ...media, volume: 1 }), { type: 'volume', value: 1.2 });
  assert.deepEqual(commandForHotkey(applyVolumeStep(actionForCommand('volume-down')!, 5), { ...media, volume: 1 }), { type: 'volume', value: .95 });
});

test('每次滚轮和按键读取当前音量步长', async () => {
  const window = new Window({ url: 'https://example.com' });
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
  let frame: FrameRequestCallback | undefined;
  Object.defineProperty(window, 'requestAnimationFrame', { value: (callback: FrameRequestCallback) => { frame = callback; return 1; } });
  const sent: unknown[] = [];
  const input = createHotkeyInput(action => { sent.push(action); });
  const bare = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, preventDefault() {}, stopPropagation() {} };
  try {
    const up = { ...bare, key: 'ArrowUp', code: 'ArrowUp' };
    assert.equal(input.key(up, { singleKey: true, volumeStep: 5, target: '1' }), true);
    frame?.(0);
    const wheel = { ...bare, altKey: true, deltaX: 0, deltaY: -100, deltaMode: 0, preventDefault() {}, stopPropagation() {} };
    assert.equal(input.wheel(wheel, '1', 20), true);
    frame?.(0);
    assert.deepEqual(sent, [{ type: 'volume', delta: 5 }, { type: 'volume', delta: 20 }]);
  } finally {
    input.dispose();
    await window.happyDOM.close();
  }
});
