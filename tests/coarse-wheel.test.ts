import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { normalizeCoarseVolumeStep, normalizeSettings } from '../lib/settings';
import { commandForHotkey, createHotkeyInput, isHotkeyAction, type HotkeyAction } from '../lib/hotkey';
import { createHoverWheelGesture, hoverWheelTrackTarget } from '../lib/hover-wheel';
import { volumeStepForWheel } from '../lib/volume';
import { defaultSettings, type MediaState, type Settings, type SettingsStore } from '../lib/types';

const media = { id: '1', paused: false, muted: false, volume: .1, maxVolume: 2, rate: 1 } as MediaState;
const wheelEvent = (shiftKey: boolean, extra: { altKey?: boolean; ctrlKey?: boolean; deltaY?: number } = {}) => ({
  altKey: extra.altKey === true,
  shiftKey,
  ctrlKey: extra.ctrlKey === true,
  metaKey: false,
  deltaY: extra.deltaY ?? -100
});

test('按住 Shift 用粗调步长，并优先于低于 25% 的细档', () => {
  assert.equal(defaultSettings.coarseVolumeStep, 50);
  assert.equal(normalizeCoarseVolumeStep(undefined), 50);
  assert.equal(normalizeSettings({}).coarseVolumeStep, 50, '没有这一项时默认 50%');
  assert.equal(normalizeSettings({ coarseVolumeStep: 20 }).coarseVolumeStep, 20);
  for (const step of [0, 5, 10, 15, 25, 30, 100, '50', true, null]) {
    assert.equal(normalizeSettings({ coarseVolumeStep: step }).coarseVolumeStep, 50, String(step));
  }
  assert.equal(volumeStepForWheel(10, 10, true, true, 50), 50);
  assert.equal(volumeStepForWheel(10, 10, true, true, 20), 20);
  assert.equal(volumeStepForWheel(10, 10, true, true, 7), 50, '非法粗档回到 50');
  assert.equal(volumeStepForWheel(10, 10, true), 1, '没按 Shift 时低音量仍是 1%');
  assert.equal(volumeStepForWheel(40, 10, true), 10);
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1, shift: true }, media), { type: 'volume', value: .6 });
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1 }, media), { type: 'volume', value: .11 });
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1, shift: true }, { ...media, volume: .4 }), { type: 'volume', value: .9 });
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1 }, { ...media, volume: .4 }), { type: 'volume', value: .5 });
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1, shift: true }, media, null, undefined, false, 10, true, 'up', 20), { type: 'volume', value: .3 });
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1, shift: true }, media, null, undefined, false, 20, false, 'up', 20), { type: 'volume', value: .3 }, '细档关掉时 Shift 仍用粗档');
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: -1, shift: true }, { ...media, volume: .4 }, null, undefined, false, 10, true, 'down', 50), { type: 'volume', value: .9 }, '反向只改符号，粗档幅度不变');
  assert.deepEqual(commandForHotkey({ type: 'volume', delta: 10 }, media, null, undefined, false, 10, true, 'up', 50), { type: 'volume', value: .2 }, '方向键不走粗档');
  assert.equal(isHotkeyAction({ type: 'volume', notches: 1, shift: true }), true);
  assert.equal(isHotkeyAction({ type: 'volume', notches: 1, shift: false }), false);
  assert.equal(isHotkeyAction({ type: 'volume', delta: 10, shift: true }), false);
});

test('Shift 只改步长，不改滚轮在哪里生效；输入框聚焦时不加入悬停手势', () => {
  assert.equal(hoverWheelTrackTarget(wheelEvent(true), '1', true, false), '1');
  assert.equal(hoverWheelTrackTarget(wheelEvent(false), '1', true, false), '1');
  assert.equal(hoverWheelTrackTarget(wheelEvent(true), '1', true, true), undefined, '输入框聚焦时 Shift 滚轮留给页面');
  assert.equal(hoverWheelTrackTarget(wheelEvent(false), '1', true, true), '1', '没按 Shift 时聚焦不改变悬停滚轮');
  assert.equal(hoverWheelTrackTarget(wheelEvent(true, { altKey: true }), '1', true, false), undefined, 'Alt 不走悬停手势');
  assert.equal(hoverWheelTrackTarget(wheelEvent(true, { ctrlKey: true }), '1', true, false), undefined);
  assert.equal(hoverWheelTrackTarget(wheelEvent(true, { deltaY: 0 }), '1', true, false), undefined);
  assert.equal(hoverWheelTrackTarget(wheelEvent(true), '1', false, false), undefined);
  const gesture = createHoverWheelGesture();
  assert.equal(gesture(hoverWheelTrackTarget(wheelEvent(false), '1', true, false), 0), '1');
  assert.equal(gesture(hoverWheelTrackTarget(wheelEvent(true), '1', true, false), 100), '1', '按住 Shift 的下一格仍算同一次调音');
  assert.equal(gesture(hoverWheelTrackTarget(wheelEvent(true), '1', true, true), 150), undefined);
});

