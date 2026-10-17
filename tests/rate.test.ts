import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { commandForHotkey, createHotkeySession, hotkeyFromKeyboard, isHotkeyAction } from '../lib/hotkey';
import { readFlatMessages } from '../lib/message-catalog';
import { isMediaCommand } from '../lib/media';
import { formatRate, maxRate, minRate, nextRate, readSettledRate } from '../lib/rate';
import type { MediaState } from '../lib/types';

const mods = { altKey: true, shiftKey: true, ctrlKey: false, metaKey: false };

test('倍速对齐到 0.25 网格，并停在 0.25× 与 4×', () => {
  assert.equal(minRate, 0.25);
  assert.equal(maxRate, 4);
  assert.equal(nextRate(1, 1), 1.25);
  assert.equal(nextRate(1, -1), 0.75);
  assert.equal(nextRate(1.1, 1), 1.25);
  assert.equal(nextRate(1.1, -1), 1);
  assert.equal(nextRate(1.249, 1), 1.25);
  assert.equal(nextRate(1.249, -1), 1);
  assert.equal(nextRate(1.2500000001, 1), 1.5);
  assert.equal(nextRate(3.9, 1), 4);
  assert.equal(nextRate(3.9, -1), 3.75);
  assert.equal(nextRate(0.1, 1), 0.25);
  assert.equal(nextRate(0.1, -1), 0.25);
  assert.equal(nextRate(0.25, -1), 0.25);
  assert.equal(nextRate(4, 1), 4);
  assert.equal(nextRate(4.5, 1), 4);
  assert.equal(nextRate(4.5, -1), 4);
  assert.equal(nextRate(1.5, 0), 1);
  assert.equal(nextRate(1, 0), 1);
  assert.equal(nextRate(Number.NaN, 1), minRate);
  assert.equal(formatRate(1.5), '1.5');
  assert.equal(formatRate(1.333), '1.33');
  assert.equal(isMediaCommand({ type: 'rate', value: minRate }), true);
  assert.equal(isMediaCommand({ type: 'rate', value: maxRate }), true);
  assert.equal(isMediaCommand({ type: 'rate', value: minRate - 0.01 }), false);
  assert.equal(isMediaCommand({ type: 'rate', value: maxRate + 0.01 }), false);
});

