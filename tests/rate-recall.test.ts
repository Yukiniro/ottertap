import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { actionForCommand } from '../lib/commands';
import { commandForHotkey, hotkeyFromKeyboard } from '../lib/hotkey';
import { readFlatMessages } from '../lib/message-catalog';
import { noteRecallRate, nextRate } from '../lib/rate';
import type { MediaState } from '../lib/types';

const media = { id: '1', paused: false, muted: false, volume: 1, maxVolume: 1, rate: 1.5 } as MediaState;
const reset = actionForCommand('rate-reset')!;

test('nextRate 在 0 方向上来回切换，其他方向仍按 0.25 步进', () => {
  assert.equal(nextRate(1.75, 0), 1);
  assert.equal(nextRate(1.75, 0, 2), 1);
  assert.equal(nextRate(1, 0), 1);
  assert.equal(nextRate(1, 0, null), 1);
  assert.equal(nextRate(1, 0, 1), 1);
  assert.equal(nextRate(1, 0, Number.NaN), 1);
  assert.equal(nextRate(1, 0, 1.75), 1.75);
  assert.equal(nextRate(1, 0, 1.1), 1.1);
  assert.equal(nextRate(1, 0, 0.1), 0.25);
  assert.equal(nextRate(1, 0, 8), 4);
  assert.equal(nextRate(1.5, 1, 3), 1.75);
  assert.equal(nextRate(1.5, -1, 3), 1.25);
  assert.equal(nextRate(1, 1, 3), 1.25);
});

test('noteRecallRate 只保留最近一次非 1×', () => {
  assert.equal(noteRecallRate(null, 1), null);
  assert.equal(noteRecallRate(null, Number.NaN), null);
  assert.equal(noteRecallRate(1.5, 1), 1.5);
  assert.equal(noteRecallRate(1.5, 1.75), 1.75);
  assert.equal(noteRecallRate(1.75, 1.1), 1.1);
  assert.equal(noteRecallRate(1.1, Number.NaN), 1.1);
});

test('commandForHotkey 的重置分支：非 1× 回到 1×，记过则切回，没记过则不动', () => {
  assert.deepEqual(commandForHotkey(reset, media), { type: 'rate', value: 1 });
  assert.deepEqual(commandForHotkey(reset, media, 2), { type: 'rate', value: 1 });
  assert.deepEqual(commandForHotkey(reset, { ...media, rate: 1 }, 1.75), { type: 'rate', value: 1.75 });
  assert.deepEqual(commandForHotkey(reset, { ...media, rate: 1 }, 1.1), { type: 'rate', value: 1.1 });
  assert.equal(commandForHotkey(reset, { ...media, rate: 1 }), null);
  assert.equal(commandForHotkey(reset, { ...media, rate: 1 }, null), null);
  assert.equal(commandForHotkey(reset, { ...media, rate: 1 }, 1), null);
  assert.deepEqual(commandForHotkey(actionForCommand('rate-faster')!, { ...media, rate: 1 }, 1.75), { type: 'rate', value: 1.25 });
  assert.deepEqual(hotkeyFromKeyboard({ key: '0', code: 'Digit0', altKey: true, shiftKey: false, ctrlKey: false, metaKey: false }, { singleKey: true }), { type: 'rate', direction: 0 });
  assert.equal(hotkeyFromKeyboard({ key: '0', code: 'Digit0', altKey: false, shiftKey: false, ctrlKey: false, metaKey: false }, { singleKey: true }), null);
});

test('八种语言的重置文案都改成可以来回切', () => {
  const expected: Record<string, { cmdRateReset: string; shortcutSpeedReset: string }> = {
    de: { cmdRateReset: 'Zwischen 1× und dem vorherigen Tempo wechseln', shortcutSpeedReset: 'Auf 1×, erneut drücken stellt zurück' },
    en: { cmdRateReset: 'Toggle between 1× and the previous speed', shortcutSpeedReset: 'Back to 1×, press again to restore' },
    es: { cmdRateReset: 'Alternar entre 1× y la velocidad anterior', shortcutSpeedReset: 'Volver a 1× y pulsar otra vez para volver' },
    fr: { cmdRateReset: 'Basculer entre 1× et la vitesse précédente', shortcutSpeedReset: 'Revenir à 1×, rappuyer pour rétablir' },
    ja: { cmdRateReset: '1× と直前の再生速度を切り替える', shortcutSpeedReset: '1× に戻す。もう一度で戻す' },
    ko: { cmdRateReset: '1×와 이전 배속 사이 전환', shortcutSpeedReset: '1×로 되돌리고, 다시 누르면 복귀' },
    zh_CN: { cmdRateReset: '1× 与之前的倍速间切换', shortcutSpeedReset: '回到 1×，再按切回' },
    zh_TW: { cmdRateReset: '1× 與之前的倍速間切換', shortcutSpeedReset: '回到 1×，再按切回' }
  };
  const files = readdirSync(new URL('../locales/', import.meta.url)).filter(name => name.endsWith('.yml')).sort();
  assert.deepEqual(files, Object.keys(expected).map(name => `${name}.yml`));
  for (const file of files) {
    const messages = readFlatMessages(readFileSync(new URL(`../locales/${file}`, import.meta.url), 'utf8'));
    const name = file.replace(/\.yml$/, '');
    assert.equal(messages.cmdRateReset, expected[name]!.cmdRateReset, file);
    assert.equal(messages.shortcutSpeedReset, expected[name]!.shortcutSpeedReset, file);
    assert.equal(messages.cmdRateReset?.includes('×'), true, file);
    assert.equal(messages.shortcutSpeedReset?.includes('×'), true, file);
  }
});
