import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { normalizeCoarseStep, normalizeSettings } from '../lib/settings';
import { bareVolumeWheel, commandForHotkey, createHotkeyInput, isHotkeyAction, isTypingFocus, keepShiftWheel, type HotkeyAction } from '../lib/hotkey';
import { defaultSettings, type MediaState, type Settings, type SettingsStore } from '../lib/types';

const media = { id: '1', paused: false, muted: false, volume: .4, maxVolume: 2, rate: 1 } as MediaState;
const none = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false };

test('粗调步长默认 20%，和音量步长分开保存', () => {
  assert.equal(defaultSettings.coarseStep, 20);
  assert.equal(defaultSettings.volumeStep, 10);
  assert.equal(normalizeCoarseStep(undefined), 20);
  assert.equal(normalizeSettings(null).coarseStep, 20);
  assert.equal(normalizeSettings({}).coarseStep, 20, '没有这一项时仍是 20%');
  for (const step of [5, 10, 20]) assert.equal(normalizeSettings({ coarseStep: step }).coarseStep, step);
  for (const step of [0, 1, 15, 50, '20', false, null]) assert.equal(normalizeSettings({ coarseStep: step }).coarseStep, 20, String(step));
  assert.equal(normalizeSettings({ coarseStep: 5, volumeStep: 20 }).volumeStep, 20);
  const settings = normalizeSettings({ ...defaultSettings, coarseStep: 5, volumeStep: 10 });
  const text = serializeSettings(settings, '1.7.0');
  assert.match(text, /"coarseStep": 5/);
  const parsed = parseSettingsBackup(text);
  assert.equal(parsed.ok && parsed.settings.coarseStep, 5);
  assert.equal(parsed.ok && parsed.settings.volumeStep, 10);
  const dirty = JSON.parse(text) as { settings: { coarseStep?: unknown } };
  delete dirty.settings.coarseStep;
  const legacy = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(legacy.ok && legacy.settings.coarseStep, 20);
  dirty.settings.coarseStep = 15;
  const cleaned = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(cleaned.ok && cleaned.settings.coarseStep, 20);
});

test('按住 Shift 的滚轮用粗调步长，并跳过低音量 1%', () => {
  const low = { ...media, volume: .1 };
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1 }, media), { type: 'volume', value: .5 }, '不按 Shift 仍是 10%');
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1, coarse: true }, media), { type: 'volume', value: .6 }, '默认粗档是 20%');
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1 }, low), { type: 'volume', value: .11 }, '低音量仍自动 1%');
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1, coarse: true }, low), { type: 'volume', value: .3 }, 'Shift 优先于自动细调');
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1, coarse: true }, low, null, undefined, false, 10, false, 'up', 5), { type: 'volume', value: .15 });
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: -1, coarse: true }, low, null, undefined, false, 20, true, 'down', 20), { type: 'volume', value: .3 }, '反向时粗档仍是 20%，不是 1%');
  assert.deepEqual(commandForHotkey({ type: 'volume', delta: 10 }, low), { type: 'volume', value: .2 }, '方向键不改用粗档');
  assert.equal(isHotkeyAction({ type: 'volume', notches: 1, coarse: true }), true);
  assert.equal(keepShiftWheel({ altKey: false, shiftKey: true }, true), true);
  assert.equal(keepShiftWheel({ altKey: true, shiftKey: true }, true), false, '输入框里 Alt+滚轮仍然调音');
  assert.equal(keepShiftWheel({ altKey: false, shiftKey: false }, true), false);
  assert.equal(keepShiftWheel({ altKey: false, shiftKey: true }, false), false);
  assert.equal(bareVolumeWheel({ ...none, deltaX: 0, deltaY: -100 }, true), true);
  assert.equal(bareVolumeWheel({ ...none, shiftKey: true, deltaX: -100, deltaY: 0 }, true), true, '浏览器把 Shift+滚轮改成横向后仍算音量');
  assert.equal(bareVolumeWheel({ ...none, deltaX: -100, deltaY: 0 }, true), false, '没有 Shift 的横向滚轮留给页面');
  assert.equal(bareVolumeWheel({ ...none, shiftKey: true, deltaX: 0, deltaY: -100 }, false), false);
  assert.equal(bareVolumeWheel({ ...none, altKey: true, deltaX: 0, deltaY: -100 }, true), false, 'Alt 不走悬停闸门');
});

test('视频上的 Shift+滚轮上报粗档，视频外留给页面，Alt+Shift 仍可随处调音', async () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
  let frame: FrameRequestCallback | undefined;
  Object.defineProperty(window, 'requestAnimationFrame', { value: (callback: FrameRequestCallback) => { frame = callback; return 1; } });
  const input = window.document.createElement('input');
  window.document.body.append(input);
  input.focus();
  assert.equal(isTypingFocus(window.document), true);
  const plain = window.document.createElement('div');
  plain.tabIndex = 0;
  window.document.body.append(plain);
  plain.focus();
  assert.equal(isTypingFocus(window.document), false);
  const sent: [HotkeyAction, string | undefined][] = [];
  const hotkey = createHotkeyInput((action, target) => { sent.push([action, target]); });
  const wheel = (extra: Partial<typeof none> & { deltaX?: number; deltaY?: number }, target?: string) => {
    let prevented = false;
    const handled = hotkey.wheel({ ...none, deltaX: 0, deltaY: -100, deltaMode: 0, ...extra, preventDefault() { prevented = true; }, stopPropagation() {} }, target);
    assert.equal(prevented, handled);
    return handled;
  };
  try {
    assert.equal(wheel({ shiftKey: true }), false, '不在视频上的 Shift+滚轮留给页面');
    assert.equal(wheel({ shiftKey: true }, '7'), true);
    assert.equal(wheel({ altKey: true, shiftKey: true }), true, 'Alt+Shift 仍是任意位置调音');
    assert.equal(wheel({ altKey: true }), true);
    assert.equal(wheel({ shiftKey: true, deltaX: -100, deltaY: 0 }, '7'), true);
    assert.equal(wheel({ ctrlKey: true, shiftKey: true }, '7'), false);
    frame?.(0);
    assert.deepEqual(sent, [
      [{ type: 'volume', notches: 1, coarse: true }, '7'],
      [{ type: 'volume', notches: 1, coarse: true }, undefined],
      [{ type: 'volume', notches: 1 }, undefined],
      [{ type: 'volume', notches: 1, coarse: true }, '7']
    ]);
  } finally {
    hotkey.dispose();
    await window.happyDOM.close();
  }
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
    const text = playback?.textContent ?? '';
    assert.match(text, /音量调节步长/);
    assert.match(text, /滚轮、单键模式方向键和浏览器扩展命令的音量增减都按这个步长/);
    assert.match(text, /粗调步长/);
    assert.match(text, /按住 Shift 滚动时按这个步长改音量/);
    assert.match(text, /优先于低于 25% 的自动细调/);
    const coarse = host.querySelector('#settings-coarse-step');
    assert.ok(coarse);
    const button = (label: string) => [...coarse.querySelectorAll('button')].find(item => item.textContent === label);
    assert.equal(button('20%')?.getAttribute('aria-pressed'), 'true');
    assert.equal(button('10%')?.getAttribute('aria-pressed'), 'false');
    await act(async () => { button('5%')?.click(); });
    assert.equal(value.coarseStep, 5);
    assert.equal(value.volumeStep, 10);
    assert.equal(button('5%')?.getAttribute('aria-pressed'), 'true');
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