test('倍速按键认字符，也认 Mac Option 改写后的 code', () => {
  const rate = (event: { key: string; code?: string; altKey?: boolean; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => hotkeyFromKeyboard({ ...mods, ...event });
  for (const event of [
    { key: '.', code: 'Period' },
    { key: '>', code: 'Period' },
    { key: '˘', code: 'Period' },
    { key: '.', code: 'Semicolon' }
  ]) assert.deepEqual(rate(event), { type: 'rate', direction: 1 });
  for (const event of [
    { key: ',', code: 'Comma' },
    { key: '<', code: 'Comma' },
    { key: '≤', code: 'Comma' }
  ]) assert.deepEqual(rate(event), { type: 'rate', direction: -1 });
  for (const event of [
    { key: '0', code: 'Digit0' },
    { key: ')', code: 'Digit0' },
    { key: 'º', code: 'Digit0' }
  ]) assert.deepEqual(rate(event), { type: 'rate', direction: 0 });
  assert.deepEqual(rate({ key: 'ArrowUp' }), { type: 'volume', delta: 10 });
  assert.equal(rate({ key: '>', code: 'Period', altKey: false }), null);
  assert.equal(rate({ key: '.', code: 'Period', shiftKey: false }), null);
  assert.equal(rate({ key: '.', code: 'Period', ctrlKey: true }), null);
  assert.equal(rate({ key: '.', code: 'Period', metaKey: true }), null);
  assert.equal(rate({ key: 'ArrowLeft', code: 'ArrowLeft' }), null);
  assert.equal(rate({ key: 'e', code: 'KeyE' }), null);
  assert.equal(isHotkeyAction({ type: 'rate', direction: 0 }), true);
  assert.equal(isHotkeyAction({ type: 'rate', direction: 2 }), false);
  assert.equal(isHotkeyAction({ type: 'rate', direction: 0.25 }), false);
});

test('说明使用 , . 0 字符，面板同时提到音量和倍速', () => {
  const read = (file: string) => readFlatMessages(readFileSync(new URL(`../locales/${file}`, import.meta.url), 'utf8'));
  const zh = read('zh_CN.yml');
  assert.equal(zh.volumeShortcut, 'Alt+Shift 调节音量和倍速');
  assert.equal(zh.speedHint, '倍速 {rate}×');
  assert.match(zh.shortcutsRateKeys ?? '', /, \. 0/);
  for (const file of ['de.yml', 'en.yml', 'es.yml', 'fr.yml', 'ja.yml', 'ko.yml', 'zh_CN.yml', 'zh_TW.yml']) {
    const note = read(file).shortcutsRateKeys ?? '';
    assert.match(note, /,/);
    assert.match(note, /\./);
    assert.match(note, /0/);
    assert.equal(/period key|comma key|键帽|Period|Comma/.test(note), false);
  }
});

test('连按按顺序生效，松开按键不再跳一档，页面自己的 Shift+. 仍会收到', async () => {
  const window = new Window({ url: 'https://example.com' });
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true });
  let rate = 1.1;
  const seen: number[] = [];
  const media = { rate } as MediaState;
  const input = createHotkeySession(async action => {
    await new Promise(resolve => setTimeout(resolve, 1));
    assert.equal(action.type, 'rate');
    media.rate = rate;
    const command = commandForHotkey(action, media);
    if (command?.type === 'rate') rate = command.value;
    seen.push(rate);
  });
  const key = (type: string, event: { key: string; code: string; altKey?: boolean; shiftKey?: boolean }) => {
    let stopped = false;
    const handled = input.key({
      ...mods, type, ...event,
      preventDefault() {},
      stopPropagation() { stopped = true; },
      stopImmediatePropagation() { stopped = true; }
    });
    return { handled, stopped };
  };
  try {
    const faster = { key: '˘', code: 'Period' };
    const slower = { key: '<', code: 'Comma' };
    key('keydown', faster);
    key('keyup', faster);
    key('keydown', faster);
    key('keydown', slower);
    key('keydown', { key: 'º', code: 'Digit0' });
    await window.happyDOM.waitUntilComplete();
    for (let attempt = 0; seen.length < 4 && attempt < 50; attempt++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.deepEqual(seen, [1.25, 1.5, 1.25, 1]);
    const siteOnly = key('keydown', { key: '>', code: 'Period', altKey: false, shiftKey: true });
    assert.equal(siteOnly.handled, false);
    assert.equal(siteOnly.stopped, false);

    let pageSteps = 0;
    const countSite = (event: Event) => {
      const keyEvent = event as KeyboardEvent;
      if (keyEvent.shiftKey && (keyEvent.code === 'Period' || keyEvent.key === '>' || keyEvent.key === '.')) pageSteps += 1;
    };
    window.document.addEventListener('keydown', countSite as never);
    window.document.addEventListener('keyup', countSite as never);
    const listen = (event: KeyboardEvent) => { input.key(event); };
    window.addEventListener('keydown', listen as never, true);
    window.addEventListener('keyup', listen as never, true);
    const dispatch = (type: string, altKey: boolean) => {
      const event = new window.KeyboardEvent(type, { key: '>', code: 'Period', bubbles: true, cancelable: true });
      Object.assign(event, { altKey, shiftKey: true, ctrlKey: false, metaKey: false });
      window.document.body.dispatchEvent(event);
      return event;
    };
    const ours = dispatch('keydown', true);
    dispatch('keyup', true);
    assert.equal(pageSteps, 0);
    assert.equal(ours.defaultPrevented, true);
    dispatch('keydown', false);
    assert.equal(pageSteps, 1);
  } finally {
    input.dispose();
    await window.happyDOM.close();
  }
});

test('播放器在稍后改回倍速时，读到的是改回后的值', async () => {
  const window = new Window({ url: 'https://example.com' });
  const media = window.document.createElement('video');
  window.document.body.append(media);
  media.playbackRate = 1.5;
  window.setTimeout(() => { media.playbackRate = 1.1; }, 0);
  const pending = readSettledRate(media as unknown as HTMLMediaElement);
  await window.happyDOM.waitUntilComplete();
  assert.equal(await pending, 1.1);
  await window.happyDOM.close();
});
