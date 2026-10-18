import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertZipHasLicense, changelogEntry } from '../scripts/release.mjs';

test('发布说明取当前版本的 changelog 段落', () => {
  const markdown = '# ottertap-extension\n\n## 1.1.0\n\n### Minor Changes\n\n- 支持中英文\n\n## 1.0.0\n\n### Major Changes\n\n- 最初版本\n';
  assert.equal(changelogEntry(markdown, '1.1.0'), '## 1.1.0\n\n### Minor Changes\n\n- 支持中英文');
  assert.throws(() => changelogEntry(markdown, '9.9.9'), /9\.9\.9/);
});

test('发版 ZIP 必须包含 LICENSE', () => {
  assert.doesNotThrow(() => assertZipHasLicense(['manifest.json', 'LICENSE']));
  assert.throws(() => assertZipHasLicense(['manifest.json']), /LICENSE/);
});
