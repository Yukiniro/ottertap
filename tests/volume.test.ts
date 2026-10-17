import assert from 'node:assert/strict';
import { test } from 'node:test';
import { snapDraggedVolume, steppedVolume } from '../lib/volume';
import { commandForHotkey, createHotkeySession } from '../lib/hotkey';
import { Window } from 'happy-dom';
import type { MediaState } from '../lib/types';

test('拖动只在 97%–103% 吸附，移出范围立即跟随，步进则只拦住跨越', () => {
  for (const percent of [0, 96, 104, 200]) assert.equal(snapDraggedVolume(percent), percent);
  for (const percent of [97, 98, 99, 100, 101, 102, 103]) assert.equal(snapDraggedVolume(percent), 100);
  for (const [from, delta, expected] of [[95, 10, 100], [105, -10, 100], [100, 10, 110], [100, -10, 90], [100, 1, 101], [100, -1, 99], [99.8, .4, 100], [100.2, -.4, 100], [100, .4, 100.4], [5, -10, 0], [195, 10, 200]]) {
    assert.equal(steppedVolume(from!, delta!, 200), expected);
  }
  assert.equal(steppedVolume(95, 10, 100), 100);
  assert.equal(steppedVolume(100, 10, 100), 100);
});

test('同帧连续按键、长按重复、滚轮及反向输入保留各自的 100% 停靠', async () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
  const values: number[] = [];
  let media = { volume: .95, muted: false, maxVolume: 2 } as MediaState;
  const input = createHotkeySession(async action => {
    // Model an asynchronous media command so later inputs must queue.
    await new Promise(resolve => setTimeout(resolve, 1));
    const command = commandForHotkey(action, media);
    assert.equal(command?.type, 'volume');
    if (command?.type === 'volume') { media = { ...media, volume: command.value }; values.push(command.value * 100); }
  });
  const keys = { altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, preventDefault() {}, stopPropagation() {} };
  const waitForValues = async (count: number) => {
    await window.happyDOM.waitUntilComplete();
    for (let attempt = 0; values.length < count && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(values.length, count);
  };
  try {
    input.key({ ...keys, key: 'ArrowUp' });
    input.key(new window.KeyboardEvent('keydown', { ...keys, key: 'ArrowUp', repeat: true }));
    input.key({ ...keys, key: 'ArrowDown' });
    input.wheel({ ...keys, deltaX: 0, deltaY: 100, deltaMode: 0 });
    input.wheel({ ...keys, deltaX: -200, deltaY: 0, deltaMode: 0 });
    await waitForValues(5);
    assert.deepEqual(values.map(Math.round), [100, 110, 100, 90, 100]);
    input.wheel({ ...keys, deltaX: -4, deltaY: 0, deltaMode: 0 });
    await waitForValues(6);
    assert.equal(values[5], 100.4);
    input.key({ ...keys, key: 'ArrowUp' });
    input.dispose();
    await window.happyDOM.waitUntilComplete();
    assert.equal(values.length, 6);
  } finally { input.dispose(); await window.happyDOM.close(); }
});
