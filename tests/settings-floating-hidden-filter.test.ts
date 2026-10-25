import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act, Fragment } from 'react';
import { filterFloatingHiddenSites, isFloatingHidden } from '../lib/settings';
import { parseSettingsBackup, serializeSettings } from '../lib/settings-backup';
import { defaultSettings, type Settings, type SettingsStore } from '../lib/types';

const sites = ['gamma.example', 'alpha.test', 'notexample.com', 'www.example.com', 'other.test'];

test('隐藏浮动名单过滤只按主机名子串筛选，不改名单顺序，也不改域名匹配', () => {
  assert.deepEqual(filterFloatingHiddenSites(sites, ''), sites);
  assert.deepEqual(filterFloatingHiddenSites(sites, '   '), sites);
  const filtered = filterFloatingHiddenSites(sites, '');
  filtered.push('extra.test');
  assert.deepEqual(sites, ['gamma.example', 'alpha.test', 'notexample.com', 'www.example.com', 'other.test'], '过滤不改原名单');
  assert.deepEqual(filterFloatingHiddenSites(sites, 'WWW'), ['www.example.com']);
  assert.deepEqual(filterFloatingHiddenSites(sites, 'example'), ['gamma.example', 'notexample.com', 'www.example.com'], '子串，保持原顺序，不是域名边界');
  assert.deepEqual(filterFloatingHiddenSites(sites, 'example.com'), ['notexample.com', 'www.example.com']);
  assert.deepEqual(filterFloatingHiddenSites(sites, 'other'), ['other.test']);
  assert.deepEqual(filterFloatingHiddenSites(sites, 'm.example'), [], '不是「被父域名罩住的主机」');
  assert.deepEqual(filterFloatingHiddenSites(sites, 'missing'), []);
  const hidden = ['example.com', 'video.test'];
  assert.equal(isFloatingHidden('m.example.com', hidden), true, '父域名仍然罩住子域名');
  assert.equal(isFloatingHidden('notexample.com', hidden), false, '不是子域名的主机不会被当成隐藏');
  assert.equal(isFloatingHidden('www.example.com', hidden), true);
  assert.equal(isFloatingHidden('video.test', hidden), true);
  assert.equal(isFloatingHidden('missing.test', hidden), false);
  assert.deepEqual(filterFloatingHiddenSites(hidden, 'example'), ['example.com'], '过滤不把子域名算进结果');
});

