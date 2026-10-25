import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act, Fragment } from 'react';
import { filterSiteList, isSiteEnabled } from '../lib/settings';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

const sites = ['example.com', 'notexample.com', 'www.example.com', 'other.test'];

test('网站规则过滤只按主机名子串筛选，不改名单顺序，也不改站点匹配', () => {
  assert.deepEqual(filterSiteList(sites, ''), sites);
  assert.deepEqual(filterSiteList(sites, '   '), sites);
  const filtered = filterSiteList(sites, '');
  filtered.push('extra.test');
  assert.deepEqual(sites, ['example.com', 'notexample.com', 'www.example.com', 'other.test'], '过滤不改原名单');
  assert.deepEqual(filterSiteList(sites, 'WWW'), ['www.example.com']);
  assert.deepEqual(filterSiteList(sites, 'example.com'), ['example.com', 'notexample.com', 'www.example.com'], '子串，不是域名边界');
  assert.deepEqual(filterSiteList(sites, 'other'), ['other.test']);
  assert.deepEqual(filterSiteList(sites, 'missing'), []);
  const allow = { ...defaultSettings, siteMode: 'allow' as const, sites: [...sites] };
  assert.equal(isSiteEnabled('https://m.example.com/watch', allow), true, '父域名仍然罩住子域名');
  assert.equal(isSiteEnabled('https://notexample.com/', allow), true);
  assert.equal(isSiteEnabled('https://no.notexample.com/', allow), true, '名单里的主机仍按域名匹配，而不是过滤用的子串');
  assert.equal(isSiteEnabled('https://other.test/a', allow), true);
  assert.equal(isSiteEnabled('https://missing.test/', allow), false);
  assert.equal(isSiteEnabled('https://example.com.evil.test/', allow), false);
  const exclude = { ...allow, siteMode: 'exclude' as const };
  assert.equal(isSiteEnabled('https://m.example.com/watch', exclude), false);
  assert.equal(isSiteEnabled('https://missing.test/', exclude), true);
});

