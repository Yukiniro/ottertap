import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readFlatMessages } from '../lib/message-catalog';

const names = (value: string) => [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(match => match[1]).sort();
const read = (path: string) => readFlatMessages(readFileSync(new URL(path, import.meta.url), 'utf8'));

for (const dir of ['../locales', '../site/locales']) {
  test(`${dir} 中英文文案键和占位符一致`, () => {
    const en = read(`${dir}/en.yml`);
    const zh = read(`${dir}/zh_CN.yml`);
    assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
    for (const [key, value] of Object.entries(zh)) {
      assert.notEqual(value, '', key);
      assert.notEqual(en[key], '', key);
      assert.deepEqual(names(en[key] ?? ''), names(value), key);
    }
  });
}

test('品牌名', () => {
  const en = read('../locales/en.yml');
  const zh = read('../locales/zh_CN.yml');
  assert.equal(en.extName?.startsWith('OtterTap'), true);
  assert.equal(zh.brandName, '小獭');
});
