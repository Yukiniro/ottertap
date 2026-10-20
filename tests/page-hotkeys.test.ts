import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createDemo } from '../lib/demo';
import { createHotkeyInput, hotkeyFromKeyboard, isTypingEvent, isTypingTarget, type HotkeyAction } from '../lib/hotkey';
import { createMediaController, focusedMedia, mediaAtPoint } from '../lib/media';
import { defaultSettings, type Settings } from '../lib/types';

const none = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false };
const alt = { ...none, altKey: true };

test('Alt/Option 键位：, . 0 调倍速、M 静音，认 Option 改写后的 code，避开方向键和菜单键', () => {
  const key = (key: string, code: string, extra: Partial<typeof none> = {}) => hotkeyFromKeyboard({ ...alt, ...extra, key, code });
  assert.deepEqual(key('.', 'Period'), { type: 'rate', direction: 1 });
  assert.deepEqual(key(',', 'Comma'), { type: 'rate', direction: -1 });
  assert.deepEqual(key('0', 'Digit0'), { type: 'rate', direction: 0 });
  assert.deepEqual(key('m', 'KeyM'), { type: 'mute' });
  assert.deepEqual(key('M', 'KeyM', { shiftKey: true }), { type: 'mute' });
  // macOS Option rewrites key: Option+. ≥, Option+, ≤, Option+0 º, Option+M µ.
  assert.deepEqual(key('≥', 'Period'), { type: 'rate', direction: 1 });
  assert.deepEqual(key('≤', 'Comma'), { type: 'rate', direction: -1 });
  assert.deepEqual(key('º', 'Digit0'), { type: 'rate', direction: 0 });
  assert.deepEqual(key('µ', 'KeyM'), { type: 'mute' });
  for (const [name, code] of [['ArrowLeft', 'ArrowLeft'], ['ArrowRight', 'ArrowRight'], ['ArrowUp', 'ArrowUp'], ['ArrowDown', 'ArrowDown'], ['f', 'KeyF'], ['e', 'KeyE'], ['d', 'KeyD'], ['k', 'KeyK']] as const) {
    assert.equal(key(name, code), null, name);
  }
  assert.equal(key('.', 'Period', { ctrlKey: true }), null, 'AltGr 与 Ctrl+Alt 留给系统输入');
  assert.equal(key('m', 'KeyM', { metaKey: true }), null);
  assert.equal(hotkeyFromKeyboard({ ...none, key: '.', code: 'Period' }), null);
  assert.equal(hotkeyFromKeyboard({ ...none, key: 'm', code: 'KeyM' }), null, '单键模式关闭时裸键不触发');
});

test('单键模式：K 播放暂停、J/L 与 ←/→ 跳 10 秒、M 静音、< > 倍速，↑/↓ 只在视频上', () => {
  const single = (key: string, code: string, extra: Partial<typeof none> = {}, onMedia = false) => hotkeyFromKeyboard({ ...none, ...extra, key, code }, { singleKey: true, onMedia });
  assert.deepEqual(single('k', 'KeyK'), { type: 'toggle' });
  assert.deepEqual(single('j', 'KeyJ'), { type: 'skip', delta: -10 });
  assert.deepEqual(single('ArrowLeft', 'ArrowLeft'), { type: 'skip', delta: -10 });
  assert.deepEqual(single('l', 'KeyL'), { type: 'skip', delta: 10 });
  assert.deepEqual(single('ArrowRight', 'ArrowRight'), { type: 'skip', delta: 10 });
  assert.deepEqual(single('m', 'KeyM'), { type: 'mute' });
  assert.deepEqual(single('>', 'Period', { shiftKey: true }), { type: 'rate', direction: 1 });
  assert.deepEqual(single('<', 'Comma', { shiftKey: true }), { type: 'rate', direction: -1 });
  assert.equal(single('.', 'Period'), null);
  assert.equal(single(',', 'Comma'), null);
  assert.equal(single('ArrowUp', 'ArrowUp'), null, '不在视频上时 ↑ 留给页面滚动');
  assert.equal(single('ArrowDown', 'ArrowDown'), null);
  assert.deepEqual(single('ArrowUp', 'ArrowUp', {}, true), { type: 'volume', delta: 10 });
  assert.deepEqual(single('ArrowDown', 'ArrowDown', {}, true), { type: 'volume', delta: -10 });
  assert.equal(single('K', 'KeyK', { shiftKey: true }), null);
  assert.equal(single('k', 'KeyK', { ctrlKey: true }), null);
  assert.equal(single('k', 'KeyK', { metaKey: true }), null);
  assert.deepEqual(single('л', 'KeyK'), { type: 'toggle' }, '非拉丁布局按物理键位识别');
  assert.deepEqual(single('ArrowLeft', 'ArrowLeft', { altKey: true }), null, '单键模式下 Alt+← 仍留给浏览器后退');
  assert.deepEqual(hotkeyFromKeyboard({ ...alt, key: '.', code: 'Period' }, { singleKey: true }), { type: 'rate', direction: 1 }, '单键模式下 Alt 组合键照常可用');
});

