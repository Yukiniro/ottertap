import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { normalizeSettings } from '../lib/settings';
import { commandForHotkey, createHotkeyInput, directedWheelNotches, wheelNotches, type HotkeyAction } from '../lib/hotkey';
import { defaultSettings, type MediaState, type Settings, type SettingsStore } from '../lib/types';

const media = { id: '1', paused: false, muted: false, volume: .5, maxVolume: 2, rate: 1 } as MediaState;

test('滚轮方向默认向上增大，只翻转滚轮刻度的符号', () => {
  assert.equal(defaultSettings.wheelDirection, 'up');
  assert.equal(normalizeSettings(null).wheelDirection, 'up');
  assert.equal(normalizeSettings({}).wheelDirection, 'up', '没有这一项时仍向上增大');
  assert.equal(normalizeSettings({ wheelDirection: 'down' }).wheelDirection, 'down');
  assert.equal(normalizeSettings({ wheelDirection: 'up' }).wheelDirection, 'up');
  for (const value of ['sideways', 1, false, null, '']) assert.equal(normalizeSettings({ wheelDirection: value }).wheelDirection, 'up');
  assert.equal(wheelNotches(-100, 0), 1, '向上滚轮的事件符号不变');
  assert.equal(wheelNotches(100, 0), -1);
  assert.equal(directedWheelNotches(1), 1);
  assert.equal(directedWheelNotches(1, 'up'), 1);
  assert.equal(directedWheelNotches(-2, 'up'), -2);
  assert.equal(directedWheelNotches(1, 'down'), -1);
  assert.equal(directedWheelNotches(-1, 'down'), 1);
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1 }, media), { type: 'volume', value: .6 });
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1 }, media, null, undefined, false, 10, true, 'down'), { type: 'volume', value: .4 });
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: -1 }, media, null, undefined, false, 10, true, 'down'), { type: 'volume', value: .6 });
  assert.deepEqual(commandForHotkey({ type: 'volume', delta: 10 }, media, null, undefined, false, 10, true, 'down'), { type: 'volume', value: .6 }, '方向键不跟着反');
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1 }, { ...media, volume: .1 }, null, undefined, false, 10, true, 'down'), { type: 'volume', value: .09 }, '反向时低音量仍按 1%');
  assert.deepEqual(commandForHotkey({ type: 'volume', notches: 1 }, { ...media, volume: .4 }, null, undefined, false, 20, false, 'down'), { type: 'volume', value: .2 }, '细档关闭时反向用音量步长');
});

test('悬停滚轮上报的刻度不因方向设置改写', () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
  let frame: FrameRequestCallback | undefined;
  Object.defineProperty(window, 'requestAnimationFrame', { value: (callback: FrameRequestCallback) => { frame = callback; return 1; } });
  const sent: HotkeyAction[] = [];
  const input = createHotkeyInput(action => { sent.push(action); });
  const wheel = (deltaY: number, altKey = false) => {
    let prevented = false;
    const handled = input.wheel({ deltaX: 0, deltaY, deltaMode: 0, altKey, shiftKey: false, ctrlKey: false, metaKey: false, preventDefault() { prevented = true; }, stopPropagation() {} }, altKey ? undefined : 'media');
    assert.equal(prevented, handled);
    return handled;
  };
  try {
    assert.equal(wheel(-100), true);
    assert.equal(wheel(100, true), true);
    frame?.(0);
    assert.deepEqual(sent, [{ type: 'volume', notches: 1 }, { type: 'volume', notches: -1 }]);
  } finally { input.dispose(); }
});

test('导出和导入带着滚轮方向，缺省仍是向上增大', () => {
  const settings = normalizeSettings({ ...defaultSettings, wheelDirection: 'down', volumeStep: 5 });
  const text = serializeSettings(settings, '1.7.0');
  assert.match(text, /"wheelDirection": "down"/);
  const parsed = parseSettingsBackup(text);
  assert.equal(parsed.ok && parsed.settings.wheelDirection, 'down');
  assert.equal(parsed.ok && parsed.settings.volumeStep, 5);
  const dirty = JSON.parse(text) as { settings: { wheelDirection?: unknown } };
  delete dirty.settings.wheelDirection;
  const legacy = parseSettingsBackup(JSON.stringify(dirty));
  assert.equal(legacy.ok && legacy.settings.wheelDirection, 'up');
});

test('设置页滚轮方向默认向上增大，切换后立刻写入', async () => {
  const window = new Window({ url: 'https://example.com/options' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { SettingsPage } = await import('../components/settings-page');
  let value: Settings = { ...defaultSettings, theme: 'light', hoverWheel: false };
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const option = (label: string) => [...host.querySelectorAll('button')].find(item => item.textContent === label);
  const click = async (element: { click(): void }) => { await act(async () => { element.click(); }); };
  try {
    await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
    const playback = host.querySelector('#playback');
    assert.match(playback?.textContent ?? '', /滚轮方向/);
    assert.match(playback?.textContent ?? '', /向上增大/);
    assert.match(playback?.textContent ?? '', /向下增大/);
    assert.match(playback?.textContent ?? '', /只作用于悬停在主播放区的滚轮和 Alt\+滚轮/);
    assert.match(playback?.textContent ?? '', /页面本身的滚动方向不变/);
    assert.equal(host.querySelector('#settings-wheel-direction')?.getAttribute('aria-labelledby'), 'wheel-direction-label');
    assert.equal(option('向上增大')?.getAttribute('aria-pressed'), 'true');
    assert.equal(option('向下增大')?.getAttribute('aria-pressed'), 'false');
    await click(option('向下增大')!);
    assert.equal(value.wheelDirection, 'down');
    assert.equal(value.hoverWheel, false);
    assert.equal(option('向下增大')?.getAttribute('aria-pressed'), 'true');
    assert.equal(option('向上增大')?.getAttribute('aria-pressed'), 'false');
    await click(option('向上增大')!);
    assert.equal(value.wheelDirection, 'up');
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
