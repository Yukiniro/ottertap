import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readFlatMessages } from '../lib/message-catalog';

const names = (value: string) => [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(match => match[1]).sort();
const read = (path: string) => readFlatMessages(readFileSync(new URL(path, import.meta.url), 'utf8'));
const bcp47 = (code: string) => code.replace('_', '-');

test('扩展文案键、占位符和语言标记一致', () => {
  const files = readdirSync(new URL('../locales/', import.meta.url)).filter(name => name.endsWith('.yml')).sort();
  assert.deepEqual(files, ['de.yml', 'en.yml', 'es.yml', 'fr.yml', 'ja.yml', 'ko.yml', 'zh_CN.yml', 'zh_TW.yml']);
  const en = read('../locales/en.yml');
  for (const file of files) {
    const messages = read(`../locales/${file}`);
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(en).sort(), file);
    for (const [key, value] of Object.entries(messages)) {
      assert.notEqual(value, '', `${file} ${key}`);
      assert.deepEqual(names(en[key] ?? ''), names(value), `${file} ${key}`);
    }
    assert.equal(messages.locale, bcp47(file.replace(/\.yml$/, '')), file);
    assert.ok((messages.extName ?? '').length > 0 && (messages.extName ?? '').length <= 45, `${file} extName`);
    assert.ok((messages.extDescription ?? '').length > 0 && (messages.extDescription ?? '').length <= 132, `${file} extDescription ${messages.extDescription?.length}`);
    if (file !== 'en.yml') assert.notEqual(messages.extDescription, en.extDescription, file);
  }
  assert.equal(en.extName?.startsWith('OtterTap'), true);
  assert.equal(en.brandName, 'OtterTap');
  assert.equal(read('../locales/zh_CN.yml').brandName, '小獭');
  assert.equal(read('../locales/zh_TW.yml').brandName, '小獺');
});

test('官网文案键和占位符一致', () => {
  const files = readdirSync(new URL('../site/locales/', import.meta.url)).filter(name => name.endsWith('.yml')).sort();
  assert.deepEqual(files, ['de.yml', 'en.yml', 'es.yml', 'fr.yml', 'ja.yml', 'ko.yml', 'zh_CN.yml', 'zh_TW.yml']);
  const en = read('../site/locales/en.yml');
  for (const file of files) {
    const messages = read(`../site/locales/${file}`);
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(en).sort(), file);
    for (const [key, value] of Object.entries(messages)) {
      assert.notEqual(value, '', `${file} ${key}`);
      assert.deepEqual(names(en[key] ?? ''), names(value), `${file} ${key}`);
    }
    if (file !== 'en.yml') assert.notEqual(messages.metaDescription, en.metaDescription, file);
  }
});