test('设置页按主机名过滤隐藏浮动名单；恢复、导出导入都写回完整名单，且与另外两处过滤分开', async () => {
  const window = new Window({ url: 'https://player.test/watch' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'FocusEvent', 'MutationObserver', 'ResizeObserver', 'File', 'Blob', 'URL', 'FileReader'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { SettingsPage } = await import('../components/settings-page');
  const initial = ['alpha.test', 'beta.example', 'gamma.example'];
  const rules = ['rules.example', 'listed.test'];
  const prefs = { 'kept.example': { volume: .4 }, 'noted.test': { volume: .2 } };
  let value: Settings = { ...defaultSettings, siteMode: 'allow', sites: [...rules], sitePrefs: { ...prefs }, floatingHiddenSites: [...initial] };
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const floating = () => host.querySelector('#floating')!;
  const sitesSection = () => host.querySelector('#sites')!;
  const memory = () => host.querySelector('#memory')!;
  const titlesIn = (rootNode: { querySelectorAll(selector: string): Iterable<{ textContent: string | null }> }) => [...rootNode.querySelectorAll('[data-slot="item-title"]')].map(node => node.textContent);
  const hiddenFilter = () => floating().querySelector('#floating-hidden-filter') as HTMLInputElement | null;
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
  const button = (label: string) => [...host.querySelectorAll('button')].find(item => item.textContent === label);
  const choose = async (contents: string) => {
    const input = host.querySelector('input[type="file"]') as unknown as { files: unknown; dispatchEvent(event: Event): void };
    const file = new File([contents], 'ottertap-settings.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { configurable: true, value: { 0: file, length: 1, item: () => file } });
    await act(async () => { input.dispatchEvent(new window.Event('change', { bubbles: true }) as unknown as Event); });
  };
  const storedHidden = () => [...value.floatingHiddenSites];
  try {
    await act(async () => {
      root.render(createElement(ThemeProvider, { store, children: createElement(Fragment, null, createElement(SettingsPage)) }));
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    assert.equal(hiddenFilter()?.tagName, 'INPUT');
    assert.equal(hiddenFilter()?.getAttribute('placeholder'), '筛选隐藏站点');
    assert.equal(siteFilter()?.getAttribute('placeholder'), '筛选网站列表');
    assert.equal(memoryFilter()?.getAttribute('placeholder'), '按主机名筛选');
    assert.notEqual(hiddenFilter()?.id, siteFilter()?.id);
    assert.notEqual(hiddenFilter()?.id, memoryFilter()?.id);
    assert.deepEqual(titlesIn(floating()), initial);
    assert.deepEqual(titlesIn(sitesSection()), rules);
    assert.deepEqual(titlesIn(memory()), ['kept.example', 'noted.test']);
    assert.equal(floating().querySelector('#floating-hidden-no-match'), null);
    assert.equal(floating().querySelector('[role="list"]'), floating().querySelector('[aria-label="隐藏浮动入口的站点"]'));

    await type(hiddenFilter()!, 'Example');
    assert.equal(hiddenFilter()?.value, 'Example');
    assert.deepEqual(titlesIn(floating()), ['beta.example', 'gamma.example']);
    assert.equal(floating().textContent?.includes('alpha.test'), false);
    assert.deepEqual(storedHidden(), initial, '过滤不写存储');
    assert.equal('floatingHiddenFilter' in value, false);
    assert.deepEqual(value.sites, rules);
    assert.deepEqual(value.sitePrefs, prefs);
    assert.deepEqual(titlesIn(sitesSection()), rules, '隐藏浮动过滤不改网站规则展示');
    assert.deepEqual(titlesIn(memory()), ['kept.example', 'noted.test'], '隐藏浮动过滤不改记住站点展示');

    await type(siteFilter()!, 'rules');
    await type(memoryFilter()!, 'kept');
    assert.deepEqual(titlesIn(sitesSection()), ['rules.example']);
    assert.deepEqual(titlesIn(memory()), ['kept.example']);
    assert.equal(hiddenFilter()?.value, 'Example', '另外两处过滤不清这个框');
    assert.deepEqual(titlesIn(floating()), ['beta.example', 'gamma.example']);

    await click(sitesSection().querySelector('#site-mode-all') as unknown as { click(): void });
    assert.equal(value.siteMode, 'all');
    assert.equal(siteFilter()?.value, '', '切换模式只清空网站规则过滤');
    assert.equal(hiddenFilter()?.value, 'Example');
    assert.equal(memoryFilter()?.value, 'kept');
    assert.deepEqual(titlesIn(floating()), ['beta.example', 'gamma.example']);
    assert.deepEqual(storedHidden(), initial);
    assert.deepEqual(value.sites, rules);

    await click(floating().querySelector('button[aria-label="在 beta.example 恢复浮动入口"]') as unknown as { click(): void });
    assert.deepEqual(storedHidden(), ['alpha.test', 'gamma.example']);
    assert.deepEqual(titlesIn(floating()), ['gamma.example'], '仍匹配的站点从结果里消失');
    assert.equal(hiddenFilter()?.value, 'Example');
    assert.deepEqual(value.sites, rules);
    assert.deepEqual(value.sitePrefs, prefs);
    assert.equal(value.floating, true);

    const captured: Promise<string>[] = [];
    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob) => {
      captured.push(blob.text());
      return createObjectURL(blob);
    };
    await click(button('导出设置')!);
    const exportedText = await captured[0];
    const exported = JSON.parse(exportedText!) as { settings: Settings };
    assert.deepEqual(exported.settings.floatingHiddenSites, ['alpha.test', 'gamma.example'], '导出带上被滤掉的站点');
    assert.equal(parseSettingsBackup(exportedText!).ok, true);
    assert.deepEqual(titlesIn(floating()), ['gamma.example']);

    const imported = serializeSettings({ ...value, floatingHiddenSites: ['alpha.test', 'beta.example', 'gamma.example', 'delta.test'] }, '1.7.0');
    await choose(imported);
    await click(button('确认导入')!);
    assert.deepEqual(storedHidden(), ['alpha.test', 'beta.example', 'gamma.example', 'delta.test'], '导入写回完整名单');
    assert.equal(hiddenFilter()?.value, 'Example', '导入不清这次过滤');
    assert.deepEqual(titlesIn(floating()), ['beta.example', 'gamma.example']);
    assert.equal(floating().textContent?.includes('delta.test'), false);
    assert.equal(floating().textContent?.includes('alpha.test'), false);
    assert.deepEqual(value.sites, rules);
    assert.deepEqual(value.sitePrefs, prefs);
    assert.equal(memoryFilter()?.value, 'kept');
    assert.deepEqual(titlesIn(memory()), ['kept.example']);

    await type(hiddenFilter()!, 'zzzz');
    assert.deepEqual(titlesIn(floating()), []);
    assert.equal(floating().querySelector('[role="list"]'), null, '无匹配时不留空白列表');
    assert.equal(floating().querySelector('#floating-hidden-no-match')?.textContent, '没有匹配的隐藏站点。');
    assert.equal(hiddenFilter()?.getAttribute('aria-describedby'), 'floating-hidden-no-match');
    assert.deepEqual(storedHidden(), ['alpha.test', 'beta.example', 'gamma.example', 'delta.test']);
    assert.deepEqual(titlesIn(sitesSection()), rules);
    assert.equal(siteFilter()?.value, '');

    await type(hiddenFilter()!, '   ');
    assert.deepEqual(titlesIn(floating()), ['alpha.test', 'beta.example', 'gamma.example', 'delta.test']);

    for (const site of ['alpha.test', 'beta.example', 'gamma.example', 'delta.test']) await click(floating().querySelector(`button[aria-label="在 ${site} 恢复浮动入口"]`) as unknown as { click(): void });
    assert.deepEqual(value.floatingHiddenSites, []);
    assert.equal(hiddenFilter(), null, '名单空了就不留过滤框');
    assert.match(floating().textContent ?? '', /还没有站点/);
    assert.equal(floating().querySelector('#floating-hidden-no-match'), null);
    assert.equal(memoryFilter()?.value, 'kept');
    assert.deepEqual(titlesIn(memory()), ['kept.example']);
    assert.deepEqual(value.sites, rules);
    assert.deepEqual(value.sitePrefs, prefs);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
