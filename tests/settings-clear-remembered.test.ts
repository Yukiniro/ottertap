import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Window } from 'happy-dom';
import { createElement, act, Fragment } from 'react';
import { clearRememberedSites, createSitePrefSession, forgetSitePref, sitePrefFor } from '../lib/settings';
import { serializeSettings } from '../lib/settings-backup';
import { defaultSettings, type MediaClient, type MediaState, type Settings, type SettingsStore, type SitePref } from '../lib/types';

const remembered: Record<string, SitePref> = {
  'alpha.test': { volume: .4 },
  'beta.example': { rate: 1.5 },
  'player.test': { volume: .2, rate: 2, channel: 'mono' }
};

test('清空记住站点复用逐条忘记，不改原表', () => {
  const snapshot = structuredClone(remembered);
  let manual: Record<string, SitePref> = remembered;
  for (const site of Object.keys(remembered)) manual = forgetSitePref(manual, site);
  const cleared = clearRememberedSites(remembered);
  assert.deepEqual(cleared, {});
  assert.deepEqual(manual, {});
  assert.notEqual(cleared, remembered);
  assert.deepEqual(remembered, snapshot);
  const empty = {};
  assert.equal(clearRememberedSites(empty), empty);
});

test('清空后新的访问不再套用旧记忆，默认倍速仍会套用', () => {
  assert.deepEqual(createSitePrefSession().plan('player.test', 'm', remembered, 1.25), [
    { type: 'volume', value: .2 },
    { type: 'rate', value: 2 },
    { type: 'channel', value: 'mono' }
  ]);
  const cleared = clearRememberedSites(remembered);
  assert.equal(sitePrefFor('player.test', cleared), null);
  assert.equal(sitePrefFor('www.player.test', cleared), null);
  assert.deepEqual(createSitePrefSession().plan('player.test', 'm', cleared, null), []);
  assert.deepEqual(createSitePrefSession().plan('player.test', 'm', cleared, 1.25), [{ type: 'rate', value: 1.25 }]);
});

test('设置页二次确认后只清空记住站点，取消则不动', async () => {
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
  let value: Settings = {
    ...defaultSettings,
    siteMode: 'exclude',
    sites: ['rules.example'],
    floatingHiddenSites: ['hidden.example'],
    defaultRate: 1.25,
    sitePrefs: structuredClone(remembered)
  };
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
  const buttonsNamed = (rootNode: { querySelectorAll(selector: string): Iterable<{ textContent: string | null; click(): void }> } | null, name: string) => rootNode ? [...rootNode.querySelectorAll('button')].filter(button => button.textContent === name) : [];
  const region = () => memory().querySelector('[role="region"]');
  const remember = () => [...host.querySelectorAll('[role="switch"]')].find(item => item.getAttribute('aria-label') === '记住此站点');
  const click = async (element: { click(): void }) => { await act(async () => { element.click(); }); };
  const type = async (text: string) => {
    await act(async () => {
      const input = memory().querySelector('#remembered-filter') as unknown as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, text);
      input.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event);
    });
  };
  try {
    await act(async () => {
      root.render(createElement(ThemeProvider, { store, children: createElement(Fragment, null, createElement(SettingsPage), createElement(MediaPanel, { client, openSettings() {} })) }));
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    assert.deepEqual(titles(), ['alpha.test', 'beta.example', 'player.test']);
    assert.equal(buttonsNamed(memory(), '清空全部').length, 1);
    assert.equal(buttonsNamed(host.querySelector('#sites')!, '清空全部').length, 0);
    assert.equal(buttonsNamed(host.querySelector('#floating')!, '清空全部').length, 0);
    assert.equal(region(), null);
    assert.equal(remember()?.getAttribute('aria-checked'), 'true');

    await click(buttonsNamed(memory(), '清空全部')[0]!);
    assert.equal(region()?.getAttribute('aria-labelledby'), 'clear-remembered-title');
    assert.match(region()?.textContent ?? '', /清空全部已记住的站点？/);
    assert.match(region()?.textContent ?? '', /除非你自己已经有备份，否则无法撤销/);
    assert.match(region()?.textContent ?? '', /网站规则、不显示浮动按钮的站点，以及其他设置都保持不变/);
    assert.deepEqual(Object.keys(value.sitePrefs).sort(), ['alpha.test', 'beta.example', 'player.test'], '打开确认还没删除');

    await click(buttonsNamed(region()!, '取消')[0]!);
    assert.equal(region(), null);
    assert.deepEqual(value.sitePrefs, remembered);
    assert.deepEqual(value.sites, ['rules.example']);
    assert.deepEqual(value.floatingHiddenSites, ['hidden.example']);
    assert.equal(value.siteMode, 'exclude');
    assert.equal(value.defaultRate, 1.25);
    assert.equal(remember()?.getAttribute('aria-checked'), 'true');

    await type('example');
    assert.deepEqual(titles(), ['beta.example']);
    await click(buttonsNamed(memory(), '清空全部')[0]!);
    await click(buttonsNamed(region()!, '清空全部已记住的站点')[0]!);
    assert.deepEqual(value.sitePrefs, {});
    assert.deepEqual(value.sites, ['rules.example']);
    assert.deepEqual(value.floatingHiddenSites, ['hidden.example']);
    assert.equal(value.siteMode, 'exclude');
    assert.equal(value.defaultRate, 1.25);
    assert.equal(region(), null);
    assert.equal(buttonsNamed(memory(), '清空全部').length, 0);
    assert.equal(memory().querySelector('#remembered-filter'), null);
    assert.match(memory().textContent ?? '', /还没有记住的站点/);
    assert.equal(remember()?.getAttribute('aria-checked'), 'false');
    assert.equal(sitePrefFor('player.test', value.sitePrefs), null);
    const exported = JSON.parse(serializeSettings(value, '1.7.0')) as { settings: Settings };
    assert.deepEqual(exported.settings.sitePrefs, {});
    assert.deepEqual(exported.settings.sites, ['rules.example']);
    assert.deepEqual(exported.settings.floatingHiddenSites, ['hidden.example']);
    assert.equal(exported.settings.defaultRate, 1.25);
  } finally {
    await act(async () => { root.unmount(); });
    await window.happyDOM.close();
  }
});
