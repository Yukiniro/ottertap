import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readFlatMessages } from '../lib/message-catalog';

const names = (value: string) => [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(match => match[1]).sort();

test('中英文文案键和占位符一致', () => {
  const en = readFlatMessages(readFileSync(new URL('../locales/en.yml', import.meta.url), 'utf8'));
  const zh = readFlatMessages(readFileSync(new URL('../locales/zh_CN.yml', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  for (const [key, value] of Object.entries(zh)) {
    assert.notEqual(value, '', key);
    assert.deepEqual(names(en[key] ?? ''), names(value), key);
  }
  assert.equal(en.extName?.startsWith('OtterTap'), true);
  assert.equal(zh.brandName, '小獭');
});
