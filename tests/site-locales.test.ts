import assert from 'node:assert/strict';
import { test } from 'node:test';
import { languageAlternates, links, locales, matchNavigatorLanguage, siteUrl } from '../site/lib/site-locales.ts';

test('官网语言路径和商店链接', () => {
  assert.deepEqual(locales.map(locale => locale.path), ['/', '/zh/', '/zh-tw/', '/ja/', '/ko/', '/es/', '/fr/', '/de/']);
  assert.equal(links.chromeWebStore.endsWith('/ipcjiedocfmjiamcjnpmmjckpegannmn'), true);
  assert.equal(links.edgeAddons, '');
  assert.equal(matchNavigatorLanguage(['ja-JP', 'en-US']), 'ja');
  assert.equal(matchNavigatorLanguage(['zh-TW', 'zh']), 'zh-tw');
  assert.equal(matchNavigatorLanguage(['zh-HK']), 'zh-tw');
  assert.equal(matchNavigatorLanguage(['zh-CN', 'en']), 'zh');
  assert.equal(matchNavigatorLanguage(['zh']), 'zh');
  assert.equal(matchNavigatorLanguage(['fr-CA']), 'fr');
  assert.equal(matchNavigatorLanguage(['de-AT']), 'de');
  assert.equal(matchNavigatorLanguage(['es-MX']), 'es');
  assert.equal(matchNavigatorLanguage(['ko-KR']), 'ko');
  assert.equal(matchNavigatorLanguage(['en-GB']), 'en');
  assert.equal(matchNavigatorLanguage([]), null);
  assert.equal(languageAlternates['x-default'], `${siteUrl}/`);
  assert.equal(languageAlternates.en, `${siteUrl}/`);
  assert.equal(languageAlternates['zh-CN'], `${siteUrl}/zh/`);
  assert.equal(languageAlternates['zh-TW'], `${siteUrl}/zh-tw/`);
  assert.equal(languageAlternates.ja, `${siteUrl}/ja/`);
});
