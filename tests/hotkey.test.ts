import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { actionForCommand, commandBindings, extensionCommands, formatCommandShortcut, manifestCommands, shortcutsSettingsUrl } from '../lib/commands';
import { createDemo } from '../lib/demo';
import { actionHintKey, commandForHotkey, planHotkey } from '../lib/hotkey';
import { defaultSettings, type MediaState } from '../lib/types';

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

const media = { id: '1', paused: false, muted: false, volume: .5, maxVolume: 2, rate: 1.5 } as MediaState;

test('扩展命令映射到同一套媒体指令，建议键避开 Alt+Shift', () => {
  assert.deepEqual(commandForHotkey(actionForCommand('play-pause')!, { ...media, paused: true }), { type: 'play' });
  assert.deepEqual(commandForHotkey(actionForCommand('play-pause')!, media), { type: 'pause' });
  assert.deepEqual(actionHintKey(actionForCommand('play-pause')!, { ...media, paused: true }), 'play');
  assert.deepEqual(actionHintKey(actionForCommand('play-pause')!, media), 'paused');
  assert.deepEqual(commandForHotkey(actionForCommand('skip-back')!, media), { type: 'skip', value: -10 });
  assert.deepEqual(commandForHotkey(actionForCommand('skip-forward')!, media), { type: 'skip', value: 10 });
  assert.equal(actionHintKey(actionForCommand('skip-back')!, media), 'skipBack');
  assert.equal(actionHintKey(actionForCommand('skip-forward')!, media), 'skipForward');
  assert.deepEqual(commandForHotkey(actionForCommand('mute')!, media), { type: 'mute' });
  assert.equal(actionHintKey(actionForCommand('mute')!, media), 'mute');
  assert.equal(actionHintKey(actionForCommand('mute')!, { ...media, muted: true }), 'unmute');
  assert.deepEqual(commandForHotkey(actionForCommand('volume-up')!, { ...media, volume: .95 }), { type: 'volume', value: 1 });
  assert.deepEqual(commandForHotkey(actionForCommand('volume-down')!, media), { type: 'volume', value: .4 });
  assert.deepEqual(commandForHotkey(actionForCommand('rate-faster')!, media), { type: 'rate', value: 1.75 });
  assert.deepEqual(commandForHotkey(actionForCommand('rate-slower')!, media), { type: 'rate', value: 1.25 });
  assert.deepEqual(commandForHotkey(actionForCommand('rate-reset')!, media), { type: 'rate', value: 1 });
  assert.equal(commandForHotkey(actionForCommand('rate-reset')!, { ...media, rate: 1 }), null);
  assert.equal(actionForCommand('missing'), null);
  const page = { host: 'example.com', enabled: true, media: [media], selectedId: '1' };
  assert.equal(planHotkey({ ...page, enabled: false }, actionForCommand('play-pause')!), null);
  assert.equal(planHotkey({ ...page, media: [] }, actionForCommand('mute')!), null);
  assert.deepEqual(planHotkey(page, actionForCommand('skip-forward')!)?.command, { type: 'skip', value: 10 });

  const suggested = extensionCommands.filter(command => 'suggestedKey' in command);
  assert.equal(suggested.length, 4);
  assert.deepEqual(suggested.map(command => command.name), ['play-pause', 'skip-back', 'skip-forward', 'mute']);
  for (const name of ['volume-up', 'volume-down', 'rate-faster', 'rate-slower', 'rate-reset']) {
    assert.equal('suggestedKey' in extensionCommands.find(command => command.name === name)!, false);
  }
  const manifest = manifestCommands();
  assert.equal(Object.keys(manifest).length, 9);
  for (const command of suggested) {
    for (const key of [command.suggestedKey.default, command.suggestedKey.mac]) {
      assert.equal(/Alt\+Shift|Shift\+Alt|Option\+Shift|Shift\+Option/.test(key), false, key);
      assert.equal(/Ctrl\+Alt|Alt\+Ctrl/.test(key), false, key);
      assert.match(key, /^(Ctrl|Command)\+Shift\+/);
    }
    const entry = manifest[command.name];
    assert.ok(entry);
    assert.equal(entry.description, `__MSG_${command.message}__`);
    assert.equal(entry.suggested_key?.default, command.suggestedKey.default);
  }
  const volumeUp = manifest['volume-up'];
  assert.ok(volumeUp);
  assert.equal(volumeUp.suggested_key, undefined);
  assert.equal(formatCommandShortcut('Ctrl+Shift+Comma'), 'Ctrl + Shift + ,');
  assert.equal(formatCommandShortcut(''), '');
  assert.equal(shortcutsSettingsUrl('Mozilla/5.0 Edg/140.0.0.0'), 'edge://extensions/shortcuts');
  assert.equal(shortcutsSettingsUrl('Mozilla/5.0 Chrome/140.0.0.0'), 'chrome://extensions/shortcuts');
  assert.deepEqual(commandBindings([{ name: 'mute', shortcut: 'Alt+M' }, { name: 'volume-up', shortcut: '' }]).map(row => [row.name, row.shortcut]), [
    ['play-pause', ''], ['skip-back', ''], ['skip-forward', ''], ['mute', 'Alt + M'], ['volume-up', ''], ['volume-down', ''], ['rate-faster', ''], ['rate-slower', ''], ['rate-reset', '']
  ]);
});
