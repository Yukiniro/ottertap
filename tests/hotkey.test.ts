import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createDemo } from '../lib/demo';
import { defaultSettings } from '../lib/types';

for (const { name, deltaX, deltaY, deltaMode, modifiers, expected } of [
  { name: '纵向滚轮向下', deltaX: 0, deltaY: 100, expected: .65 },
  { name: '纵向滚轮向上', deltaX: 0, deltaY: -100, expected: .85 },
  { name: 'Shift 转为横向后向下', deltaX: 100, deltaY: 0, expected: .65 },
  { name: 'Shift 转为横向后向上', deltaX: -100, deltaY: 0, expected: .85 },
  { name: '横向按行滚动', deltaX: 1, deltaY: 0, deltaMode: 1, expected: .65 },
  { name: '双轴滚动以纵向为准', deltaX: 100, deltaY: -100, expected: .85 },
  { name: '没有滚动量', deltaX: 0, deltaY: 0, expected: .75 },
  { name: '未按 Shift', deltaX: 100, deltaY: 0, modifiers: { shiftKey: false }, expected: .75 },
  { name: '同时按 Command', deltaX: 100, deltaY: 0, modifiers: { metaKey: true }, expected: .75 }
]) {
  test(`Option+Shift 滚轮：${name}`, async () => {
    const window = new Window({ url: 'https://example.com' });
    Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
    let frame: FrameRequestCallback | undefined;
    Object.defineProperty(window, 'requestAnimationFrame', { value: (callback: FrameRequestCallback) => { frame = callback; return 1; } });
    const demo = createDemo(window.document as unknown as Document, {
      src: '/demo.wav', title: 'Test media',
      store: { async load() { return defaultSettings; }, async save() {}, watch() { return () => {}; } }
    });
    const dispose = demo.listenHotkeys(window as unknown as globalThis.Window);
    try {
      await Promise.resolve();
      const event = new window.WheelEvent('wheel', { deltaX, deltaY, deltaMode, bubbles: true, cancelable: true });
      // happy-dom's WheelEvent omits the modifier fields inherited from MouseEvent in browsers.
      Object.assign(event, { altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, ...modifiers });
      window.document.body.dispatchEvent(event);
      frame?.(0);
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(demo.media.volume, expected);
      assert.equal(event.defaultPrevented, expected !== .75);
    } finally {
      dispose(); demo.destroy(); await window.happyDOM.close();
    }
  });
}