test('设置页按主机名过滤网站规则；添加、移除和模式切换都写回同一份名单，且与记住站点过滤分开', async () => {
  const window = new Window({ url: 'https://player.test/watch' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'FocusEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { SettingsPage } = await import('../components/settings-page');
  const initial = ['alpha.test', 'beta.example', 'gamma.example'];
  const prefs = { 'kept.example': { volume: .4 }, 'other.test': { volume: .2 } };
  let value: Settings = { ...defaultSettings, siteMode: 'allow', sites: [...initial], sitePrefs: { ...prefs } };
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const sitesSection = () => host.querySelector('#sites')!;
  const memory = () => host.querySelector('#memory')!;
  const titlesIn = (rootNode: { querySelectorAll(selector: string): Iterable<{ textContent: string | null }> }) => [...rootNode.querySelectorAll('[data-slot="item-title"]')].map(node => node.textContent);
  const siteFilter = () => sitesSection().querySelector('#site-list-filter') as HTMLInputElement | null;
  const memoryFilter = () => memory().querySelector('#remembered-filter') as HTMLInputElement | null;
  const type = async (input: HTMLInputElement, text: string) => {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, text);
      input.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
    });
  };
  const click = async (element: { click(): void }) => { await act(async () => { element.click(); }); };
  const storedSites = () => [...value.sites];
  try {
    await act(async () => {
      root.render(createElement(ThemeProvider, { store, children: createElement(Fragment, null, createElement(SettingsPage)) }));
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    assert.equal(siteFilter()?.tagName, 'INPUT');
    assert.equal(siteFilter()?.getAttribute('placeholder'), '筛选网站列表');
    assert.equal(memoryFilter()?.getAttribute('placeholder'), '按主机名筛选');
    assert.notEqual(siteFilter()?.id, memoryFilter()?.id);
    assert.deepEqual(titlesIn(sitesSection()), ['alpha.test', 'beta.example', 'gamma.example']);
    assert.deepEqual(titlesIn(memory()), ['kept.example', 'other.test']);
    assert.equal(sitesSection().querySelector('#site-list-no-match'), null);
    assert.equal(sitesSection().querySelector('[role="list"]'), sitesSection().querySelector('[aria-label="网站列表"]'));

    await type(siteFilter()!, 'Example');
    assert.equal(siteFilter()?.value, 'Example');
    assert.deepEqual(titlesIn(sitesSection()), ['beta.example', 'gamma.example']);
    assert.equal(sitesSection().textContent?.includes('alpha.test'), false);
    assert.deepEqual(titlesIn(memory()), ['kept.example', 'other.test'], '网站规则过滤不改记住站点展示');
    assert.deepEqual(storedSites(), initial, '过滤不写存储');
    assert.equal('siteListFilter' in value, false);
    assert.deepEqual(value.sitePrefs, prefs);

    await type(memoryFilter()!, 'kept');
    assert.deepEqual(titlesIn(memory()), ['kept.example']);
    assert.deepEqual(titlesIn(sitesSection()), ['beta.example', 'gamma.example'], '记住站点过滤不改网站规则展示');
    assert.equal(memoryFilter()?.value, 'kept');

    await type(sitesSection().querySelector('#site-domain') as unknown as HTMLInputElement, 'https://delta.test/watch');
    await click(sitesSection().querySelector('button[type="submit"]') as unknown as { click(): void });
    assert.deepEqual(storedSites(), [...initial, 'delta.test']);
    assert.deepEqual(titlesIn(sitesSection()), ['beta.example', 'gamma.example'], '不匹配的新站点留在名单里，但不出现');
    assert.equal(siteFilter()?.value, 'Example');
    assert.deepEqual(value.sitePrefs, prefs);

    await type(sitesSection().querySelector('#site-domain') as unknown as HTMLInputElement, 'delta.example');
    await click(sitesSection().querySelector('button[type="submit"]') as unknown as { click(): void });
    assert.deepEqual(storedSites(), [...initial, 'delta.test', 'delta.example']);
    assert.deepEqual(titlesIn(sitesSection()), ['beta.example', 'gamma.example', 'delta.example']);

    await type(sitesSection().querySelector('#site-domain') as unknown as HTMLInputElement, 'alpha.test');
    await click(sitesSection().querySelector('button[type="submit"]') as unknown as { click(): void });
    assert.equal(sitesSection().querySelector('#domain-error')?.textContent, '这个网站已经在列表中。');
    assert.deepEqual(storedSites(), [...initial, 'delta.test', 'delta.example'], '重复添加不改名单');

    await click(sitesSection().querySelector('button[aria-label="移除 gamma.example"]') as unknown as { click(): void });
    assert.deepEqual(storedSites(), ['alpha.test', 'beta.example', 'delta.test', 'delta.example']);
    assert.deepEqual(titlesIn(sitesSection()), ['beta.example', 'delta.example']);
    assert.deepEqual(value.sitePrefs, prefs);
    assert.equal(value.siteMode, 'allow');

    await type(siteFilter()!, 'zzzz');
    assert.deepEqual(titlesIn(sitesSection()), []);
    assert.equal(sitesSection().querySelector('[role="list"]'), null, '无匹配时不留空白列表');
    assert.equal(sitesSection().querySelector('#site-list-no-match')?.textContent, '没有匹配的网站。');
    assert.equal(siteFilter()?.getAttribute('aria-describedby'), 'site-list-no-match');
    assert.deepEqual(titlesIn(memory()), ['kept.example']);
    assert.deepEqual(storedSites(), ['alpha.test', 'beta.example', 'delta.test', 'delta.example']);

    await type(siteFilter()!, '   ');
    assert.deepEqual(titlesIn(sitesSection()), ['alpha.test', 'beta.example', 'delta.test', 'delta.example']);

    await type(siteFilter()!, 'example');
    await click(sitesSection().querySelector('#site-mode-exclude') as unknown as { click(): void });
    assert.equal(value.siteMode, 'exclude');
    assert.deepEqual(storedSites(), ['alpha.test', 'beta.example', 'delta.test', 'delta.example'], '切换模式不改名单');
    assert.equal(siteFilter()?.value, '', '切换模式清空网站规则过滤');
    assert.deepEqual(titlesIn(sitesSection()), ['alpha.test', 'beta.example', 'delta.test', 'delta.example']);
    assert.equal(memoryFilter()?.value, 'kept', '切换模式不清空记住站点过滤');
    assert.deepEqual(titlesIn(memory()), ['kept.example']);

    await type(siteFilter()!, 'test');
    await click(sitesSection().querySelector('#site-mode-all') as unknown as { click(): void });
    assert.equal(value.siteMode, 'all');
    assert.equal(siteFilter()?.value, '');
    assert.deepEqual(titlesIn(sitesSection()), ['alpha.test', 'beta.example', 'delta.test', 'delta.example']);
    assert.equal(memoryFilter()?.value, 'kept');

    for (const site of ['alpha.test', 'beta.example', 'delta.test', 'delta.example']) await click(sitesSection().querySelector(`button[aria-label="移除 ${site}"]`) as unknown as { click(): void });
    assert.deepEqual(value.sites, []);
    assert.equal(siteFilter(), null, '名单空了就不留过滤框');
    assert.match(sitesSection().textContent ?? '', /暂未添加网站/);
    assert.equal(sitesSection().querySelector('#site-list-no-match'), null);
    assert.equal(memoryFilter()?.value, 'kept');
    assert.deepEqual(titlesIn(memory()), ['kept.example']);
    assert.deepEqual(value.sitePrefs, prefs);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
