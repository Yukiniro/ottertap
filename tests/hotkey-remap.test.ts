import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act } from 'react';
import { createHoldGesture } from '../lib/hold-gesture';
import { isHoldRateChord } from '../lib/hold-rate';
import { skipHoldDirection } from '../lib/hold-skip';
import { createHotkeyInput, hotkeyFromKeyboard } from '../lib/hotkey';
import { defaultKeybinds, type Keybinds } from '../lib/keybinds';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

const none = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false };
const custom: Keybinds = { toggle: 'Space', skipBack: 'a', skipForward: 'd', rateUp: ']', rateDown: '[', mute: 'x', holdBoost: 'h', frameBack: 'q', frameForward: 'e' };

describe('页内快捷键改键', () => {
  test('改键后新键生效、旧键让给网站；方向键与 Alt 组合不变', () => {
    const single = (key: string, code: string, extra: Partial<typeof none> = {}, onMedia = false) => hotkeyFromKeyboard({ ...none, ...extra, key, code }, { singleKey: true, onMedia, keybinds: custom });
    assert.deepEqual(single(' ', 'Space'), { type: 'toggle' });
    assert.deepEqual(single('a', 'KeyA'), { type: 'skip', delta: -10 });
    assert.deepEqual(single('d', 'KeyD'), { type: 'skip', delta: 10 });
    assert.deepEqual(single(']', 'BracketRight'), { type: 'rate', direction: 1 });
    assert.deepEqual(single('[', 'BracketLeft'), { type: 'rate', direction: -1 });
    assert.deepEqual(single('x', 'KeyX'), { type: 'mute' });
    assert.deepEqual(single('q', 'KeyQ'), { type: 'frame', direction: -1 });
    assert.deepEqual(single('e', 'KeyE'), { type: 'frame', direction: 1 });
    for (const [key, code, extra] of [['k', 'KeyK', {}], ['j', 'KeyJ', {}], ['l', 'KeyL', {}], ['m', 'KeyM', {}], ['>', 'Period', { shiftKey: true }], ['<', 'Comma', { shiftKey: true }], [',', 'Comma', {}], ['.', 'Period', {}], [' ', 'Space', { shiftKey: true }]] as const) {
      assert.equal(single(key, code, extra), null, `${key} 改走之后留给网站`);
    }
    assert.deepEqual(single('ArrowLeft', 'ArrowLeft'), { type: 'skip', delta: -10 });
    assert.deepEqual(single('ArrowRight', 'ArrowRight'), { type: 'skip', delta: 10 });
    assert.deepEqual(single('ArrowUp', 'ArrowUp', {}, true), { type: 'volume', delta: 10 });
    assert.equal(single('ArrowLeft', 'ArrowLeft', { shiftKey: true }), null);
    assert.deepEqual(single('.', 'Period', { altKey: true }), { type: 'rate', direction: 1 }, 'Alt + . 固定');
    assert.deepEqual(single('m', 'KeyM', { altKey: true }), { type: 'mute' }, 'Alt + M 固定');
    assert.deepEqual(hotkeyFromKeyboard({ ...none, key: 'e', code: 'KeyE' }, { keybinds: custom }), { type: 'frame', direction: 1 }, '逐帧键不需要单键模式');
    assert.equal(hotkeyFromKeyboard({ ...none, key: ' ', code: 'Space' }, { keybinds: custom }), null, '单键动作仍要单键模式');
    assert.deepEqual(hotkeyFromKeyboard({ ...none, key: 'ф', code: 'KeyA' }, { singleKey: true, keybinds: custom }), { type: 'skip', delta: -10 }, '非拉丁布局按物理键');
  });

  test('按住临时加速认新的按住键，Alt + Shift + . 不变；同键加速跟着新的快进快退键', () => {
    assert.equal(isHoldRateChord({ ...none, key: 'h', code: 'KeyH' }, true, custom), true);
    assert.equal(isHoldRateChord({ ...none, key: 's', code: 'KeyS' }, true, custom), false, 'S 改走之后不再按住加速');
    assert.equal(isHoldRateChord({ ...none, key: 'h', code: 'KeyH' }, false, custom), false, '按住键属于单键模式');
    assert.equal(isHoldRateChord({ ...none, key: 'H', code: 'KeyH', shiftKey: true }, true, custom), false);
    assert.equal(isHoldRateChord({ ...none, altKey: true, shiftKey: true, key: '>', code: 'Period' }, false, custom), true);
    assert.equal(skipHoldDirection({ ...none, key: 'a', code: 'KeyA' }, true, custom), -1);
    assert.equal(skipHoldDirection({ ...none, key: 'd', code: 'KeyD' }, true, custom), 1);
    assert.equal(skipHoldDirection({ ...none, key: 'j', code: 'KeyJ' }, true, custom), null);
    assert.equal(skipHoldDirection({ ...none, key: 'ArrowLeft', code: 'ArrowLeft' }, true, custom), -1);

    let now = 0;
    const gesture = createHoldGesture(() => now);
    const input = { boost: true, skip: true, singleKey: true, keybinds: custom };
    assert.deepEqual(gesture.key({ ...none, type: 'keydown', key: 'h', code: 'KeyH' }, input), { type: 'start', armAlt: false });
    assert.deepEqual(gesture.key({ ...none, type: 'keyup', key: 'h', code: 'KeyH' }, input), { type: 'end' });
    assert.deepEqual(gesture.key({ ...none, type: 'keydown', key: 'd', code: 'KeyD' }, input), { type: 'arm' });
    now = 50;
    assert.deepEqual(gesture.key({ ...none, type: 'keyup', key: 'd', code: 'KeyD' }, input), { type: 'skip', direction: 1 });
    assert.deepEqual(gesture.key({ ...none, type: 'keydown', key: 's', code: 'KeyS' }, input), { type: 'ignore' });
  });

  test('Shift + 字母的键位先松 Shift 再松字母，松开仍被拦下', async () => {
    const window = new Window();
    Object.defineProperty(globalThis, 'window', { value: window, configurable: true, writable: true });
    Object.defineProperty(window, 'requestAnimationFrame', { value: () => 1 });
    const input = createHotkeyInput(() => {});
    const keybinds = { ...defaultKeybinds, toggle: 'K' };
    const key = (type: string, name: string, shiftKey: boolean) => {
      let prevented = false;
      const handled = input.key({ ...none, shiftKey, key: name, code: 'KeyK', type, preventDefault() { prevented = true; }, stopPropagation() {} }, { singleKey: true, keybinds });
      return { handled, prevented };
    };
    try {
      assert.deepEqual(key('keydown', 'K', true), { handled: true, prevented: true });
      assert.deepEqual(key('keyup', 'k', false), { handled: true, prevented: true }, '按物理键配对，不看松开时的 Shift');
      assert.deepEqual(key('keyup', 'k', false), { handled: false, prevented: false }, '配对只用一次');
      assert.deepEqual(key('keydown', 'k', false), { handled: false, prevented: false }, '不带 Shift 的 k 留给网站');
    } finally {
      input.dispose();
      await window.happyDOM.close();
    }
  });

  test('设置页：点按键再按新键即保存；撞键给出占用者并保持原值；Esc 取消；可恢复默认', async () => {
    const window = new Window({ url: 'https://example.com/options' });
    for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'FocusEvent', 'MutationObserver', 'ResizeObserver'] as const) {
      Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
    }
    for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
    const { createRoot } = await import('react-dom/client');
    const { ThemeProvider } = await import('../components/theme');
    const { SettingsPage } = await import('../components/settings-page');
    let value: Settings = { ...defaultSettings, singleKey: true };
    const listeners = new Set<(settings: Settings) => void>();
    const store: SettingsStore = {
      async load() { return value; },
      async save(next) { value = next; listeners.forEach(listener => listener(next)); },
      watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
    };
    const host = window.document.createElement('div');
    window.document.body.append(host);
    const root = createRoot(host as unknown as HTMLElement);
    const shortcuts = () => host.querySelector('#shortcuts')!;
    const keyButton = (action: string) => [...host.querySelectorAll('button')].find(item => item.getAttribute('aria-label')?.startsWith(`修改「${action}」的按键`)) as unknown as HTMLButtonElement | undefined;
    const recording = () => host.querySelector('button[aria-label="请按下新键"]') as unknown as HTMLButtonElement | null;
    const press = async (key: string, code: string, extra: Partial<typeof none> = {}) => {
      await act(async () => { recording()!.dispatchEvent(new window.KeyboardEvent('keydown', { key, code, ...extra, bubbles: true, cancelable: true }) as unknown as Event); });
    };
    const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    try {
      await act(async () => { root.render(createElement(ThemeProvider, { store, children: createElement(SettingsPage) })); });
      await settle();
      assert.equal(keyButton('播放或暂停')?.textContent, 'K');
      assert.equal(keyButton('后退 10 秒')?.getAttribute('aria-label'), '修改「后退 10 秒」的按键，当前为 J。');
      assert.match(shortcuts().textContent ?? '', /改动会立即在已打开的网页上生效/);
      assert.match(shortcuts().textContent ?? '', /逐帧使用不带修饰键的 , 和 \./, '默认文案和改键前一致');
      const reset = () => [...host.querySelectorAll('button')].find(item => item.textContent === '恢复默认按键') as unknown as HTMLButtonElement;
      assert.equal(reset().disabled, true);

      await act(async () => { keyButton('播放或暂停')!.click(); });
      assert.ok(recording(), '点一下进入录键');
      await press('j', 'KeyJ');
      assert.equal(host.querySelector('#keybind-error')?.textContent, 'J 已用于「后退 10 秒」。请换一个键，或先修改那一项。');
      assert.equal(recording()?.getAttribute('aria-describedby'), 'keybind-error');
      assert.equal(value.keybinds.toggle, 'k', '撞键不保存');
      await press('Shift', 'ShiftLeft', { shiftKey: true });
      assert.ok(recording(), '只按修饰键时继续等');
      await press('p', 'KeyP', { ctrlKey: true });
      assert.match(host.querySelector('#keybind-error')?.textContent ?? '', /这个键不能用/);
      await press(' ', 'Space');
      await settle();
      assert.equal(value.keybinds.toggle, 'Space');
      assert.equal(value.singleKey, true, '改键不用关掉单键模式');
      assert.equal(recording(), null);
      assert.equal(host.querySelector('#keybind-error'), null);
      assert.equal(keyButton('播放或暂停')?.textContent, '空格');

      await act(async () => { keyButton('按住临时加速')!.click(); });
      await press('Escape', 'Escape');
      assert.equal(recording(), null);
      assert.equal(value.keybinds.holdBoost, 's');

      await act(async () => { keyButton('暂停后上一帧')!.click(); });
      await press('ArrowUp', 'ArrowUp');
      assert.equal(host.querySelector('#keybind-error')?.textContent, '↑ 已用于「提高音量 10 个百分点」。请换一个键，或先修改那一项。');
      await press('q', 'KeyQ');
      await settle();
      assert.equal(value.keybinds.frameBack, 'q');
      assert.match(shortcuts().textContent ?? '', /逐帧使用不带修饰键的 Q 和 \./);

      assert.equal(reset().disabled, false);
      await act(async () => { reset().click(); });
      await settle();
      assert.deepEqual(value.keybinds, defaultKeybinds);
      assert.equal(keyButton('播放或暂停')?.textContent, 'K');
    } finally {
      await act(async () => { root.unmount(); });
      await window.happyDOM.close();
    }
  });
});