test('输入框、文本域、下拉框和可编辑区域中不触发页内快捷键', async () => {
  const window = new Window({ url: 'https://example.com' });
  const document = window.document;
  try {
    document.body.innerHTML = `
      <input id="text"><input id="search" type="search"><input id="email" type="email"><textarea id="area"></textarea><select id="choice"><option>a</option></select>
      <div id="editor" contenteditable="true"><p id="inside">x</p></div><div id="plaintext" contenteditable="plaintext-only"></div>
      <input id="range" type="range"><input id="check" type="checkbox"><button id="button">b</button><div id="plain">p</div>`;
    const by = (id: string) => document.getElementById(id);
    for (const id of ['text', 'search', 'email', 'area', 'choice', 'editor', 'inside', 'plaintext']) assert.equal(isTypingTarget(by(id)), true, id);
    for (const id of ['range', 'check', 'button', 'plain']) assert.equal(isTypingTarget(by(id)), false, id);
    assert.equal(isTypingTarget(document), false);
    assert.equal(isTypingTarget(null), false);

    const host = document.createElement('div');
    document.body.append(host);
    const field = document.createElement('input');
    host.attachShadow({ mode: 'open' }).append(field);
    const seen: boolean[] = [];
    window.addEventListener('keydown', event => { seen.push(isTypingEvent(event as unknown as Event)); }, true);
    field.dispatchEvent(new window.KeyboardEvent('keydown', { key: '.', code: 'Period', altKey: true, bubbles: true, composed: true }));
    by('plain')!.dispatchEvent(new window.KeyboardEvent('keydown', { key: '.', code: 'Period', altKey: true, bubbles: true, composed: true }));
    assert.deepEqual(seen, [true, false], 'Shadow DOM 里的输入框也要识别');
  } finally { await window.happyDOM.close(); }
});

