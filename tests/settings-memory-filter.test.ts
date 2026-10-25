import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act, Fragment } from 'react';
import { filterRememberedSites, sitePrefFor } from '../lib/settings';
import { defaultSettings, type MediaClient, type MediaState, type Settings, type SettingsStore } from '../lib/types';

const prefs = {
  'example.com': { volume: .2 },
  'www.example.com': { rate: 1.25 },
  'notexample.com': { volume: .3 },
  'other.test': { volume: .5 }
};

test('记住站点过滤只按主机名子串筛选，不改父子域匹配，也不改原表', () => {
  assert.deepEqual(filterRememberedSites(prefs, '').map(([host]) => host), ['example.com', 'notexample.com', 'other.test', 'www.example.com']);
  assert.deepEqual(filterRememberedSites(prefs, '   ').map(([host]) => host), ['example.com', 'notexample.com', 'other.test', 'www.example.com']);
  assert.deepEqual(filterRememberedSites(prefs, 'WWW').map(([host]) => host), ['www.example.com']);
  assert.deepEqual(filterRememberedSites(prefs, 'example.com').map(([host]) => host), ['example.com', 'notexample.com', 'www.example.com'], '子串，不是域名边界');
  assert.deepEqual(filterRememberedSites(prefs, 'other').map(([host]) => host), ['other.test']);
  assert.deepEqual(filterRememberedSites(prefs, 'missing'), []);
  assert.equal(prefs['other.test']?.volume, .5, '过滤不改原表');
  assert.deepEqual(sitePrefFor('m.example.com', prefs), { host: 'example.com', pref: { volume: .2 } }, '父域名仍然罩住子域名');
  assert.deepEqual(sitePrefFor('www.example.com', prefs)?.host, 'www.example.com', '更具体的条目仍然优先');
  assert.equal(sitePrefFor('notexample.com', prefs)?.host, 'notexample.com', '不是子域名的主机不会被当成匹配');
});

test('设置页按主机名过滤展示；删除和记住此站点都写回同一张表', async () => {
  const window = new Window({ url: 'https://player.test/watch' });
  for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'FocusEvent', 'MutationObserver', 'ResizeObserver'] as const) {
    Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true });
  }
  for (const name of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const) Object.defineProperty(globalThis, name, { value: window[name].bind(window), configurable: true });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  const { createRoot } = await import('react-dom/client');
  const { ThemeProvider } = await import('../components/theme');
  const { SettingsPage } = await import('../components/settings-page');
  const { MediaPanel } = await import('../components/media-panel');
  const initial = { 'alpha.test': { volume: .4 }, 'beta.example': { rate: 1.5 }, 'gamma.example': { volume: .8 } };
  let value: Settings = { ...defaultSettings, sitePrefs: { ...initial } };
  const listeners = new Set<(settings: Settings) => void>();
  const store: SettingsStore = {
    async load() { return value; },
    async save(next) { value = next; listeners.forEach(listener => listener(next)); },
    watch(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
  };
  const media: MediaState = { id: '0:1', title: '正片', label: '正片', host: 'player.test', kind: 'video', paused: false, muted: false, volume: .6, maxVolume: 1, rate: 1.5, currentTime: 0, duration: 10, live: false, seekable: [{ start: 0, end: 10 }], pip: false, pipAvailable: true, pipBlock: '', channel: 'stereo', channelAvailable: true };
  const client: MediaClient = {
    async read() { return { enabled: true, host: 'player.test', selectedId: media.id, media: [{ ...media }] }; },
    async command() {},
    async select() {},
    async highlight() {}
  };
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const root = createRoot(host as unknown as HTMLElement);
  const memory = () => host.querySelector('#memory')!;
  const titles = () => [...memory().querySelectorAll('[data-slot="item-title"]')].map(node => node.textContent);
  const filter = () => memory().querySelector('#remembered-filter') as HTMLInputElement | null;
  const type = async (text: string) => {
    await act(async () => {
      const input = filter()!;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, text);
      input.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
    });
  };
  const click = async (element: { click(): void }) => { await act(async () => { element.click(); }); };
  const keys = () => Object.keys(value.sitePrefs).sort();
  try {
    await act(async () => {
      root.render(createElement(ThemeProvider, { store, children: createElement(Fragment, null, createElement(SettingsPage), createElement(MediaPanel, { client, openSettings() {} })) }));
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    assert.equal(filter()?.tagName, 'INPUT');
    assert.equal(filter()?.getAttribute('placeholder'), '按主机名筛选');
    assert.deepEqual(titles(), ['alpha.test', 'beta.example', 'gamma.example']);
    assert.equal(memory().querySelector('#remembered-no-match'), null);
    assert.equal(memory().querySelector('[role="list"]'), memory().querySelector('[aria-label="已记住的站点"]'));

    await type('Example');
    assert.equal(filter()?.value, 'Example');
    assert.deepEqual(titles(), ['beta.example', 'gamma.example']);
    assert.equal(memory().textContent?.includes('alpha.test'), false);
    assert.deepEqual(keys(), ['alpha.test', 'beta.example', 'gamma.example'], '过滤不写存储');
    assert.equal('rememberedFilter' in value, false);

    const remember = [...host.querySelectorAll('[role="switch"]')].find(item => item.getAttribute('aria-label') === '记住此站点')!;
    assert.equal(remember.getAttribute('aria-checked'), 'false');
    await click(remember as unknown as { click(): void });
    assert.deepEqual(value.sitePrefs['player.test'], { volume: .6, rate: 1.5 });
    assert.deepEqual(keys(), ['alpha.test', 'beta.example', 'gamma.example', 'player.test'], '记住此站点写入整张表，滤掉的条目还在');
    assert.deepEqual(titles(), ['beta.example', 'gamma.example'], '新记住的主机名不匹配当前过滤时不出现');

    await type('');
    assert.deepEqual(titles(), ['alpha.test', 'beta.example', 'gamma.example', 'player.test']);

    await type('example');
    await click(memory().querySelector('button[aria-label="忘记 beta.example"]') as unknown as { click(): void });
    assert.deepEqual(keys(), ['alpha.test', 'gamma.example', 'player.test']);
    assert.deepEqual(titles(), ['gamma.example']);
    assert.equal(value.sites.length, 0);
    assert.deepEqual(value.floatingHiddenSites, []);

    await type('zzzz');
    assert.deepEqual(titles(), []);
    assert.equal(memory().querySelector('[role="list"]'), null, '无匹配时不留空白列表');
    assert.equal(memory().querySelector('#remembered-no-match')?.textContent, '没有匹配的已记住站点。');
    assert.equal(filter()?.getAttribute('aria-describedby'), 'remembered-no-match');
    assert.deepEqual(keys(), ['alpha.test', 'gamma.example', 'player.test']);

    await type('   ');
    assert.deepEqual(titles(), ['alpha.test', 'gamma.example', 'player.test']);

    for (const site of ['alpha.test', 'gamma.example', 'player.test']) await click(memory().querySelector(`button[aria-label="忘记 ${site}"]`) as unknown as { click(): void });
    assert.deepEqual(value.sitePrefs, {});
    assert.equal(filter(), null, '表空了就不留过滤框');
    assert.match(memory().textContent ?? '', /还没有记住的站点/);
    assert.equal(memory().querySelector('#remembered-no-match'), null);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
