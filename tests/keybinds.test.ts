import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { defaultKeybinds, keybindOwner, keyLabel, normalizeKeybinds, pressedKey, recordedKey, sameKeybinds } from '../lib/keybinds';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { normalizeSettings } from '../lib/settings';
import { defaultSettings } from '../lib/types';

const none = { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false };
const press = (key: string, code: string, extra: Partial<typeof none> = {}) => ({ ...none, ...extra, key, code });

describe('页内键位配置', () => {
  test('默认键位与改键前一致：K J L > < M S , .', () => {
    assert.deepEqual(defaultSettings.keybinds, { toggle: 'k', skipBack: 'j', skipForward: 'l', rateUp: '>', rateDown: '<', mute: 'm', holdBoost: 's', frameBack: ',', frameForward: '.' });
    assert.deepEqual(normalizeSettings({}).keybinds, defaultKeybinds, '老用户没有这一项时用默认键位');
    assert.deepEqual(normalizeSettings(null).keybinds, defaultKeybinds);
    assert.notEqual(normalizeSettings(null).keybinds, defaultKeybinds, '归一化结果不能和默认对象共用引用');
  });

  test('单项非法回到该项默认；整组撞键或占用方向键时整组回到默认', () => {
    assert.deepEqual(normalizeKeybinds({ ...defaultKeybinds, toggle: 'p', mute: 'Space' }), { ...defaultKeybinds, toggle: 'p', mute: 'Space' });
    for (const bad of ['', ' ', 'kk', 'Shift+Space', 'F5', 'Tab', 'Escape', 7, null, true]) {
      assert.equal(normalizeKeybinds({ ...defaultKeybinds, toggle: bad }).toggle, 'k', String(bad));
    }
    assert.deepEqual(normalizeKeybinds({ ...defaultKeybinds, toggle: 'j' }), defaultKeybinds, '两个动作同一个键');
    assert.deepEqual(normalizeKeybinds({ ...defaultKeybinds, toggle: 'p', mute: 'ArrowLeft' }), defaultKeybinds, '方向键固定给快进快退和音量');
    assert.deepEqual(normalizeKeybinds({ toggle: 'p' }), { ...defaultKeybinds, toggle: 'p' }, '缺项按默认补齐');
    assert.deepEqual(normalizeKeybinds({ toggle: 'j' }), defaultKeybinds, '补齐后撞键也整组回默认');
  });

  test('录键：字母大小写跟 Shift 走，空格记成 Space，Alt/Ctrl/⌘ 组合和 Tab、Esc、功能键不收', () => {
    assert.equal(recordedKey(press('p', 'KeyP')), 'p');
    assert.equal(recordedKey(press('P', 'KeyP')), 'p', 'Caps Lock 不算 Shift');
    assert.equal(recordedKey(press('P', 'KeyP', { shiftKey: true })), 'P');
    assert.equal(recordedKey(press('>', 'Period', { shiftKey: true })), '>');
    assert.equal(recordedKey(press(' ', 'Space')), 'Space');
    assert.equal(recordedKey(press('Enter', 'Enter')), 'Enter');
    assert.equal(recordedKey(press('ArrowLeft', 'ArrowLeft')), 'ArrowLeft', '方向键能录下，再由冲突检测拦住');
    assert.equal(recordedKey(press('л', 'KeyK')), 'л', '非拉丁布局记打出的字');
    assert.equal(recordedKey(press('Dead', 'Backquote')), '`', '死键退回物理键');
    for (const [key, code, extra] of [['p', 'KeyP', { altKey: true }], ['p', 'KeyP', { ctrlKey: true }], ['p', 'KeyP', { metaKey: true }], ['Tab', 'Tab', {}], ['Escape', 'Escape', {}], ['F5', 'F5', {}], [' ', 'Space', { shiftKey: true }], ['ArrowLeft', 'ArrowLeft', { shiftKey: true }]] as const) {
      assert.equal(recordedKey(press(key, code, extra)), null, `${key} ${JSON.stringify(extra)}`);
    }
  });

  test('按键识别：绑定用到的字优先，其余按物理键位兜底；Shift + 方向键和 Shift + 空格不算', () => {
    const custom = { ...defaultKeybinds, toggle: 'Space', skipBack: 'a' };
    assert.equal(pressedKey(press(' ', 'Space'), custom), 'Space');
    assert.equal(pressedKey(press(' ', 'Space', { shiftKey: true }), custom), 'Shift+Space');
    assert.equal(pressedKey(press('ArrowLeft', 'ArrowLeft', { shiftKey: true }), custom), 'Shift+ArrowLeft');
    assert.equal(pressedKey(press('a', 'KeyQ'), custom), 'a', 'AZERTY 按打出的 a');
    assert.equal(pressedKey(press('ф', 'KeyA'), custom), 'a', '俄文布局按物理 A');
    assert.equal(pressedKey(press('ю', 'Period'), defaultKeybinds), '.');
    assert.equal(pressedKey(press('Ю', 'Period', { shiftKey: true }), defaultKeybinds), '>');
  });

  test('冲突对象：别的动作或固定方向键，排除自己', () => {
    assert.equal(keybindOwner(defaultKeybinds, 'j', 'toggle'), 'skipBack');
    assert.equal(keybindOwner(defaultKeybinds, 'j', 'skipBack'), null);
    assert.equal(keybindOwner(defaultKeybinds, 'ArrowUp', 'mute'), 'volumeUp');
    assert.equal(keybindOwner(defaultKeybinds, 'ArrowLeft', 'skipBack'), 'skipBack');
    assert.equal(keybindOwner(defaultKeybinds, 'p', 'toggle'), null);
    assert.equal(keybindOwner(defaultKeybinds, 'constructor'), null);
  });

  test('显示：字母大写，Shift 字母写出 Shift，空格用本地名，方向键用箭头', () => {
    assert.equal(keyLabel('k', '空格'), 'K');
    assert.equal(keyLabel('K', '空格'), 'Shift + K');
    assert.equal(keyLabel('>', '空格'), '>');
    assert.equal(keyLabel('Space', '空格'), '空格');
    assert.equal(keyLabel('ArrowLeft', '空格'), '←');
    assert.equal(keyLabel('Enter', '空格'), 'Enter');
    assert.equal(keyLabel('л', '空格'), 'Л');
  });

  test('导出和导入带着自定义键位；撞键的备份导入后回到默认', () => {
    const settings = normalizeSettings({ ...defaultSettings, keybinds: { ...defaultKeybinds, toggle: 'p', frameForward: 'Space' } });
    const text = serializeSettings(settings, '1.7.0');
    assert.match(text, /"toggle": "p"/);
    const parsed = parseSettingsBackup(text);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.ok(sameKeybinds(parsed.settings.keybinds, { ...defaultKeybinds, toggle: 'p', frameForward: 'Space' }));
    const dirty = JSON.parse(text) as { settings: { keybinds?: Record<string, unknown> } };
    dirty.settings.keybinds = { ...dirty.settings.keybinds, mute: 'p' };
    const clashed = parseSettingsBackup(JSON.stringify(dirty));
    assert.deepEqual(clashed.ok && clashed.settings.keybinds, defaultKeybinds);
    delete dirty.settings.keybinds;
    const legacy = parseSettingsBackup(JSON.stringify(dirty));
    assert.deepEqual(legacy.ok && legacy.settings.keybinds, defaultKeybinds);
  });
});