test('播放器上的 Shift+滚轮上报粗档，播放器外和横向滚轮不拦截', async () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
  let frame: FrameRequestCallback | undefined;
  Object.defineProperty(window, 'requestAnimationFrame', { value: (callback: FrameRequestCallback) => { frame = callback; return 1; } });
  const sent: HotkeyAction[] = [];
  const input = createHotkeyInput(action => { sent.push(action); });
  const wheel = (shiftKey: boolean, target?: string, extra: { altKey?: boolean; deltaX?: number; deltaY?: number } = {}) => {
    let prevented = false;
    const handled = input.wheel({
      deltaX: extra.deltaX ?? 0,
      deltaY: extra.deltaY ?? -100,
      deltaMode: 0,
      altKey: extra.altKey === true,
      shiftKey,
      ctrlKey: false,
      metaKey: false,
      preventDefault() { prevented = true; },
      stopPropagation() {}
    }, target);
    assert.equal(prevented, handled);
    return handled;
  };
  try {
    assert.equal(wheel(true, '7'), true);
    assert.equal(wheel(false, '7'), true);
    assert.equal(wheel(true), false, '播放器外的 Shift+滚轮留给页面');
    assert.equal(wheel(true, '7', { deltaX: 100, deltaY: 0 }), false, '横向 Shift+滚轮留给页面');
    assert.equal(wheel(true, undefined, { altKey: true }), true, 'Alt+Shift 仍可在任意位置调音');
    frame?.(0);
    assert.deepEqual(sent, [
      { type: 'volume', notches: 1, shift: true },
      { type: 'volume', notches: 1 },
      { type: 'volume', notches: 1, shift: true }
    ]);
  } finally { input.dispose(); await window.happyDOM.close(); }
});

test('导出和导入带着粗调步长，缺省仍是 50', () => {
  const settings = normalizeSettings({ ...defaultSettings, coarseVolumeStep: 20, volumeStep: 5 });
  const text = serializeSettings(settings, '1.7.0');
  assert.match(text, /"coarseVolumeStep": 20/);
  const parsed = parseSettingsBackup(text);
  assert.equal(parsed.ok && parsed.settings.coarseVolumeStep, 20);
  assert.equal(parsed.ok && parsed.settings.volumeStep, 5);
  const dirty = JSON.parse(text) as { settings: { coarseVolumeStep?: unknown } };
  delete dirty.settings.coarseVolumeStep;
  const legacy = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(legacy.ok && legacy.settings.coarseVolumeStep, 50);
  dirty.settings.coarseVolumeStep = 15;
  const cleaned = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(cleaned.ok && cleaned.settings.coarseVolumeStep, 50);
});

test('设置页音量步长下面有粗调步长，两档说明都在，并且单独保存', async () => {
  const window = new Window({ url: 'https://example.com/options' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { SettingsPage } = await import('../components/settings-page');
  let value: Settings = { ...defaultSettings, theme: 'light', volumeStep: 10 };
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
    const playback = host.querySelector('#playback');
    assert.match(playback?.textContent ?? '', /音量调节步长/);
    assert.match(playback?.textContent ?? '', /滚轮、单键模式方向键和浏览器扩展命令的音量增减都按这个步长/);
    assert.match(playback?.textContent ?? '', /粗调步长/);
    assert.match(playback?.textContent ?? '', /按住 Shift 滚动时用这个更大的步长/);
    assert.match(playback?.textContent ?? '', /Shift 优先于自动细档/);
    const coarse = host.querySelector('#settings-coarse-volume-step');
    assert.ok(coarse);
    const buttons = [...coarse.querySelectorAll('button')];
    assert.deepEqual(buttons.map(button => button.textContent), ['20%', '50%']);
    assert.equal(buttons.find(button => button.textContent === '50%')?.getAttribute('aria-pressed'), 'true');
    assert.equal(buttons.find(button => button.textContent === '20%')?.getAttribute('aria-pressed'), 'false');
    await act(async () => { buttons.find(button => button.textContent === '20%')!.click(); });
    assert.equal(value.coarseVolumeStep, 20);
    assert.equal(value.volumeStep, 10);
    assert.equal(value.fineWheel, true);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