test('页内监听在输入框里放过 Alt+.，在页面上调倍速', async () => {
  const window = new Window({ url: 'https://example.com' });
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
  let frame: FrameRequestCallback | undefined;
  Object.defineProperty(window, 'requestAnimationFrame', { value: (callback: FrameRequestCallback) => { frame = callback; return 1; } });
  const demo = createDemo(window.document as unknown as Document, {
    src: '/demo.wav', title: 'Test media',
    store: { async load() { return defaultSettings; }, async save() {}, watch() { return () => {}; } }
  });
  const dispose = demo.listenHotkeys(window as unknown as globalThis.Window);
  const input = window.document.createElement('input');
  window.document.body.append(input);
  const press = async (target: { dispatchEvent(event: unknown): boolean }) => {
    const event = new window.KeyboardEvent('keydown', { key: '.', code: 'Period', altKey: true, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    frame?.(0);
    frame = undefined;
    await new Promise(resolve => setImmediate(resolve));
    return event.defaultPrevented;
  };
  try {
    await Promise.resolve();
    assert.equal(await press(input), false);
    assert.equal(demo.media.playbackRate, 1.25);
    assert.equal(await press(window.document.body), true);
    assert.equal(demo.media.playbackRate, 1.5);
  } finally { dispose(); demo.destroy(); await window.happyDOM.close(); }
});

test('悬停判定：指针落在可见媒体的矩形内，聚焦媒体或其外层播放器也算', async () => {
  const window = new Window({ url: 'https://example.com' });
  const document = window.document;
  try {
    const rect = (x: number, y: number, width: number, height: number) => () => new window.DOMRect(x, y, width, height);
    const player = document.createElement('div');
    player.tabIndex = 0;
    const video = document.createElement('video');
    const hidden = document.createElement('video');
    const audio = document.createElement('audio');
    video.getBoundingClientRect = rect(100, 50, 320, 180);
    hidden.getBoundingClientRect = rect(0, 0, 0, 0);
    audio.getBoundingClientRect = rect(0, 400, 300, 40);
    player.append(video);
    document.body.append(player, hidden, audio);
    const all = [hidden, video, audio] as unknown as HTMLMediaElement[];
    assert.equal(mediaAtPoint(all, 200, 100), video);
    assert.equal(mediaAtPoint(all, 100, 50), video, '边缘也算在内');
    assert.equal(mediaAtPoint(all, 420, 230), video);
    assert.equal(mediaAtPoint(all, 421, 100), undefined);
    assert.equal(mediaAtPoint(all, 0, 0), undefined, '隐藏的媒体没有尺寸，不算悬停');
    assert.equal(mediaAtPoint(all, 10, 420), audio);

    const doc = document as unknown as Document;
    assert.equal(focusedMedia(all, doc), undefined, '焦点在 body 时不算');
    player.focus();
    assert.equal(focusedMedia(all, doc), video, '播放器外层获得焦点');
    video.tabIndex = 0;
    video.focus();
    assert.equal(focusedMedia(all, doc), video);

    const controller = createMediaController(doc);
    try {
      const ids = new Map(controller.snapshot().map((item, index) => [index, item.id]));
      assert.equal(controller.pointed({ x: 200, y: 100 }, false), ids.get(0));
      assert.equal(controller.pointed({ x: 10, y: 420 }, false), ids.get(2));
      assert.equal(controller.pointed({ x: 900, y: 900 }, false), undefined);
      assert.equal(controller.pointed(null, false), undefined);
      assert.equal(controller.pointed(null, true), ids.get(0), '没有指针时退回焦点');
    } finally { controller.destroy(); }
  } finally { await window.happyDOM.close(); }
});

test('悬停滚轮只在视频上拦截，Alt+滚轮随处可用；目标只随悬停或聚焦手势发送', async () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
  let frame: FrameRequestCallback | undefined;
  Object.defineProperty(window, 'requestAnimationFrame', { value: (callback: FrameRequestCallback) => { frame = callback; return 1; } });
  const sent: [HotkeyAction, string | undefined][] = [];
  const input = createHotkeyInput((action, target) => { sent.push([action, target]); });
  const flush = () => { frame?.(0); frame = undefined; };
  const wheel = (extra: Partial<typeof none> & { deltaX?: number; deltaY?: number }, target?: string) => {
    let prevented = false;
    const handled = input.wheel({ ...none, deltaX: 0, deltaY: 100, deltaMode: 0, ...extra, preventDefault() { prevented = true; }, stopPropagation() {} }, target);
    assert.equal(prevented, handled);
    return handled;
  };
  const key = (event: { key: string; code?: string; type?: string } & Partial<typeof none>, options?: { singleKey?: boolean; target?: string }) => {
    let prevented = false;
    const handled = input.key({ ...none, ...event, preventDefault() { prevented = true; }, stopPropagation() {} }, options);
    return { handled, prevented };
  };
  try {
    assert.equal(wheel({}), false, '不在视频上照常滚动页面');
    assert.equal(wheel({}, '7'), true);
    assert.equal(wheel({ shiftKey: true }, '7'), false, 'Shift+滚轮是横向滚动');
    assert.equal(wheel({ deltaX: 100, deltaY: 0 }, '7'), false, '悬停时横向手势留给页面');
    assert.equal(wheel({ ctrlKey: true }, '7'), false, 'Ctrl+滚轮是缩放');
    assert.equal(wheel({ altKey: true }), true);
    assert.equal(wheel({ altKey: true, deltaX: -100, deltaY: 0 }), true, 'macOS 的横向滚动量照常可用');
    flush();
    assert.deepEqual(sent, [[{ type: 'volume', delta: -10 }, '7'], [{ type: 'volume', delta: -10 }, undefined], [{ type: 'volume', delta: 10 }, undefined]]);

    assert.deepEqual(key({ key: 'Alt', type: 'keyup' }), { handled: true, prevented: true }, 'Alt+滚轮后松开 Alt 不打开浏览器菜单');
    assert.deepEqual(key({ key: 'Alt', type: 'keyup' }), { handled: false, prevented: false }, '单独按 Alt 不拦截');
    wheel({ altKey: true });
    key({ key: 'Alt', type: 'keydown', altKey: true });
    assert.deepEqual(key({ key: 'Alt', type: 'keyup' }), { handled: false, prevented: false }, '重新按下 Alt 后不再吞掉松开');
    flush();

    sent.length = 0;
    assert.equal(key({ key: 'ArrowUp', code: 'ArrowUp' }, { singleKey: true }).handled, false);
    assert.equal(key({ key: 'ArrowUp', code: 'ArrowUp' }, { singleKey: true, target: '3' }).handled, true);
    assert.equal(key({ key: 'k', code: 'KeyK' }, { singleKey: true, target: '3' }).handled, true);
    assert.deepEqual(key({ key: 'k', code: 'KeyK', type: 'keyup' }, { singleKey: true }), { handled: true, prevented: true }, '松开也拦下，避免网站同名快捷键再执行');
    flush();
    assert.deepEqual(sent, [[{ type: 'volume', delta: 10 }, '3'], [{ type: 'toggle' }, undefined]]);
  } finally { input.dispose(); await window.happyDOM.close(); }
});

test('演示页按设置启用单键模式', async () => {
  const window = new Window({ url: 'https://example.com' });
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
  let settings: Settings = defaultSettings;
  const listeners = new Set<(next: Settings) => void>();
  const demo = createDemo(window.document as unknown as Document, {
    src: '/demo.wav', title: 'Test media',
    store: { async load() { return settings; }, async save(next) { settings = next; }, watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; } }
  });
  const dispose = demo.listenHotkeys(window as unknown as globalThis.Window);
  const press = () => {
    const event = new window.KeyboardEvent('keydown', { key: 'm', code: 'KeyM', bubbles: true, cancelable: true });
    window.document.body.dispatchEvent(event);
    return event.defaultPrevented;
  };
  try {
    await Promise.resolve();
    assert.equal(press(), false);
    settings = { ...defaultSettings, singleKey: true };
    for (const listener of listeners) listener(settings);
    assert.equal(press(), true);
  } finally { dispose(); demo.destroy(); await window.happyDOM.close(); }
});
