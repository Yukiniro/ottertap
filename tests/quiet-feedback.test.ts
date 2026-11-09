import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readFlatMessages } from '../lib/message-catalog';
import { actionHintText } from '../lib/hotkey';

const locales = ['de', 'en', 'es', 'fr', 'ja', 'ko', 'zh_CN', 'zh_TW'];
const read = (name: string) => readFlatMessages(readFileSync(new URL(`../locales/${name}.yml`, import.meta.url), 'utf8'));

test('页内短提示认得跨标签安静的三条成功提示和静音其他失败说明', () => {
  assert.strictEqual(actionHintText('muteOthersHint'), '已静音其他');
  assert.strictEqual(actionHintText('listenCurrentHint'), '只听当前');
  assert.strictEqual(actionHintText('undoMuteOthersHint'), '已撤销');
  assert.strictEqual(actionHintText('muteOthersFailed'), '没能静音其他标签页。');
  assert.strictEqual(actionHintText('muteOthers'), '');
});

test('八种语言都有三条提示，自动静音说明写清默认关、5 秒和不改媒体音量', () => {
  for (const name of locales) {
    const messages = read(name);
    for (const key of ['muteOthersHint', 'listenCurrentHint', 'undoMuteOthersHint']) {
      assert.ok((messages[key] ?? '').length > 0, `${name} ${key}`);
    }
    const description = messages.autoMuteOthersDescription ?? '';
    assert.ok(/5/.test(description), `${name} 5 秒冷却`);
    if (name !== 'en') assert.notStrictEqual(description, read('en').autoMuteOthersDescription, `${name} 不能沿用英文`);
  }
  const en = read('en').autoMuteOthersDescription ?? '';
  for (const phrase of ['Off by default', 'Media volume is never changed', 'background playback', 'last batch', '5 seconds']) {
    assert.ok(en.includes(phrase), phrase);
  }
});
